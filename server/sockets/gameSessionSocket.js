const { Op } = require('sequelize');
const { randomInt, randomUUID } = require('crypto');
const {
    AbilityScore,
    AudioTrack,
    Character,
    GameCombatAction,
    GameAsset,
    GameParticipant,
    GameRoll,
    GameSession,
    GameToken,
    NpcAction,
    Scene,
    Skill,
    User,
} = require('../models');
const { resolveCharacterImage } = require('../utils/npcImages');
const { initiativeBonus, initiativeEntry, orderByInitiative } = require('../services/gameInitiative');
const {
    abilityModifier,
    buildActionCatalog,
    hpAfterDamage,
    hpAfterHealing,
    loadCombatCharacter,
    parseDiceExpression,
    pointDistance,
    REACTION_TRIGGERS,
    resolveTargetTokens,
    validRelationship,
} = require('../services/gameCombat');

const presence = new Map();
const rollDismissTimers = new Map();
const recentActionRequests = new Map();
const reactionWindowTimers = new Map();
const PLAYER_DICE_COLORS = ['#3d8b61', '#397ca8', '#a83f35', '#c47b36', '#4f9b9a', '#d8cfb8', '#7c9c45', '#b05f72'];
const BOARD_VFX_TYPES = new Set(['fire', 'ice', 'acid']);
const BOARD_VFX_SHAPES = new Set(['point', 'line', 'circle', 'square']);
const ROLL_CARD_EXIT_MS = 1150;

function emitConsciousnessChange(io, session, token, previousHp, nextHp) {
    if (!session || !token) return;
    const wasConscious = Number(previousHp) > 0;
    const isConscious = Number(nextHp) > 0;
    if (wasConscious === isConscious) return;
    io.to(roomName(session.id)).emit('game:consciousness-changed', {
        tokenId: token.id,
        characterId: token.character_id,
        name: token.label || token.character?.name || 'La criatura',
        status: isConscious ? 'revived' : 'unconscious',
    });
}

function dismissRollForEveryone(io, sessionId, rollId, delay = 10000) {
    const timerKey = `${sessionId}:${rollId}`;
    if (rollDismissTimers.has(timerKey)) return;
    const timer = setTimeout(async () => {
        try {
            io.to(roomName(sessionId)).emit('game:roll-dismissing', { rollIds: [rollId] });
            await new Promise(resolve => setTimeout(resolve, ROLL_CARD_EXIT_MS));
            await GameRoll.update({ dismissed: true }, { where: { id: rollId, session_id: sessionId } });
            io.to(roomName(sessionId)).emit('game:roll-dismissed', { rollIds: [rollId] });
        } catch (error) {
            console.error('automatic game roll dismissal error:', error);
        } finally {
            rollDismissTimers.delete(timerKey);
        }
    }, delay);
    rollDismissTimers.set(timerKey, timer);
}

function roomName(sessionId) {
    return `game:${sessionId}`;
}

function isDm(socket) {
    return socket.user?.role === 'DM' || socket.user?.role === 'ADMIN';
}

function clamp(value) {
    return Math.max(0, Math.min(100, Number(value) || 0));
}

function compactPathPoints(points, maxPoints = 160) {
    const normalized = (Array.isArray(points) ? points : [])
        .slice(0, 600)
        .map(point => ({ x: clamp(point.x), y: clamp(point.y) }));
    if (normalized.length <= maxPoints) return normalized;
    const compacted = [];
    const lastIndex = normalized.length - 1;
    for (let index = 0; index < maxPoints; index += 1) {
        compacted.push(normalized[Math.round((index * lastIndex) / (maxPoints - 1))]);
    }
    return compacted;
}

function annotationViewKey(session) {
    return `${session.shared_type}:${session.shared_url || ''}`;
}

function validAnnotationColor(value) {
    const color = String(value || '').trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(color) ? color : '#e8c66a';
}

function fail(socket, message) {
    socket.emit('game:error', { message });
}

function isInitiativeLabel(label) {
    return String(label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === 'iniciativa';
}

async function makeCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 20; attempt += 1) {
        let code = '';
        for (let index = 0; index < 6; index += 1) {
            code += alphabet[Math.floor(Math.random() * alphabet.length)];
        }
        if (!await GameSession.findOne({ where: { code } })) return code;
    }
    throw new Error('No se pudo generar un código de sala único.');
}

function addPresence(sessionId, userId, socketId) {
    if (!presence.has(sessionId)) presence.set(sessionId, new Map());
    const users = presence.get(sessionId);
    if (!users.has(userId)) users.set(userId, new Set());
    users.get(userId).add(socketId);
}

function removePresence(sessionId, userId, socketId) {
    const users = presence.get(sessionId);
    if (!users) return;
    const sockets = users.get(userId);
    sockets?.delete(socketId);
    if (!sockets?.size) users.delete(userId);
    if (!users.size) presence.delete(sessionId);
}

async function loadSession(sessionId) {
    const session = await GameSession.findByPk(sessionId, {
        include: [
            {
                model: GameParticipant,
                as: 'participants',
                separate: true,
                order: [['createdAt', 'ASC']],
                include: [
                    { model: User, as: 'user', attributes: ['id', 'username'] },
                    {
                        model: Character,
                        as: 'character',
                        attributes: ['id', 'name', 'race', 'class', 'level', 'image_url', 'rendered_url', 'base_body_url', 'hp_current', 'hp_max', 'ac_base'],
                    },
                ],
            },
            {
                model: GameToken,
                as: 'tokens',
                separate: true,
                order: [['createdAt', 'ASC']],
                include: [{
                    model: Character,
                    as: 'character',
                    attributes: [
                        'id', 'name', 'race', 'class', 'level', 'npc_type', 'owner_id', 'origin',
                        'image_url', 'rendered_url', 'base_body_url', 'hp_current', 'hp_max', 'hp_temp', 'ac_base',
                        'initiative_bonus', 'speed', 'size', 'creature_type', 'challenge_rating',
                        'proficiency_bonus', 'passive_perception', 'saving_throws',
                        'damage_resistances', 'damage_vulnerabilities', 'damage_immunities',
                        'condition_immunities', 'senses', 'languages', 'abilities_text',
                        'custom_features', 'spell_slots', 'spells_known', 'spells_prepared', 'notes',
                    ],
                    include: [
                        { model: AbilityScore, as: 'abilityScores', separate: true },
                        { model: Skill, as: 'skills', separate: true },
                        { model: NpcAction, as: 'npcActions', separate: true },
                    ],
                }],
            },
            {
                model: AudioTrack,
                as: 'audioTrack',
            },
            {
                model: GameRoll,
                as: 'rolls',
                where: { dismissed: false },
                required: false,
                separate: true,
                order: [['createdAt', 'DESC']],
            },
            {
                model: GameCombatAction,
                as: 'combatActions',
                separate: true,
                limit: 40,
                order: [['createdAt', 'DESC']],
                include: [
                    { model: User, as: 'actor', attributes: ['id', 'username'] },
                    { model: Character, as: 'actorCharacter', attributes: ['id', 'name', 'image_url', 'rendered_url', 'base_body_url'] },
                ],
            },
        ],
    });
    if (!session) return null;

    // La biblioteca pertenece al DM, no a la sala. Al consultar por primera
    // vez también se adoptan los assets históricos que sólo tenían session_id.
    const legacyAssets = await GameAsset.findAll({
        where: { owner_user_id: null },
        attributes: ['id'],
        include: [{
            model: GameSession,
            as: 'session',
            attributes: [],
            required: true,
            where: { dm_user_id: session.dm_user_id },
        }],
    });
    if (legacyAssets.length) {
        await GameAsset.update(
            { owner_user_id: session.dm_user_id },
            { where: { id: legacyAssets.map(asset => asset.id) } },
        );
    }
    const libraryAssets = await GameAsset.findAll({
        where: { owner_user_id: session.dm_user_id },
        order: [['sort_order', 'ASC'], ['createdAt', 'ASC']],
    });
    session.setDataValue('assets', libraryAssets);

    const sceneNpcIds = Array.isArray(session.scene_npc_ids)
        ? session.scene_npc_ids.map(Number).filter(Number.isInteger)
        : [];
    const sceneNpcs = sceneNpcIds.length
        ? await Character.findAll({
            where: { id: sceneNpcIds, is_npc: true },
            attributes: [
                'id', 'name', 'race', 'class', 'level', 'npc_type', 'origin', 'creature_type',
                'image_url', 'rendered_url', 'base_body_url', 'hp_current', 'hp_max', 'ac_base', 'speed',
            ],
        })
        : [];
    const npcById = new Map(sceneNpcs.map(character => [character.id, character.toJSON()]));
    session.setDataValue('scene_npcs', sceneNpcIds.map(id => npcById.get(id)).filter(Boolean).map(character => ({
        ...character,
        image_url: resolveCharacterImage(character),
    })));
    const now = Date.now();
    const stageVfx = Array.isArray(session.stage_vfx) ? session.stage_vfx : [];
    const activeVfx = stageVfx.filter(effect => effect.loop || !effect.expires_at || new Date(effect.expires_at).getTime() > now);
    if (activeVfx.length !== stageVfx.length) {
        session.stage_vfx = activeVfx;
        await session.save();
    }
    return session;
}

function combatantIds(participants, tokens) {
    return [...new Set([
        ...(participants || []).map(item => Number(item.character_id)),
        ...(tokens || []).map(item => Number(item.character_id)),
    ].filter(Number.isInteger))];
}

async function initializeInitiative(session, participants, tokens) {
    const ids = combatantIds(participants, tokens);
    const participantIds = new Set((participants || []).map(item => Number(item.character_id)).filter(Number.isInteger));
    const characters = await Character.findAll({
        where: { id: ids },
        attributes: ['id', 'is_npc', 'initiative_bonus'],
        include: [{ model: AbilityScore, as: 'abilityScores', separate: true }],
    });
    const entries = {};
    for (const character of characters) {
        if (participantIds.has(Number(character.id))) continue;
        entries[character.id] = initiativeEntry(character, randomInt(1, 21), 'npc');
    }
    const pending = ids.filter(id => participantIds.has(id));
    session.turn_order = orderByInitiative(entries, ids);
    session.turn_index = 0;
    session.round = 1;
    session.combat_state = {
        resources: {},
        reactions: {},
        mode: 'COMBAT',
        awaitingInitiative: pending.length > 0,
        initiative: entries,
        pendingInitiative: pending,
    };
    session.changed('combat_state', true);
}

async function recordInitiativeResult(session, character, roll, source = 'player') {
    const state = { ...(session.combat_state || {}) };
    const entries = { ...(state.initiative || {}) };
    const id = Number(character.id);
    if (entries[id]) return false;
    entries[id] = initiativeEntry(character, roll.results[0], source, roll.modifier);
    const pending = (state.pendingInitiative || []).map(Number).filter(characterId => characterId !== id);
    session.turn_order = orderByInitiative(entries, session.turn_order);
    session.turn_index = 0;
    session.combat_state = {
        ...state,
        initiative: entries,
        pendingInitiative: pending,
        awaitingInitiative: pending.length > 0,
    };
    session.changed('combat_state', true);
    await session.save();
    return true;
}

async function addAutomaticInitiative(session, character, source = 'npc') {
    if (session.combat_state?.mode !== 'COMBAT') return false;
    const id = Number(character?.id);
    const state = { ...(session.combat_state || {}) };
    const entries = { ...(state.initiative || {}) };
    const pending = (state.pendingInitiative || []).map(Number);
    if (!Number.isInteger(id) || entries[id] || pending.includes(id)) return false;
    const withAbilities = character.abilityScores
        ? character
        : await Character.findByPk(id, {
            attributes: ['id', 'is_npc', 'initiative_bonus'],
            include: [{ model: AbilityScore, as: 'abilityScores', separate: true }],
        });
    if (!withAbilities) return false;
    const activeCharacterId = state.awaitingInitiative ? null : session.turn_order?.[session.turn_index];
    entries[id] = initiativeEntry(withAbilities, randomInt(1, 21), source);
    session.turn_order = orderByInitiative(entries, [...session.turn_order, id]);
    session.turn_index = activeCharacterId == null ? 0 : Math.max(0, session.turn_order.map(Number).indexOf(Number(activeCharacterId)));
    session.combat_state = { ...state, initiative: entries };
    session.changed('combat_state', true);
    await session.save();
    return true;
}

function serializeSession(session, viewer) {
    if (!session) return null;
    const payload = session.toJSON();
    const onlineUsers = presence.get(session.id);
    payload.participants = (payload.participants || []).map(participant => ({
        ...participant,
        connected: Boolean(onlineUsers?.get(participant.user_id)?.size),
    }));
    payload.tokens = (payload.tokens || []).map(token => ({
        ...token,
        image_url: token.image_url || resolveCharacterImage(token.character),
    })).map(token => {
        if (!token.character) return token;
        const hasFullAccess = isDm(viewer) || token.owner_user_id === viewer?.user?.id;
        if (hasFullAccess) return token;

        const character = { ...token.character };
        character.npcActions = (character.npcActions || []).filter(action => action.is_public);
        delete character.abilityScores;
        delete character.skills;
        delete character.saving_throws;
        delete character.damage_resistances;
        delete character.damage_vulnerabilities;
        delete character.damage_immunities;
        delete character.condition_immunities;
        delete character.senses;
        delete character.languages;
        delete character.abilities_text;
        delete character.custom_features;
        delete character.spell_slots;
        delete character.spells_known;
        delete character.spells_prepared;
        delete character.notes;
        return { ...token, character };
    });
    payload.dm_connected = Boolean(onlineUsers?.get(payload.dm_user_id)?.size);
    // Los jugadores reciben sólo lo que el DM publica en shared_url/panels;
    // nunca la biblioteca completa, que puede contener spoilers de campaña.
    if (!isDm(viewer)) payload.assets = [];
    if (payload.combat_state?.reactionWindow) {
        const sanitizeReactionWindow = reactionWindow => {
            const canRespond = String(reactionWindow.controllerUserId) === String(viewer?.user?.id);
            return {
                ...reactionWindow,
                canRespond,
                options: canRespond ? (reactionWindow.options || []).map(option => ({ key: option.key, name: option.name, summary: option.summary })) : [],
                controllerUserId: undefined,
            };
        };
        const reactionWindow = payload.combat_state.reactionWindow;
        payload.combat_state = {
            ...payload.combat_state,
            reactionWindow: sanitizeReactionWindow(reactionWindow),
            reactionQueue: (payload.combat_state.reactionQueue || []).map(sanitizeReactionWindow),
        };
    }
    payload.active_character_id = payload.combat_state?.awaitingInitiative
        ? null
        : payload.turn_order?.[payload.turn_index] ?? null;
    payload.combat_actions = (payload.combatActions || []).map(action => ({
        id: action.id,
        actor_user_id: action.actor_user_id,
        actor_character_id: action.actor_character_id,
        actor_name: action.actorCharacter?.name || action.actor?.username || 'Combatiente',
        actor_image: resolveCharacterImage(action.actorCharacter),
        actor_is_npc: Boolean(action.actorCharacter?.is_npc),
        action_name: action.action_name,
        status: action.status,
        attack: action.result?.attack || null,
        reaction: action.result?.reaction || null,
        damage_formula: action.action_snapshot?.damage || action.action_snapshot?.healing || null,
        targets: action.result?.targets || [],
        summary: action.result?.summary || null,
        undone_at: action.undone_at,
        createdAt: action.createdAt,
        updatedAt: action.updatedAt,
    }));
    delete payload.combatActions;
    payload.server_now = new Date().toISOString();
    return payload;
}

function currentAudioPosition(session) {
    const base = Math.max(0, Number(session.audio_position_seconds) || 0);
    if (session.audio_status !== 'PLAYING' || !session.audio_started_at) return base;
    return base + Math.max(0, (Date.now() - new Date(session.audio_started_at).getTime()) / 1000);
}

async function broadcastSession(io, sessionId) {
    const session = await loadSession(sessionId);
    if (session) {
        const ownerUpdates = session.tokens
            .filter(token => !token.owner_user_id && token.character?.npc_type === 'compañero' && token.character.owner_id)
            .map(token => {
                const participant = session.participants.find(item => item.character_id === token.character.owner_id);
                if (!participant) return null;
                token.owner_user_id = participant.user_id;
                return token.save();
            })
            .filter(Boolean);
        if (ownerUpdates.length) await Promise.all(ownerUpdates);

        const socketIds = io.sockets.adapter.rooms.get(roomName(sessionId)) || [];
        socketIds.forEach(socketId => {
            const viewer = io.sockets.sockets.get(socketId);
            viewer?.emit('game:state', serializeSession(session, viewer));
        });
    }
    return session;
}

async function enterRoom(io, socket, sessionId) {
    if (socket.gameSessionId && socket.gameSessionId !== sessionId) {
        removePresence(socket.gameSessionId, socket.user.id, socket.id);
        socket.leave(roomName(socket.gameSessionId));
    }
    socket.gameSessionId = sessionId;
    socket.join(roomName(sessionId));
    addPresence(sessionId, socket.user.id, socket.id);
    await broadcastSession(io, sessionId);
}

async function requireHostedSession(socket, sessionId) {
    if (!isDm(socket)) return null;
    return GameSession.findOne({ where: { id: sessionId, dm_user_id: socket.user.id } });
}

async function hasPendingCombatAction(sessionId) {
    return Boolean(await GameCombatAction.findOne({
        where: { session_id: sessionId, status: { [Op.in]: ['PENDING', 'ATTACK_ROLL', 'DAMAGE_READY', 'EFFECT_ROLL', 'REACTION_PENDING'] } },
        attributes: ['id'],
    }));
}

function currentCombatState(session, actorCharacterId) {
    const current = session.combat_state && typeof session.combat_state === 'object' ? session.combat_state : {};
    const resources = { ...(current.resources || {}) };
    const reactions = { ...(current.reactions || {}) };
    const acBonuses = { ...(current.acBonuses || {}) };
    const shields = { ...(current.shields || {}) };
    if (Number(current.round) !== Number(session.round)
        || Number(current.turnIndex) !== Number(session.turn_index)
        || Number(current.actorCharacterId) !== Number(actorCharacterId)) {
        // Mantener los metadatos globales (especialmente mode) al iniciar el
        // estado de un nuevo turno. Si se perdía mode, el cliente volvía a
        // interpretar la mesa como narrativa después de cualquier acción.
        return { ...current, round: session.round, turnIndex: session.turn_index, actorCharacterId, used: {}, resources, reactions, acBonuses, shields, conditionalUses: {} };
    }
    return { ...current, used: { ...(current.used || {}) }, resources, reactions, acBonuses, shields };
}

function combatArmorClass(session, character) {
    const bonus = Number(session?.combat_state?.acBonuses?.[character?.id]?.bonus) || 0;
    return Math.max(1, (Number(character?.ac_base) || 10) + bonus);
}

function resourceAvailability(action, character, session) {
    const jammed = Boolean(session?.combat_state?.weaponJams?.[character?.id]);
    if (action.jamOnNaturalBelow && jammed) return { available: false, reason: 'El Escupefuego está atascado. Usa Desatascar Escupefuego.' };
    if (action.clearWeaponJam && !jammed) return { available: false, reason: 'El Escupefuego no está atascado.' };
    if (action.resource?.type === 'spell-slot') {
        const minimumLevel = Number(action.resource.level) || 1;
        const slots = character.spell_slots || {};
        const availableLevel = Object.keys(slots)
            .map(Number)
            .filter(level => level >= minimumLevel && Number(slots[level]?.used || 0) < Number(slots[level]?.max || 0))
            .sort((left, right) => left - right)[0];
        return availableLevel ? { available: true, slotLevel: availableLevel } : { available: false, reason: `No quedan espacios de nivel ${minimumLevel} o superior.` };
    }
    if (action.resource?.type === 'feature-use') {
        const remaining = Number(action.resource.max) - Number(action.resource.used || 0);
        return remaining > 0 ? { available: true } : { available: false, reason: 'No quedan usos disponibles.' };
    }
    if (action.resource?.type === 'session-use') {
        const state = currentCombatState(session, character.id);
        const used = Number(state.resources?.[`${character.id}:${action.resource.key}`] || 0);
        return used < Number(action.resource.max) ? { available: true, used } : { available: false, used, reason: 'No quedan usos disponibles.' };
    }
    if (action.resource?.type === 'recharge') {
        const state = currentCombatState(session, character.id);
        const used = Number(state.resources?.[`${character.id}:${action.resource.key}`] || 0);
        return used < 1 ? { available: true } : { available: false, reason: `Debe recargar con ${action.resource.min || 5}–6 al comenzar su turno.` };
    }
    return { available: true };
}

function mechanicallyExecutable(action) {
    return action.attackBonus != null || action.damage || action.healing || action.temporaryHp
        || (action.saveAbility && action.saveDc) || action.movement || action.shield
        || action.trackerCost || action.trackerRefill || action.clearWeaponJam
        || action.manualResolution
        || (action.effect && action.effect.type !== 'CUSTOM')
        || (action.reactionEffect && action.reactionEffect.type !== 'CUSTOM');
}

function reactionControllerUserId(session, token) {
    return token?.owner_user_id || session?.dm_user_id || null;
}

function activeReactionWindow(session) {
    const window = session?.combat_state?.reactionWindow;
    if (!window?.id) return null;
    return window;
}

function decorateActions(actions, character, session) {
    const state = currentCombatState(session, character.id);
    return actions.map(action => {
        const resource = resourceAvailability(action, character, session);
        const executable = mechanicallyExecutable(action);
        const reactionWindow = activeReactionWindow(session);
        const reactionTriggered = action.economy !== 'reaction' || Boolean(
            reactionWindow
            && Number(reactionWindow.reactorCharacterId) === Number(character.id)
            && reactionWindow.options?.some(option => option.key === action.key),
        );
        const economyUsed = action.economy === 'reaction'
            ? Boolean(state.reactions?.[character.id])
            : Boolean(state.used?.[action.economy]);
        return {
            ...action,
            available: executable && resource.available && !economyUsed && reactionTriggered && session.status === 'LIVE',
            unavailableReason: session.status !== 'LIVE'
                ? 'La partida debe estar en vivo.'
                : !executable
                    ? 'Esta habilidad requiere resolución manual del DM; todavía no se ejecuta automáticamente.'
                    : !reactionTriggered
                    ? 'Esta reacción se habilita cuando ocurre su disparador.'
                    : economyUsed
                    ? `Ya usaste tu ${action.economy === 'bonus' ? 'acción bonus' : action.economy === 'reaction' ? 'reacción' : 'acción'} este turno.`
                    : resource.reason || null,
            selectedSlotLevel: resource.slotLevel || null,
        };
    });
}

async function eligibleReactionOptions(session, reactorToken, trigger) {
    if (!reactorToken?.character_id || session.combat_state?.reactions?.[reactorToken.character_id]) return [];
    const catalog = await buildActionCatalog(reactorToken.character_id);
    if (!catalog) return [];
    return catalog.actions.filter(action => (
        action.economy === 'reaction'
        && action.reactionTrigger === trigger
        && mechanicallyExecutable(action)
        && resourceAvailability(action, catalog.character, session).available
        && !(action.shield && session.combat_state?.shields?.[reactorToken.character_id]?.broken)
    ));
}

async function consumeReactionResource(action, character, state) {
    if (action.resource?.type === 'spell-slot') {
        const minimum = Number(action.resource.level) || 1;
        const slots = JSON.parse(JSON.stringify(character.spell_slots || {}));
        const level = Object.keys(slots).map(Number).filter(candidate => (
            candidate >= minimum && Number(slots[candidate]?.used || 0) < Number(slots[candidate]?.max || 0)
        )).sort((left, right) => left - right)[0];
        if (!level) throw new Error('No quedan espacios de conjuro para esta reacción.');
        slots[level].used = Number(slots[level].used || 0) + 1;
        character.spell_slots = slots;
        character.changed('spell_slots', true);
        await character.save();
    } else if (action.resource?.type === 'feature-use') {
        const feature = await NpcAction.findByPk(action.resource.actionId);
        if (!feature || Number(feature.used_uses || 0) >= Number(feature.max_uses || 0)) throw new Error('No quedan usos de esta reacción.');
        feature.used_uses = Number(feature.used_uses || 0) + 1;
        await feature.save();
    } else if (action.resource?.type === 'session-use') {
        const resourceKey = `${character.id}:${action.resource.key}`;
        const used = Number(state.resources?.[resourceKey] || 0);
        if (used >= Number(action.resource.max || 0)) throw new Error('No quedan usos de esta reacción.');
        state.resources = { ...(state.resources || {}), [resourceKey]: used + 1 };
    } else if (action.resource?.type === 'recharge') {
        const resourceKey = `${character.id}:${action.resource.key}`;
        if (Number(state.resources?.[resourceKey] || 0) >= 1) throw new Error('Esta habilidad todavía no se recargó.');
        state.resources = { ...(state.resources || {}), [resourceKey]: 1 };
    }
}

async function openReactionWindow(io, session, {
    trigger,
    reactorToken,
    sourceToken = null,
    parentAction = null,
    resumeStatus = 'DAMAGE_READY',
    context = {},
}) {
    const candidateOptions = await eligibleReactionOptions(session, reactorToken, trigger);
    const options = candidateOptions.filter(action => !action.reactionEffect?.meleeOnly || (
        sourceToken && pointDistance(reactorToken, sourceToken) <= 8
    ));
    if (!options.length) return false;
    const id = randomUUID();
    const queued = Boolean(activeReactionWindow(session));
    const expiresAt = queued ? null : new Date(Date.now() + 15000).toISOString();
    const window = {
        id,
        trigger,
        reactorCharacterId: Number(reactorToken.character_id),
        reactorTokenId: reactorToken.id,
        reactorName: reactorToken.label || reactorToken.character?.name || 'Combatiente',
        controllerUserId: reactionControllerUserId(session, reactorToken),
        sourceTokenId: sourceToken?.id || null,
        sourceCharacterId: sourceToken?.character_id || null,
        sourceName: sourceToken?.label || sourceToken?.character?.name || null,
        parentActionId: parentAction?.id || null,
        resumeStatus,
        context,
        expiresAt,
        options: options.map(action => ({
            key: action.key,
            name: action.name,
            summary: action.summary || action.description || 'Usar reacción',
            action,
        })),
    };
    const state = queued
        ? { ...(session.combat_state || {}), reactionQueue: [...(session.combat_state?.reactionQueue || []), window] }
        : { ...(session.combat_state || {}), reactionWindow: window };
    session.combat_state = state;
    session.changed('combat_state', true);
    await session.save();
    if (parentAction) {
        parentAction.status = 'REACTION_PENDING';
        parentAction.result = { ...(parentAction.result || {}), summary: `${parentAction.action_name}: esperando reacción de ${window.reactorName}${queued ? ' (en cola)' : ''}.` };
        await parentAction.save();
    }
    if (queued) return true;
    const timer = setTimeout(() => {
        reactionWindowTimers.delete(id);
        resolveReactionWindow(io, session.id, id, null, null).catch(error => console.error('reaction window expiry error:', error));
    }, 15000);
    reactionWindowTimers.set(id, timer);
    return true;
}

async function createReactionCombatAction(io, session, window, option, controllerUserId) {
    const action = option.action || {};
    const effect = action.reactionEffect || { type: 'CUSTOM' };
    const reactorToken = session.tokens.find(token => String(token.id) === String(window.reactorTokenId));
    const sourceToken = session.tokens.find(token => String(token.id) === String(window.sourceTokenId));
    if (!reactorToken?.character || !sourceToken?.character) return null;
    const forcedSave = effect.type === 'FORCED_SAVE';
    const actionSnapshot = forcedSave
        ? {
            ...action,
            damage: null,
            healing: null,
            utilitySave: true,
            saveAbility: effect.saveAbility || 'DEX',
            saveDc: Number(effect.saveDc) || 10,
            effect: { type: 'SAVE_CONDITION', conditions: effect.condition ? [effect.condition] : [] },
            forcedMovement: Number(effect.pushFeet) > 0
                ? { pushFeet: Number(effect.pushFeet), originTokenId: reactorToken.id }
                : null,
            reactionParentActionId: window.parentActionId || null,
        }
        : action;
    const reactionAction = await GameCombatAction.create({
        session_id: session.id,
        actor_user_id: controllerUserId,
        actor_character_id: reactorToken.character_id,
        action_key: action.key,
        action_name: action.name,
        status: 'PENDING',
        action_snapshot: actionSnapshot,
        target_token_ids: [sourceToken.id],
        before_state: {
            targets: [{ tokenId: sourceToken.id, characterId: sourceToken.character_id, hpCurrent: sourceToken.character.hp_current, hpMax: sourceToken.character.hp_max, hpTemp: sourceToken.character.hp_temp }],
            combatState: JSON.parse(JSON.stringify(session.combat_state || {})),
        },
        result: { summary: forcedSave
            ? `${window.reactorName} usa ${action.name}; ${window.sourceName} debe realizar una salvación de ${effect.saveAbility || 'DEX'} CD ${Number(effect.saveDc) || 10}.`
            : `${window.reactorName} responde con ${action.name}.` },
    });
    if (forcedSave) {
        const saveControllerUserId = reactionControllerUserId(session, sourceToken);
        const roll = await createCombatRoll(io, session, saveControllerUserId, sourceToken.character, {
            sides: 20,
            quantity: 1,
            modifier: savingThrowBonus(sourceToken.character, effect.saveAbility || 'DEX'),
            label: `${window.sourceName} · salvación ${effect.saveAbility || 'DEX'} contra ${action.name}`,
        });
        reactionAction.effect_roll_id = roll.id;
        reactionAction.status = 'EFFECT_ROLL';
        await reactionAction.save();
        return reactionAction;
    }
    const rollRequest = action.attackBonus != null
        ? { sides: 20, quantity: 1, modifier: Number(action.attackBonus), label: `${action.name} · ataque de reacción` }
        : parseDiceExpression(action.damage || action.healing);
    if (!rollRequest) {
        reactionAction.status = 'COMPLETED';
        await reactionAction.save();
        return reactionAction;
    }
    const roll = await createCombatRoll(io, session, controllerUserId, reactorToken.character, {
        ...rollRequest,
        label: rollRequest.label || `${action.name} · reacción`,
    });
    if (action.attackBonus != null) reactionAction.attack_roll_id = roll.id;
    else reactionAction.effect_roll_id = roll.id;
    reactionAction.status = action.attackBonus != null ? 'ATTACK_ROLL' : 'EFFECT_ROLL';
    await reactionAction.save();
    return reactionAction;
}

async function resolveReactionWindow(io, sessionId, windowId, actionKey, socketUserId) {
    const session = await loadSession(sessionId);
    const window = activeReactionWindow(session);
    if (!session || !window || String(window.id) !== String(windowId)) return { ok: false, message: 'La ventana de reacción ya terminó.' };
    if (socketUserId && String(window.controllerUserId) !== String(socketUserId)) return { ok: false, message: 'Esta reacción pertenece a otro combatiente.' };
    const option = actionKey ? window.options?.find(item => item.key === actionKey) : null;
    const state = { ...(session.combat_state || {}), reactionWindow: null };
    const parentAction = window.parentActionId ? await GameCombatAction.findByPk(window.parentActionId) : null;
    if (option) {
        const reactorToken = session.tokens.find(token => Number(token.character_id) === Number(window.reactorCharacterId));
        if (!reactorToken?.character) return { ok: false, message: 'El combatiente que reacciona ya no está disponible.' };
        try {
            await consumeReactionResource(option.action || {}, reactorToken.character, state);
        } catch (error) {
            return { ok: false, message: error.message };
        }
        state.reactions = { ...(state.reactions || {}), [window.reactorCharacterId]: true };
        const effect = option.action?.reactionEffect || { type: 'CUSTOM' };
        const reactionIdentity = {
            name: option.name,
            effect: effect.type,
            reactorName: window.reactorName,
            reactorImage: resolveCharacterImage(reactorToken.character),
            reactorIsNpc: !reactorToken.owner_user_id,
            targetName: window.sourceName,
        };
        if (effect.type === 'AC_BONUS') {
            state.acBonuses = { ...(state.acBonuses || {}), [window.reactorCharacterId]: { bonus: Number(effect.bonus) || 5, source: option.name } };
            if (parentAction?.result?.attack) {
                const targetToken = session.tokens.find(token => Number(token.character_id) === Number(window.reactorCharacterId));
                const nextAc = combatArmorClass({ combat_state: state }, targetToken?.character);
                const hit = Number(parentAction.result.attack.total) >= nextAc && Number(parentAction.result.attack.natural) !== 1;
                let shieldCheck = null;
                if (effect.shield) {
                    const prior = state.shields?.[window.reactorCharacterId] || {};
                    const threshold = Number(prior.breakThreshold ?? effect.shield.initial_break_threshold ?? 3);
                    const natural = randomInt(1, 7);
                    const broken = natural <= threshold;
                    state.shields = { ...(state.shields || {}), [window.reactorCharacterId]: { broken, breakThreshold: threshold + 1 } };
                    shieldCheck = { natural, threshold, broken };
                }
                parentAction.result = { ...parentAction.result, attack: { ...parentAction.result.attack, targetAc: nextAc, hit }, reaction: { ...reactionIdentity, shieldCheck } };
                parentAction.status = hit ? window.resumeStatus : 'COMPLETED';
                if (!hit) parentAction.result.summary = `${option.name} eleva la CA a ${nextAc}; ${parentAction.action_name} falla.${shieldCheck ? ` Control de escudo: ${shieldCheck.natural} (${shieldCheck.broken ? 'se rompe' : 'resiste'}).` : ''}`;
            }
        } else if (effect.type === 'HALVE_DAMAGE' || effect.type === 'RESIST_TRIGGERING_DAMAGE') {
            if (parentAction) {
                parentAction.result = { ...(parentAction.result || {}), reactionModifiers: { ...parentAction.result?.reactionModifiers, damageMultiplier: 0.5 }, reaction: reactionIdentity };
                parentAction.status = window.resumeStatus;
            }
        } else if (effect.type === 'COUNTER_DAMAGE' || effect.type === 'OPPORTUNITY_ATTACK') {
            if (parentAction) parentAction.status = window.resumeStatus;
        } else if (effect.type === 'FORCED_SAVE') {
            if (parentAction) {
                parentAction.status = window.resumeStatus;
                parentAction.result = {
                    ...(parentAction.result || {}),
                    reaction: { ...reactionIdentity, savePending: true, ability: effect.saveAbility, dc: effect.saveDc },
                    summary: `${window.reactorName} usa ${option.name}; ${window.sourceName} debe realizar una salvación de ${effect.saveAbility} CD ${effect.saveDc}.`,
                };
            }
        } else if (parentAction) parentAction.status = window.resumeStatus;
        if (parentAction) await parentAction.save();
    } else if (parentAction) {
        parentAction.status = window.resumeStatus;
        parentAction.result = {
            ...(parentAction.result || {}),
            reaction: { name: null, effect: 'PASSED', passed: true, reactorName: window.reactorName },
            summary: window.context?.resumeSummary || parentAction.result?.summary,
        };
        await parentAction.save();
    }
    if (parentAction?.attack_roll_id && parentAction.result?.attack) {
        const attackRoll = await GameRoll.findByPk(parentAction.attack_roll_id);
        if (attackRoll) {
            const finalHit = Boolean(parentAction.result.attack.hit);
            const targetName = parentAction.result.attack.targetName || window.reactorName;
            const reactionName = parentAction.result.reaction?.passed ? null : parentAction.result.reaction?.name;
            attackRoll.label = `${parentAction.action_name}: ${finalHit ? `impacta a ${targetName}` : `falla contra ${targetName}`}${reactionName ? ` tras ${reactionName}` : ''}`.slice(0, 120);
            await attackRoll.save();
            io.to(roomName(session.id)).emit('game:roll-upsert', attackRoll.toJSON());
        }
    }
    const timer = reactionWindowTimers.get(window.id);
    if (timer) clearTimeout(timer);
    reactionWindowTimers.delete(window.id);
    session.combat_state = state;
    session.changed('combat_state', true);
    await session.save();

    const queuedWindows = state.reactionQueue || [];
    if (queuedWindows.length) {
        const [nextWindow, ...remainingWindows] = queuedWindows;
        nextWindow.expiresAt = new Date(Date.now() + 15000).toISOString();
        session.combat_state = { ...(session.combat_state || {}), reactionWindow: nextWindow, reactionQueue: remainingWindows };
        session.changed('combat_state', true);
        await session.save();
        const nextTimer = setTimeout(() => {
            reactionWindowTimers.delete(nextWindow.id);
            resolveReactionWindow(io, session.id, nextWindow.id, null, null).catch(error => console.error('reaction window expiry error:', error));
        }, 15000);
        reactionWindowTimers.set(nextWindow.id, nextTimer);
    }

    // El desplazamiento que activó ataques de oportunidad se confirma recién
    // cuando no quedan reacciones en cola: todas deben resolverse contra la
    // posición que el objetivo tenía al abandonar el alcance.
    if (window.context?.pendingMove && !queuedWindows.length) {
        const move = window.context.pendingMove;
        const movingToken = session.tokens.find(token => String(token.id) === String(move.tokenId));
        if (movingToken) {
            movingToken.x = clamp(move.x);
            movingToken.y = clamp(move.y);
            await movingToken.save();
            io.to(roomName(session.id)).emit('game:token-moved', { tokenId: movingToken.id, x: movingToken.x, y: movingToken.y });
        }
    }
    if (option && ['COUNTER_DAMAGE', 'OPPORTUNITY_ATTACK', 'FORCED_SAVE'].includes(option.action?.reactionEffect?.type)) {
        await createReactionCombatAction(io, session, window, option, window.controllerUserId);
    }
    await broadcastSession(io, session.id);
    return { ok: true };
}

function refreshTurnReaction(state, characterId) {
    const reactions = { ...(state?.reactions || {}) };
    const acBonuses = { ...(state?.acBonuses || {}) };
    delete reactions[characterId];
    delete acBonuses[characterId];
    return { ...state, reactions, acBonuses, resources: { ...(state?.resources || {}) } };
}

async function rollTurnRecharges(session, characterId) {
    const catalog = await buildActionCatalog(characterId);
    if (!catalog) return;
    const resources = { ...(session.combat_state?.resources || {}) };
    const rolls = [];
    for (const action of catalog.actions.filter(item => item.resource?.type === 'recharge')) {
        const key = `${characterId}:${action.resource.key}`;
        if (!Number(resources[key] || 0)) continue;
        const natural = randomInt(1, 7);
        const recovered = natural >= Number(action.resource.min || 5);
        if (recovered) resources[key] = 0;
        rolls.push({ action: action.name, natural, recovered });
    }
    session.combat_state = { ...(session.combat_state || {}), resources, rechargeRolls: rolls };
}

function customTrackers(character, session) {
    const features = Array.isArray(character.custom_features)
        ? character.custom_features
        : Array.isArray(character.custom_features?.trackers)
            ? character.custom_features.trackers
            : [];
    const state = currentCombatState(session, character.id);
    return features
        .filter(feature => feature?.tracker?.key && Number.isFinite(Number(feature.tracker.max)))
        .map(feature => {
            const tracker = feature.tracker;
            const key = `${character.id}:tracker:${tracker.key}`;
            const max = Math.max(0, Number(tracker.max));
            const value = Math.max(0, Math.min(max, Number(state.resources?.[key] ?? tracker.value ?? max)));
            return { key: tracker.key, label: tracker.label || feature.name, value, max, unit: tracker.unit || '' };
        });
}

async function createCombatRoll(io, session, actorUserId, character, request) {
    const roll = await GameRoll.create({
        session_id: session.id,
        user_id: actorUserId,
        character_id: character.id,
        roller_name: character.name,
        character_name: character.name,
        character_image: resolveCharacterImage(character),
        label: String(request.label || 'Acción de combate').slice(0, 120),
        sides: request.sides,
        quantity: request.quantity,
        modifier: request.modifier || 0,
        theme_color: request.themeColor || '#c89b43',
        results: [],
        total: request.modifier || 0,
        resolved: false,
    });
    io.to(roomName(session.id)).emit('game:roll-upsert', roll.toJSON());
    return roll;
}

function savingThrowBonus(character, ability) {
    const base = abilityModifier(character, ability);
    const configured = character.saving_throws?.[ability]
        ?? character.saving_throws?.[ability?.toLowerCase?.()]
        ?? character.saving_throws?.[ability?.toUpperCase?.()];
    if (Number.isFinite(Number(configured)) && typeof configured !== 'boolean') return Number(configured);
    const proficiency = Number(character.proficiency_bonus) || (2 + Math.floor((Math.max(1, Number(character.level) || 1) - 1) / 4));
    return base + (configured ? proficiency : 0);
}

async function finalizeCombatAction(io, combatAction, roll) {
    const session = await loadSession(combatAction.session_id);
    if (!session) return;
    const action = combatAction.action_snapshot || {};
    const actorToken = session.tokens.find(token => Number(token.character_id) === Number(combatAction.actor_character_id));
    const targets = session.tokens.filter(token => (combatAction.target_token_ids || []).map(String).includes(String(token.id)));
    if (!actorToken || !targets.length) {
        combatAction.status = 'FAILED';
        combatAction.result = { summary: 'La acción no pudo completarse porque ya no están sus objetivos.' };
        await combatAction.save();
        return broadcastSession(io, session.id);
    }

    const previousResult = combatAction.result || {};
    const queueMultiattackFollowup = async () => {
        // Las acciones normales no incluyen `multiattack`. Number(undefined)
        // es NaN y NaN <= 1 es falso, lo que creaba por error un "golpe 2".
        const attackCount = Number(action.multiattack) || 1;
        if (attackCount <= 1 || action.attackBonus == null) return false;
        const character = await loadCombatCharacter(combatAction.actor_character_id);
        if (!character) return false;
        const followupAction = { ...action, multiattack: 1, name: `${action.name} · golpe 2` };
        const followup = await GameCombatAction.create({
            session_id: session.id,
            actor_user_id: combatAction.actor_user_id,
            actor_character_id: combatAction.actor_character_id,
            action_key: `${combatAction.action_key}:2`,
            action_name: followupAction.name,
            status: 'ATTACK_ROLL',
            action_snapshot: followupAction,
            target_token_ids: combatAction.target_token_ids,
            area: combatAction.area,
            before_state: combatAction.before_state,
            result: { summary: `${action.name}: segundo ataque.` },
        });
        const attackRoll = await createCombatRoll(io, session, combatAction.actor_user_id, character, {
            sides: 20,
            quantity: 1,
            modifier: Number(followupAction.attackBonus),
            label: `${followupAction.name} · ataque`,
        });
        followup.attack_roll_id = attackRoll.id;
        await followup.save();
        return true;
    };
    if (String(combatAction.attack_roll_id) === String(roll.id)) {
        const target = targets[0];
        const natural = action.attackRollMode === 'advantage'
            ? Math.max(...(roll.results || []).map(Number))
            : Number(roll.results?.[0]);
        if (action.attackRollMode === 'advantage') {
            roll.total = natural + Number(roll.modifier || 0);
        }
        const targetAc = combatArmorClass(session, target.character);
        const hit = natural === 20 || (natural !== 1 && Number(roll.total) >= targetAc);
        combatAction.result = {
            ...previousResult,
            attack: { total: roll.total, natural, targetAc, hit, critical: natural === 20, targetName: target.label },
        };
        if (action.jamOnNaturalBelow && natural < Number(action.jamOnNaturalBelow)) {
            session.combat_state = { ...(session.combat_state || {}), weaponJams: { ...(session.combat_state?.weaponJams || {}), [combatAction.actor_character_id]: true } };
            session.changed('combat_state', true);
            await session.save();
            combatAction.result.weaponJam = { jammed: true, natural, threshold: Number(action.jamOnNaturalBelow) };
        }
        roll.label = `${combatAction.action_name}: ${hit ? `impacta a ${target.label}` : `falla contra ${target.label}`}`.slice(0, 120);
        await roll.save();
        if (!hit) {
            if (Number(action.grazeDamage) > 0 && target.character) {
                const previousHp = target.character.hp_current;
                const grazed = hpAfterDamage(target.character, Number(action.grazeDamage), action.damageType);
                target.character.hp_current = grazed.hp_current;
                target.character.hp_temp = grazed.hp_temp;
                await target.character.save();
                emitConsciousnessChange(io, session, target, previousHp, target.character.hp_current);
                io.to(roomName(session.id)).emit('game:token-hp-updated', { tokenId: target.id, characterId: target.character.id, hpCurrent: target.character.hp_current, hpMax: target.character.hp_max, hpTemp: target.character.hp_temp });
                combatAction.result = { ...combatAction.result, targets: [{ tokenId: target.id, name: target.label, outcome: 'graze', amount: grazed.amount }], summary: `${combatAction.action_name}: falla, pero Graze inflige ${grazed.amount} de daño a ${target.label}.` };
            } else {
                combatAction.result = { ...combatAction.result, targets: [{ tokenId: target.id, name: target.label, outcome: 'miss' }], summary: `${combatAction.action_name}: falla contra ${target.label}.` };
            }
            combatAction.status = 'COMPLETED';
            await combatAction.save();
            await queueMultiattackFollowup();
            return broadcastSession(io, session.id);
        }

        const expression = parseDiceExpression(action.damage || action.healing);
        const reactionOpened = await openReactionWindow(io, session, {
            trigger: REACTION_TRIGGERS.ATTACK_HIT_BEFORE_DAMAGE,
            reactorToken: target,
            sourceToken: actorToken,
            parentAction: combatAction,
            resumeStatus: expression ? 'DAMAGE_READY' : 'COMPLETED',
            context: { resumeSummary: `${combatAction.action_name}: impacto confirmado.` },
        });
        if (reactionOpened) {
            roll.label = `${combatAction.action_name}: ${roll.total} · esperando reacción de ${target.label}`.slice(0, 120);
            await roll.save();
            io.to(roomName(session.id)).emit('game:roll-upsert', roll.toJSON());
            return broadcastSession(io, session.id);
        }
        if (!expression) {
            combatAction.status = 'COMPLETED';
            combatAction.result = { ...combatAction.result, targets: [{ tokenId: target.id, name: target.label, outcome: 'hit' }], summary: `${combatAction.action_name}: impacta a ${target.label}.` };
            await combatAction.save();
            await queueMultiattackFollowup();
            return broadcastSession(io, session.id);
        }
        combatAction.status = 'DAMAGE_READY';
        combatAction.result = { ...combatAction.result, summary: `${combatAction.action_name}: impacto confirmado. Esperando tirada de daño.` };
        await combatAction.save();
        return broadcastSession(io, session.id);

    }

    if (String(combatAction.effect_roll_id) !== String(roll.id)) return;
    if (action.utilitySave) {
        const target = targets[0];
        const natural = Number(roll.results?.[0]) || 0;
        const bonus = Number(roll.modifier) || 0;
        const total = Number(roll.total) || natural + bonus;
        const success = total >= Number(action.saveDc);
        const conditions = success ? [] : (action.effect?.conditions || []).filter(Boolean);
        let targetChanged = false;
        let pushedFeet = 0;
        if (target && conditions.length) {
            target.conditions = [...new Set([...(Array.isArray(target.conditions) ? target.conditions : []), ...conditions])];
            targetChanged = true;
            io.to(roomName(session.id)).emit('game:token-condition-updated', { tokenId: target.id, conditions: target.conditions });
        }
        if (target && !success && Number(action.forcedMovement?.pushFeet) > 0) {
            const originToken = session.tokens.find(token => String(token.id) === String(action.forcedMovement.originTokenId));
            if (originToken) {
                const dx = Number(target.x) - Number(originToken.x);
                const dy = Number(target.y) - Number(originToken.y);
                const length = Math.hypot(dx, dy) || 1;
                pushedFeet = Number(action.forcedMovement.pushFeet);
                const distance = Math.max(4, pushedFeet * 0.8);
                target.x = clamp(Number(target.x) + (dx / length) * distance);
                target.y = clamp(Number(target.y) + (dy / length) * distance);
                targetChanged = true;
                io.to(roomName(session.id)).emit('game:token-moved', { tokenId: target.id, x: target.x, y: target.y });
            }
        }
        if (targetChanged) await target.save();
        combatAction.status = 'COMPLETED';
        combatAction.result = {
            ...previousResult,
            save: { ability: action.saveAbility, dc: action.saveDc, natural, bonus, total, success },
            targets: [{ tokenId: target?.id, characterId: target?.character_id, name: target?.label, outcome: success ? 'saved' : 'failed-save', conditions, pushedFeet }],
            summary: success
                ? `${target?.label} supera ${action.name} (${total} contra CD ${action.saveDc}).`
                : `${target?.label} falla ${action.name} (${total} contra CD ${action.saveDc})${pushedFeet ? `, es empujado ${pushedFeet} pies` : ''}${conditions.length ? ` y queda ${conditions.join(' y ').toLowerCase()}` : ''}.`,
        };
        roll.label = combatAction.result.summary.slice(0, 120);
        const parentAction = action.reactionParentActionId
            ? await GameCombatAction.findByPk(action.reactionParentActionId)
            : null;
        if (parentAction) {
            parentAction.result = {
                ...(parentAction.result || {}),
                reaction: {
                    ...(parentAction.result?.reaction || {}),
                    savePending: false,
                    save: { ability: action.saveAbility, dc: action.saveDc, natural, bonus, total, success },
                    condition: success ? null : conditions[0] || null,
                    pushFeet: success ? 0 : pushedFeet,
                },
                summary: combatAction.result.summary,
            };
        }
        await Promise.all([roll.save(), combatAction.save(), parentAction?.save()].filter(Boolean));
        return broadcastSession(io, session.id);
    }
    if (action.shield) {
        const state = currentCombatState(session, combatAction.actor_character_id);
        const prior = state.shields?.[combatAction.actor_character_id] || {};
        const threshold = Number(prior.breakThreshold ?? action.shield.initial_break_threshold ?? 3);
        const natural = Number(roll.results?.[0]) || 0;
        const broken = natural <= threshold;
        state.shields[combatAction.actor_character_id] = {
            broken,
            breakThreshold: threshold + 1,
        };
        session.combat_state = state;
        session.changed('combat_state', true);
        await session.save();
        combatAction.status = 'COMPLETED';
        combatAction.result = {
            ...previousResult,
            shield: { bonus: Number(action.shield.bonus) || 5, natural, threshold, broken },
            targets: [{ tokenId: actorToken.id, characterId: actorToken.character_id, name: actorToken.label, outcome: broken ? 'shield-broken' : 'shield-ready' }],
            summary: broken
                ? `${combatAction.action_name}: el control dio ${natural} (rotura con ${threshold} o menos). El escudo se rompió.`
                : `${combatAction.action_name}: el control dio ${natural}; el escudo resiste. Próximo umbral de rotura: ${threshold + 1} o menos.`,
        };
        await combatAction.save();
        return broadcastSession(io, session.id);
    }
    const outcomes = [];
    const criticalMultiplier = combatAction.result?.attack?.critical ? 2 : 1;
    const persistentMark = session.combat_state?.effects?.[combatAction.actor_character_id]?.mark;
    const markedExtraDamage = persistentMark && targets.some(target => String(target.id) === String(persistentMark.targetTokenId))
        ? [{ expression: persistentMark.damage, damageType: persistentMark.damageType }]
        : [];
    const configuredExtraDamage = (action.extraDamage || []).map(expression => ({ expression, damageType: action.extraDamageType || action.damageType }));
    const conditionalUseKey = `${combatAction.actor_character_id}:colossus-slayer`;
    const conditionalAvailable = !session.combat_state?.conditionalUses?.[conditionalUseKey];
    const conditionalExtraDamage = (action.conditionalExtraDamage || []).filter(component => {
        if (component.when === 'target-wounded' && !targets.some(target => Number(target.character?.hp_current) < Number(target.character?.hp_max))) return false;
        return !component.oncePerTurn || conditionalAvailable;
    });
    if (conditionalExtraDamage.some(component => component.oncePerTurn)) {
        session.combat_state = { ...(session.combat_state || {}), conditionalUses: { ...(session.combat_state?.conditionalUses || {}), [conditionalUseKey]: true } };
        session.changed('combat_state', true);
        await session.save();
    }
    const extraRolls = [...configuredExtraDamage, ...markedExtraDamage, ...conditionalExtraDamage].flatMap(component => {
        const parsed = parseDiceExpression(component.expression);
        if (!parsed) return [];
        const results = Array.from({ length: parsed.quantity * criticalMultiplier }, () => randomInt(1, parsed.sides + 1));
        return [{ expression: component.expression, damageType: component.damageType, results, total: results.reduce((sum, value) => sum + value, 0) + parsed.modifier }];
    });
    const reactionMultiplier = Number(combatAction.result?.reactionModifiers?.damageMultiplier) || 1;
    const totalEffect = Math.floor(((Number(roll.total) || 0) + extraRolls.reduce((sum, item) => sum + item.total, 0)) * reactionMultiplier);
    for (const target of targets) {
        const character = target.character;
        if (!character) continue;
        const previousHp = character.hp_current;
        let amount = totalEffect;
        let save = null;
        if (action.saveAbility && action.saveDc) {
            const natural = randomInt(1, 21);
            const bonus = savingThrowBonus(character, action.saveAbility);
            const total = natural + bonus;
            const success = total >= Number(action.saveDc);
            save = { ability: action.saveAbility, dc: action.saveDc, natural, bonus, total, success };
            if (success) amount = action.halfOnSave ? Math.floor(amount / 2) : 0;
            if (!success && action.effect?.conditions?.length) {
                target.conditions = [...new Set([...(Array.isArray(target.conditions) ? target.conditions : []), ...action.effect.conditions])];
                await target.save();
                io.to(roomName(session.id)).emit('game:token-condition-updated', { tokenId: target.id, conditions: target.conditions });
            }
        }

        if (action.healing) {
            const next = hpAfterHealing(character, amount);
            character.hp_current = next.hp_current;
            character.hp_temp = next.hp_temp;
            await character.save();
            outcomes.push({ tokenId: target.id, characterId: character.id, name: target.label, outcome: 'healed', amount: next.amount, save });
        } else {
            const retaliation = session.combat_state?.effects?.[character.id]?.retaliation;
            const hadTemporaryHp = Number(character.hp_temp || 0) > 0;
            const saveScale = save?.success ? (action.halfOnSave ? 0.5 : 0) : 1;
            const components = [
                { amount: Math.floor((Number(roll.total) || 0) * reactionMultiplier * saveScale), damageType: action.damageType },
                ...extraRolls.map(extra => ({ amount: Math.floor(extra.total * reactionMultiplier * saveScale), damageType: extra.damageType || action.damageType })),
            ];
            let inflicted = 0;
            let absorbed = 0;
            const mitigations = [];
            for (const component of components) {
                if (component.amount <= 0) continue;
                const next = hpAfterDamage(character, component.amount, component.damageType);
                character.hp_current = next.hp_current;
                character.hp_temp = next.hp_temp;
                inflicted += next.amount;
                absorbed += next.absorbed;
                if (next.modifier) mitigations.push({ damageType: component.damageType, modifier: next.modifier });
            }
            await character.save();
            outcomes.push({ tokenId: target.id, characterId: character.id, name: target.label, outcome: inflicted > 0 ? 'damaged' : 'saved', amount: inflicted, absorbed, mitigations, save });
            if (retaliation && hadTemporaryHp && actorToken?.character && pointDistance(actorToken, target) <= 8) {
                const actorPreviousHp = actorToken.character.hp_current;
                const reflected = hpAfterDamage(actorToken.character, retaliation.damage, retaliation.damageType);
                actorToken.character.hp_current = reflected.hp_current;
                actorToken.character.hp_temp = reflected.hp_temp;
                await actorToken.character.save();
                emitConsciousnessChange(io, session, actorToken, actorPreviousHp, actorToken.character.hp_current);
                outcomes.push({ tokenId: actorToken.id, characterId: actorToken.character_id, name: actorToken.label, outcome: 'retaliation', amount: reflected.amount, damageType: retaliation.damageType });
                io.to(roomName(session.id)).emit('game:token-hp-updated', { tokenId: actorToken.id, characterId: actorToken.character_id, hpCurrent: actorToken.character.hp_current, hpMax: actorToken.character.hp_max, hpTemp: actorToken.character.hp_temp });
            }
        }
        emitConsciousnessChange(io, session, target, previousHp, character.hp_current);
        io.to(roomName(session.id)).emit('game:token-hp-updated', {
            tokenId: target.id,
            characterId: character.id,
            hpCurrent: character.hp_current,
            hpMax: character.hp_max,
            hpTemp: character.hp_temp,
        });
    }
    if (action.secondaryHealing && action.secondaryTargetTokenId) {
        const healingTarget = session.tokens.find(token => String(token.id) === String(action.secondaryTargetTokenId));
        const parsedHealing = parseDiceExpression(action.secondaryHealing);
        if (healingTarget?.character && parsedHealing) {
            const previousHp = healingTarget.character.hp_current;
            const healingResults = Array.from({ length: parsedHealing.quantity }, () => randomInt(1, parsedHealing.sides + 1));
            const healingTotal = healingResults.reduce((sum, value) => sum + value, 0) + parsedHealing.modifier;
            const healed = hpAfterHealing(healingTarget.character, healingTotal);
            healingTarget.character.hp_current = healed.hp_current;
            await healingTarget.character.save();
            emitConsciousnessChange(io, session, healingTarget, previousHp, healingTarget.character.hp_current);
            outcomes.push({ tokenId: healingTarget.id, characterId: healingTarget.character_id, name: healingTarget.label, outcome: 'healed', amount: healed.amount, secondary: true, healingResults });
            io.to(roomName(session.id)).emit('game:token-hp-updated', { tokenId: healingTarget.id, characterId: healingTarget.character_id, hpCurrent: healingTarget.character.hp_current, hpMax: healingTarget.character.hp_max, hpTemp: healingTarget.character.hp_temp });
        }
    }
    const affected = outcomes.filter(item => item.amount > 0).length;
    const narrative = outcomes.map(item => item.outcome === 'healed'
        ? `${item.name} recibe ${item.amount} PG de curación`
        : item.outcome === 'retaliation'
            ? `${item.name} sufre ${item.amount} PG de represalia`
            : `${item.name} sufre ${item.amount} PG de daño`).join(' · ');
    if (narrative) {
        roll.label = narrative.slice(0, 120);
        await roll.save();
    }
    combatAction.status = 'COMPLETED';
    combatAction.result = {
        ...previousResult,
        ...(combatAction.result || {}),
        effectRoll: { total: roll.total, results: roll.results },
        extraRolls,
        targets: outcomes,
        summary: action.healing
            ? `${combatAction.action_name}: ${totalEffect} PG, ${affected} objetivo${affected === 1 ? '' : 's'} curado${affected === 1 ? '' : 's'}.`
            : `${combatAction.action_name}: ${totalEffect} de ${action.damageType || 'daño'}, ${affected} objetivo${affected === 1 ? '' : 's'} afectado${affected === 1 ? '' : 's'}.`,
    };
    await combatAction.save();
    const damagedTarget = targets.find(target => outcomes.some(outcome => String(outcome.tokenId) === String(target.id) && outcome.amount > 0));
    if (damagedTarget && action.effect?.type === 'VEX_NEXT_ATTACK_ADVANTAGE') {
        session.combat_state = { ...(session.combat_state || {}), effectsByTarget: { ...(session.combat_state?.effectsByTarget || {}), [damagedTarget.id]: { nextAttackAdvantage: true, source: 'Vex' } } };
        session.changed('combat_state', true);
        await session.save();
    }
    if (!action.healing && damagedTarget) {
        const reactionOpened = await openReactionWindow(io, session, {
            trigger: REACTION_TRIGGERS.DAMAGE_TAKEN,
            reactorToken: damagedTarget,
            sourceToken: actorToken,
            parentAction: combatAction,
            resumeStatus: 'COMPLETED',
            context: { resumeSummary: combatAction.result.summary },
        });
        if (reactionOpened) return broadcastSession(io, session.id);
    }
    await queueMultiattackFollowup();
    await broadcastSession(io, session.id);
}

function registerGameSessionSocket(io, socket) {
    socket.on('game:get-current', async () => {
        try {
            let session = null;
            if (isDm(socket)) {
                if (socket.gameSessionId) {
                    session = await GameSession.findOne({
                        where: { id: socket.gameSessionId, dm_user_id: socket.user.id, status: { [Op.ne]: 'FINISHED' } },
                    });
                }
                if (!session) {
                    session = await GameSession.findOne({
                        where: { dm_user_id: socket.user.id, status: { [Op.ne]: 'FINISHED' } },
                        order: [['updatedAt', 'DESC']],
                    });
                }
            } else {
                if (socket.gameSessionId) {
                    const activeParticipant = await GameParticipant.findOne({
                        where: { session_id: socket.gameSessionId, user_id: socket.user.id },
                        include: [{ model: GameSession, as: 'session', where: { status: { [Op.ne]: 'FINISHED' } } }],
                    });
                    session = activeParticipant?.session || null;
                }
                if (!session) {
                    const participant = await GameParticipant.findOne({
                        where: { user_id: socket.user.id },
                        include: [{ model: GameSession, as: 'session', where: { status: { [Op.ne]: 'FINISHED' } } }],
                        order: [['updatedAt', 'DESC']],
                    });
                    session = participant?.session || null;
                }
            }

            if (!session) {
                socket.emit('game:state', null);
                return;
            }
            await enterRoom(io, socket, session.id);
        } catch (error) {
            console.error('game:get-current error:', error);
            fail(socket, 'No se pudo recuperar la sala.');
        }
    });

    socket.on('game:list-hosted', async (reply = () => {}) => {
        try {
            if (!isDm(socket)) return reply({ ok: false, message: 'Solo el DM puede administrar mesas.' });
            const sessions = await GameSession.findAll({
                where: { dm_user_id: socket.user.id, status: { [Op.ne]: 'FINISHED' } },
                attributes: ['id', 'title', 'code', 'status', 'round', 'updatedAt'],
                order: [['updatedAt', 'DESC']],
            });
            reply({ ok: true, sessions: sessions.map(item => ({ ...item.toJSON(), isCurrent: Number(item.id) === Number(socket.gameSessionId) })) });
        } catch (error) {
            console.error('game:list-hosted error:', error);
            reply({ ok: false, message: 'No se pudieron cargar tus mesas.' });
        }
    });

    socket.on('game:open-hosted', async ({ sessionId } = {}, reply = () => {}) => {
        try {
            if (!isDm(socket)) return reply({ ok: false, message: 'Solo el DM puede administrar mesas.' });
            const session = await GameSession.findOne({ where: { id: sessionId, dm_user_id: socket.user.id, status: { [Op.ne]: 'FINISHED' } } });
            if (!session) return reply({ ok: false, message: 'La mesa elegida no existe o ya finalizo.' });
            await enterRoom(io, socket, session.id);
            reply({ ok: true, sessionId: session.id, code: session.code });
        } catch (error) {
            console.error('game:open-hosted error:', error);
            reply({ ok: false, message: 'No se pudo abrir la mesa elegida.' });
        }
    });

    socket.on('game:leave-hosted', async (reply = () => {}) => {
        try {
            if (!isDm(socket)) return reply({ ok: false, message: 'Solo el DM puede salir desde este panel.' });
            const sessionId = socket.gameSessionId;
            if (sessionId) {
                const session = await requireHostedSession(socket, sessionId);
                if (!session) return reply({ ok: false, message: 'No tienes permiso para salir de esta mesa.' });
                removePresence(sessionId, socket.user.id, socket.id);
                socket.leave(roomName(sessionId));
                socket.gameSessionId = null;
                await broadcastSession(io, sessionId);
            }
            reply({ ok: true });
        } catch (error) {
            console.error('game:leave-hosted error:', error);
            reply({ ok: false, message: 'No se pudo salir de la mesa.' });
        }
    });

    socket.on('game:list-player-sessions', async (reply = () => {}) => {
        try {
            if (isDm(socket)) return reply({ ok: false, message: 'Este listado es para jugadores.' });
            const participants = await GameParticipant.findAll({
                where: { user_id: socket.user.id },
                attributes: ['id', 'session_id', 'character_id', 'is_ready', 'updatedAt'],
                include: [{ model: GameSession, as: 'session', where: { status: { [Op.ne]: 'FINISHED' } }, attributes: ['id', 'title', 'code', 'status', 'round', 'updatedAt'] }],
                order: [['updatedAt', 'DESC']],
            });
            reply({ ok: true, sessions: participants.map(item => ({ ...item.session.toJSON(), characterId: item.character_id, isReady: item.is_ready, isCurrent: Number(item.session_id) === Number(socket.gameSessionId) })) });
        } catch (error) {
            console.error('game:list-player-sessions error:', error);
            reply({ ok: false, message: 'No se pudieron cargar tus mesas.' });
        }
    });

    socket.on('game:open-player-session', async ({ sessionId } = {}, reply = () => {}) => {
        try {
            if (isDm(socket)) return reply({ ok: false, message: 'El DM abre sus mesas desde su panel.' });
            const participant = await GameParticipant.findOne({
                where: { session_id: sessionId, user_id: socket.user.id },
                include: [{ model: GameSession, as: 'session', where: { status: { [Op.ne]: 'FINISHED' } } }],
            });
            if (!participant?.session) return reply({ ok: false, message: 'No perteneces a esa mesa o ya fue finalizada.' });
            await enterRoom(io, socket, participant.session.id);
            reply({ ok: true, sessionId: participant.session.id });
        } catch (error) {
            console.error('game:open-player-session error:', error);
            reply({ ok: false, message: 'No se pudo abrir la mesa elegida.' });
        }
    });

    socket.on('game:leave-player-session', async (reply = () => {}) => {
        try {
            if (isDm(socket)) return reply({ ok: false, message: 'El DM sale desde su panel.' });
            const sessionId = socket.gameSessionId;
            if (sessionId) {
                const participant = await GameParticipant.findOne({ where: { session_id: sessionId, user_id: socket.user.id } });
                if (!participant) return reply({ ok: false, message: 'No perteneces a esta mesa.' });
                removePresence(sessionId, socket.user.id, socket.id);
                socket.leave(roomName(sessionId));
                socket.gameSessionId = null;
                await broadcastSession(io, sessionId);
            }
            reply({ ok: true });
        } catch (error) {
            console.error('game:leave-player-session error:', error);
            reply({ ok: false, message: 'No se pudo salir de la mesa.' });
        }
    });

    socket.on('game:create', async ({ title, forceNew = false } = {}, reply = () => {}) => {
        try {
            if (!isDm(socket)) {
                const message = 'Sólo el DM puede crear una sala.';
                fail(socket, message);
                return reply({ ok: false, message });
            }
            const existing = await GameSession.findOne({
                where: { dm_user_id: socket.user.id, status: { [Op.ne]: 'FINISHED' } },
                order: [['updatedAt', 'DESC']],
            });
            const session = (!forceNew && existing) ? existing : await GameSession.create({
                code: await makeCode(),
                title: String(title || 'La campaña actual').trim().slice(0, 120),
                dm_user_id: socket.user.id,
            });
            await enterRoom(io, socket, session.id);
            reply({ ok: true, sessionId: session.id, code: session.code });
        } catch (error) {
            console.error('game:create error:', error);
            const message = 'No se pudo crear la sala.';
            fail(socket, message);
            reply({ ok: false, message });
        }
    });

    socket.on('game:join', async ({ code, characterId } = {}) => {
        try {
            if (isDm(socket)) return fail(socket, 'El DM administra la sala desde su panel.');
            const session = await GameSession.findOne({
                where: { code: String(code || '').trim().toUpperCase(), status: { [Op.ne]: 'FINISHED' } },
            });
            if (!session) return fail(socket, 'Código de sala inválido o partida finalizada.');

            const character = characterId
                ? await Character.findOne({ where: { id: characterId, UserId: socket.user.id, is_npc: false } })
                : await Character.findOne({ where: { UserId: socket.user.id, is_npc: false } });
            if (!character) return fail(socket, 'Debes tener un personaje asignado para entrar.');

            const [participant] = await GameParticipant.findOrCreate({
                where: { session_id: session.id, user_id: socket.user.id },
                defaults: { character_id: character.id },
            });
            if (participant.character_id !== character.id) {
                participant.character_id = character.id;
                participant.is_ready = false;
                await participant.save();
            }
            await enterRoom(io, socket, session.id);
        } catch (error) {
            console.error('game:join error:', error);
            fail(socket, 'No se pudo entrar a la sala.');
        }
    });

    socket.on('game:ready', async ({ sessionId, ready } = {}) => {
        const participant = await GameParticipant.findOne({ where: { session_id: sessionId, user_id: socket.user.id } });
        if (!participant) return fail(socket, 'No perteneces a esta sala.');
        participant.is_ready = Boolean(ready);
        await participant.save();
        await broadcastSession(io, sessionId);
    });

    socket.on('game:set-status', async ({ sessionId, status } = {}) => {
        try {
            const session = await requireHostedSession(socket, sessionId);
            if (!session) return fail(socket, 'No tienes permiso para controlar esta sala.');
            if (!['LIVE', 'PAUSED', 'FINISHED'].includes(status)) return;

            if (status === 'LIVE' && session.status === 'WAITING') {
                const participants = await GameParticipant.findAll({ where: { session_id: session.id } });
                if (!participants.length) return fail(socket, 'Debe entrar al menos un jugador.');
                if (participants.some(participant => !participant.is_ready)) return fail(socket, 'Todos los jugadores deben estar listos.');
                const tokens = await GameToken.findAll({ where: { session_id: session.id, visible: true } });
                session.turn_order = [...new Set([
                    ...participants.map(participant => participant.character_id),
                    ...tokens.map(token => token.character_id),
                ].filter(Boolean))];
                session.turn_index = 0;
                session.round = 1;
                session.combat_state = { resources: {} };
                session.changed('combat_state', true);
            }
            session.status = status;
            await session.save();
            await broadcastSession(io, session.id);
        } catch (error) {
            console.error('game:set-status error:', error);
            fail(socket, 'No se pudo cambiar el estado de la partida.');
        }
    });

    socket.on('game:share', async ({ sessionId, type, url, title, gridEnabled, preserveNarrativeLayout } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session) return fail(socket, 'No tienes permiso para compartir contenido.');
        if (!['NONE', 'IMAGE', 'MAP'].includes(type)) return;
        session.shared_type = type;
        session.shared_url = type === 'NONE' ? null : String(url || '').trim();
        session.shared_title = type === 'NONE' ? null : String(title || '').trim().slice(0, 160);
        if (type === 'MAP') session.grid_enabled = Boolean(gridEnabled);
        if (type === 'IMAGE' && !preserveNarrativeLayout) {
            session.narrative_layout = 1;
            session.narrative_panels = session.shared_url ? [{ asset_id: null, url: session.shared_url, title: session.shared_title }] : [];
        }
        await session.save();
        await broadcastSession(io, session.id);
    });

    socket.on('game:update-grid-style', async ({ sessionId, color, lineWidth, enabled, mapFit } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session) return fail(socket, 'No tienes permiso para ajustar la cuadrícula.');
        if (session.shared_type !== 'MAP') return fail(socket, 'La cuadrícula sólo puede configurarse sobre un mapa.');

        const normalizedColor = String(color || '').trim().toLowerCase();
        if (/^#[0-9a-f]{6}$/.test(normalizedColor)) session.grid_color = normalizedColor;
        const normalizedWidth = Number(lineWidth);
        if (Number.isFinite(normalizedWidth)) session.grid_line_width = Math.max(0.25, Math.min(4, normalizedWidth));
        if (typeof enabled === 'boolean') session.grid_enabled = enabled;
        const normalizedMapFit = String(mapFit || '').toUpperCase();
        if (['COVER', 'CONTAIN'].includes(normalizedMapFit)) session.map_fit = normalizedMapFit;
        await session.save();
        await broadcastSession(io, session.id);
    });

    socket.on('game:update-narrative-style', async ({ sessionId, fit, layout, slotIndex, assetId, sceneId, panelUrl, panelTitle, clearSlot } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session) return fail(socket, 'No tienes permiso para ajustar la escena narrativa.');
        if (session.shared_type !== 'IMAGE') return fail(socket, 'El encuadre narrativo sólo puede configurarse sobre una imagen.');
        const normalizedFit = String(fit || '').toUpperCase();
        if (['COVER', 'CONTAIN'].includes(normalizedFit)) session.narrative_fit = normalizedFit;

        const normalizedLayout = Number(layout);
        if (Number.isInteger(normalizedLayout) && normalizedLayout >= 1 && normalizedLayout <= 4) {
            session.narrative_layout = normalizedLayout;
        }

        const normalizedSlot = Number(slotIndex);
        if (Number.isInteger(normalizedSlot) && normalizedSlot >= 0 && normalizedSlot < 4) {
            const panels = Array.isArray(session.narrative_panels) ? [...session.narrative_panels] : [];
            if (clearSlot === true) {
                panels[normalizedSlot] = null;
            } else if (assetId) {
                const asset = await GameAsset.findOne({ where: { id: assetId, owner_user_id: session.dm_user_id } });
                if (!asset) return fail(socket, 'El asset seleccionado no pertenece a tu biblioteca.');
                panels[normalizedSlot] = { asset_id: asset.id, url: asset.url, title: asset.title };
            } else if (sceneId) {
                const scene = await Scene.findByPk(sceneId, { attributes: ['id', 'title', 'imageUrl'] });
                if (!scene?.imageUrl) return fail(socket, 'La escena seleccionada no tiene una imagen válida.');
                panels[normalizedSlot] = {
                    asset_id: null,
                    scene_id: scene.id,
                    url: scene.imageUrl,
                    title: scene.title,
                };
            } else if (panelUrl) {
                panels[normalizedSlot] = {
                    asset_id: null,
                    url: String(panelUrl).trim(),
                    title: String(panelTitle || `Área ${normalizedSlot + 1}`).trim().slice(0, 160),
                };
            } else if (normalizedSlot === 0 && session.shared_url) {
                panels[0] = { asset_id: null, url: session.shared_url, title: session.shared_title };
            } else {
                panels[normalizedSlot] = null;
            }
            session.narrative_panels = panels;
            if (clearSlot === true && !panels.slice(0, session.narrative_layout).some(panel => panel?.url)) {
                session.shared_type = 'NONE';
                session.shared_url = null;
                session.shared_title = null;
            }
        }
        await session.save();
        await broadcastSession(io, session.id);
    });

    socket.on('game:update-audio', async ({ sessionId, action, trackId, position, loop } = {}, reply = () => {}) => {
        try {
            const session = await requireHostedSession(socket, sessionId);
            if (!session) return reply({ ok: false, message: 'No tienes permiso para controlar el audio.' });
            const normalizedAction = String(action || '').toUpperCase();

            if (normalizedAction === 'SELECT') {
                const track = await AudioTrack.findByPk(trackId);
                if (!track) return reply({ ok: false, message: 'El tema seleccionado ya no existe.' });
                session.audio_track_id = track.id;
                session.audio_position_seconds = 0;
                session.audio_status = 'PLAYING';
                session.audio_started_at = new Date();
            } else if (normalizedAction === 'PLAY') {
                if (!session.audio_track_id) return reply({ ok: false, message: 'Selecciona un tema primero.' });
                if (session.audio_status !== 'PLAYING') {
                    session.audio_status = 'PLAYING';
                    session.audio_started_at = new Date();
                }
            } else if (normalizedAction === 'PAUSE') {
                session.audio_position_seconds = currentAudioPosition(session);
                session.audio_status = 'PAUSED';
                session.audio_started_at = null;
            } else if (normalizedAction === 'STOP') {
                session.audio_status = 'STOPPED';
                session.audio_position_seconds = 0;
                session.audio_started_at = null;
            } else if (normalizedAction === 'SEEK') {
                session.audio_position_seconds = Math.max(0, Number(position) || 0);
                session.audio_started_at = session.audio_status === 'PLAYING' ? new Date() : null;
            } else if (normalizedAction === 'LOOP') {
                session.audio_loop = Boolean(loop);
            } else {
                return reply({ ok: false, message: 'Control de audio desconocido.' });
            }

            await session.save();
            await broadcastSession(io, session.id);
            reply({ ok: true });
        } catch (error) {
            console.error('game:update-audio error:', error);
            reply({ ok: false, message: 'No se pudo actualizar el audio de la partida.' });
        }
    });

    socket.on('game:add-annotation', async ({ sessionId, annotation } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session || session.shared_type === 'NONE' || !annotation) return;
        const type = annotation.type === 'path' && session.shared_type === 'MAP' ? 'path' : annotation.type === 'text' ? 'text' : null;
        if (!type) return fail(socket, 'La anotación no es válida para esta vista.');

        const item = {
            id: randomUUID(),
            type,
            view_key: annotationViewKey(session),
            color: validAnnotationColor(annotation.color),
        };
        if (type === 'path') {
            const points = compactPathPoints(annotation.points);
            if (points.length < 2) return;
            item.points = points;
            item.width = Math.max(1, Math.min(18, Number(annotation.width) || 3));
        } else {
            const text = String(annotation.text || '').trim().slice(0, 500);
            if (!text) return;
            item.text = text;
            item.x = clamp(annotation.x);
            item.y = clamp(annotation.y);
            item.size = Math.max(12, Math.min(72, Number(annotation.size) || 28));
            item.background = annotation.background !== false;
        }

        const annotations = Array.isArray(session.stage_annotations) ? [...session.stage_annotations] : [];
        session.stage_annotations = [...annotations.slice(-299), item];
        await session.save();
        io.to(roomName(session.id)).emit('game:annotation-added', { annotation: item });
    });

    socket.on('game:update-annotation', async ({ sessionId, annotationId, x, y, text, color, size, background } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session || !annotationId) return;
        const annotations = Array.isArray(session.stage_annotations) ? [...session.stage_annotations] : [];
        const index = annotations.findIndex(item => item.id === annotationId && item.view_key === annotationViewKey(session));
        if (index < 0 || annotations[index].type !== 'text') return;
        const current = annotations[index];
        const next = { ...current };
        if (x != null) next.x = clamp(x);
        if (y != null) next.y = clamp(y);
        if (text != null) {
            const normalizedText = String(text).trim().slice(0, 500);
            if (!normalizedText) return;
            next.text = normalizedText;
        }
        if (color != null) next.color = validAnnotationColor(color);
        if (size != null) next.size = Math.max(12, Math.min(72, Number(size) || current.size || 28));
        if (typeof background === 'boolean') next.background = background;
        annotations[index] = next;
        session.stage_annotations = annotations;
        await session.save();
        io.to(roomName(session.id)).emit('game:annotation-updated', { annotation: next });
    });

    socket.on('game:delete-annotation', async ({ sessionId, annotationId } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session || !annotationId) return;
        const annotations = Array.isArray(session.stage_annotations) ? session.stage_annotations : [];
        const viewKey = annotationViewKey(session);
        session.stage_annotations = annotations.filter(item => item.id !== annotationId || item.view_key !== viewKey);
        await session.save();
        io.to(roomName(session.id)).emit('game:annotation-deleted', { annotationId, viewKey });
    });

    socket.on('game:clear-annotations', async ({ sessionId } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session) return;
        const viewKey = annotationViewKey(session);
        const annotations = Array.isArray(session.stage_annotations) ? session.stage_annotations : [];
        session.stage_annotations = annotations.filter(item => item.view_key !== viewKey);
        await session.save();
        io.to(roomName(session.id)).emit('game:annotations-cleared', { viewKey });
    });

    socket.on('game:add-vfx', async ({ sessionId, effect } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session || session.shared_type === 'NONE' || !effect) return;
        const type = String(effect.type || '').toLowerCase();
        if (!BOARD_VFX_TYPES.has(type)) return fail(socket, 'Ese efecto visual no está disponible.');
        const loop = effect.loop !== false;
        const duration = Math.max(2, Math.min(60, Number(effect.duration) || 8));
        const shape = BOARD_VFX_SHAPES.has(effect.shape) ? effect.shape : 'point';
        const x = clamp(effect.x);
        const y = clamp(effect.y);
        const startedAt = new Date();
        const item = {
            id: randomUUID(),
            type,
            view_key: annotationViewKey(session),
            shape,
            x,
            y,
            end_x: shape === 'point' ? x : clamp(effect.end_x),
            end_y: shape === 'point' ? y : clamp(effect.end_y),
            size: Math.max(60, Math.min(360, Number(effect.size) || 170)),
            intensity: Math.max(0.45, Math.min(1.45, Number(effect.intensity) || 1)),
            loop,
            duration,
            started_at: startedAt.toISOString(),
            expires_at: loop ? null : new Date(startedAt.getTime() + duration * 1000).toISOString(),
        };
        const current = Array.isArray(session.stage_vfx) ? session.stage_vfx : [];
        session.stage_vfx = [...current.slice(-47), item];
        await session.save();
        io.to(roomName(session.id)).emit('game:vfx-added', { effect: item });

        if (!loop) {
            setTimeout(async () => {
                try {
                    const fresh = await GameSession.findByPk(session.id);
                    if (!fresh) return;
                    const effects = Array.isArray(fresh.stage_vfx) ? fresh.stage_vfx : [];
                    if (!effects.some(candidate => candidate.id === item.id)) return;
                    fresh.stage_vfx = effects.filter(candidate => candidate.id !== item.id);
                    await fresh.save();
                    io.to(roomName(session.id)).emit('game:vfx-deleted', { effectId: item.id, viewKey: item.view_key });
                } catch (error) {
                    console.error('game:vfx-expiry error:', error);
                }
            }, duration * 1000);
        }
    });

    socket.on('game:update-vfx', async ({ sessionId, effectId, x, y, end_x, end_y, size, intensity } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session || !effectId) return;
        const effects = Array.isArray(session.stage_vfx) ? [...session.stage_vfx] : [];
        const index = effects.findIndex(effect => effect.id === effectId && effect.view_key === annotationViewKey(session));
        if (index < 0) return;
        const next = { ...effects[index] };
        if (x != null) next.x = clamp(x);
        if (y != null) next.y = clamp(y);
        if (end_x != null) next.end_x = clamp(end_x);
        if (end_y != null) next.end_y = clamp(end_y);
        if (size != null) next.size = Math.max(60, Math.min(360, Number(size) || next.size));
        if (intensity != null) next.intensity = Math.max(0.45, Math.min(1.45, Number(intensity) || next.intensity));
        effects[index] = next;
        session.stage_vfx = effects;
        await session.save();
        io.to(roomName(session.id)).emit('game:vfx-updated', { effect: next });
    });

    socket.on('game:delete-vfx', async ({ sessionId, effectId } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session || !effectId) return;
        const viewKey = annotationViewKey(session);
        const effects = Array.isArray(session.stage_vfx) ? session.stage_vfx : [];
        session.stage_vfx = effects.filter(effect => effect.id !== effectId || effect.view_key !== viewKey);
        await session.save();
        io.to(roomName(session.id)).emit('game:vfx-deleted', { effectId, viewKey });
    });

    socket.on('game:clear-vfx', async ({ sessionId } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session) return;
        const viewKey = annotationViewKey(session);
        const effects = Array.isArray(session.stage_vfx) ? session.stage_vfx : [];
        session.stage_vfx = effects.filter(effect => effect.view_key !== viewKey);
        await session.save();
        io.to(roomName(session.id)).emit('game:vfx-cleared', { viewKey });
    });

    socket.on('game:toggle-scene-npc', async ({ sessionId, characterId } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session) return fail(socket, 'No tienes permiso para controlar el elenco de la escena.');
        const normalizedId = Number(characterId);
        if (!Number.isInteger(normalizedId)) return;
        const character = await Character.findOne({ where: { id: normalizedId, is_npc: true } });
        if (!character) return fail(socket, 'NPC no encontrado.');

        const currentIds = Array.isArray(session.scene_npc_ids)
            ? session.scene_npc_ids.map(Number).filter(Number.isInteger)
            : [];
        if (currentIds.includes(normalizedId)) {
            session.scene_npc_ids = currentIds.filter(id => id !== normalizedId);
            if (session.speaking_npc_id === normalizedId) session.speaking_npc_id = null;
        } else {
            session.scene_npc_ids = [...currentIds, normalizedId];
        }
        await session.save();
        await broadcastSession(io, session.id);
    });

    socket.on('game:set-scene-speaker', async ({ sessionId, characterId } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session) return fail(socket, 'No tienes permiso para controlar al hablante.');
        const normalizedId = characterId == null ? null : Number(characterId);
        const currentIds = Array.isArray(session.scene_npc_ids)
            ? session.scene_npc_ids.map(Number).filter(Number.isInteger)
            : [];
        if (normalizedId != null && (!Number.isInteger(normalizedId) || !currentIds.includes(normalizedId))) {
            return fail(socket, 'El NPC debe estar visible antes de hablar.');
        }
        session.speaking_npc_id = session.speaking_npc_id === normalizedId ? null : normalizedId;
        await session.save();
        await broadcastSession(io, session.id);
    });

    socket.on('game:save-asset', async ({ sessionId, title, url, type, gridEnabled } = {}, reply = () => {}) => {
        try {
            const session = await requireHostedSession(socket, sessionId);
            if (!session) return reply({ ok: false, message: 'No tienes permiso para preparar assets en esta sala.' });
            const normalizedType = ['IMAGE', 'MAP'].includes(type) ? type : 'IMAGE';
            const normalizedUrl = String(url || '').trim();
            if (!normalizedUrl) return reply({ ok: false, message: 'El asset necesita una imagen.' });
            const maxOrder = await GameAsset.max('sort_order', { where: { owner_user_id: session.dm_user_id } });
            const asset = await GameAsset.create({
                session_id: session.id,
                owner_user_id: session.dm_user_id,
                title: String(title || 'Contenido sin título').trim().slice(0, 160),
                url: normalizedUrl,
                type: normalizedType,
                grid_enabled: normalizedType === 'MAP' && Boolean(gridEnabled),
                sort_order: Number.isFinite(maxOrder) ? maxOrder + 1 : 0,
            });
            await broadcastSession(io, session.id);
            reply({ ok: true, asset: asset.toJSON() });
        } catch (error) {
            console.error('game:save-asset error:', error);
            reply({ ok: false, message: 'No se pudo guardar el asset.' });
        }
    });

    socket.on('game:reorder-assets', async ({ sessionId, assetIds } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session || !Array.isArray(assetIds)) return;
        const assets = await GameAsset.findAll({ where: { owner_user_id: session.dm_user_id, id: assetIds } });
        const orderById = new Map(assetIds.map((id, index) => [id, index]));
        await Promise.all(assets.map(asset => asset.update({ sort_order: orderById.get(asset.id) })));
        await broadcastSession(io, session.id);
    });

    socket.on('game:delete-asset', async ({ sessionId, assetId } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session) return;
        await GameAsset.destroy({ where: { id: assetId, owner_user_id: session.dm_user_id } });
        await broadcastSession(io, session.id);
    });

    socket.on('game:next-turn', async ({ sessionId } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session || !session.turn_order?.length) return;
        if (session.combat_state?.awaitingInitiative) return fail(socket, 'Aun faltan tiradas de iniciativa.');
        if (await hasPendingCombatAction(session.id)) return fail(socket, 'Hay una acción de combate pendiente. Resuélvela o cancélala desde el registro de combate.');
        const nextIndex = session.turn_index + 1;
        if (nextIndex >= session.turn_order.length) {
            session.turn_index = 0;
            session.round += 1;
        } else {
            session.turn_index = nextIndex;
        }
        session.combat_state = refreshTurnReaction(session.combat_state || {}, session.turn_order[session.turn_index]);
        await rollTurnRecharges(session, session.turn_order[session.turn_index]);
        session.changed('combat_state', true);
        await session.save();
        io.to(roomName(session.id)).emit('game:turn-updated', {
            round: session.round,
            turnIndex: session.turn_index,
            activeCharacterId: session.turn_order[session.turn_index] || null,
            turnOrder: session.turn_order,
        });
    });

    socket.on('game:previous-turn', async ({ sessionId } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session || !session.turn_order?.length) return;
        if (session.combat_state?.awaitingInitiative) return fail(socket, 'Aun faltan tiradas de iniciativa.');
        if (await hasPendingCombatAction(session.id)) return fail(socket, 'Hay una acción de combate pendiente. Resuélvela o cancélala desde el registro de combate.');
        if (session.turn_index <= 0) {
            session.turn_index = session.turn_order.length - 1;
            session.round = Math.max(1, session.round - 1);
        } else {
            session.turn_index -= 1;
        }
        session.combat_state = refreshTurnReaction(session.combat_state || {}, session.turn_order[session.turn_index]);
        await rollTurnRecharges(session, session.turn_order[session.turn_index]);
        session.changed('combat_state', true);
        await session.save();
        io.to(roomName(session.id)).emit('game:turn-updated', {
            round: session.round,
            turnIndex: session.turn_index,
            activeCharacterId: session.turn_order[session.turn_index] || null,
            turnOrder: session.turn_order,
        });
    });

    socket.on('game:set-turn', async ({ sessionId, characterId } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session) return;
        if (session.combat_state?.awaitingInitiative) return fail(socket, 'Aun faltan tiradas de iniciativa.');
        if (await hasPendingCombatAction(session.id)) return fail(socket, 'Hay una acción de combate pendiente. Resuélvela o cancélala desde el registro de combate.');
        const normalizedId = Number(characterId);
        let turnIndex = session.turn_order.map(Number).indexOf(normalizedId);
        if (turnIndex < 0) {
            const [participant, token] = await Promise.all([
                GameParticipant.findOne({ where: { session_id: session.id, character_id: normalizedId }, attributes: ['id'] }),
                GameToken.findOne({ where: { session_id: session.id, character_id: normalizedId, visible: true }, attributes: ['id'] }),
            ]);
            if (!participant && !token) return fail(socket, 'Ese personaje no está en la iniciativa.');
            session.turn_order = [...session.turn_order, normalizedId];
            turnIndex = session.turn_order.length - 1;
        }
        session.turn_index = turnIndex;
        session.combat_state = refreshTurnReaction(session.combat_state || {}, session.turn_order[session.turn_index]);
        await rollTurnRecharges(session, session.turn_order[session.turn_index]);
        session.changed('combat_state', true);
        await session.save();
        io.to(roomName(session.id)).emit('game:turn-updated', {
            round: session.round,
            turnIndex: session.turn_index,
            activeCharacterId: session.turn_order[session.turn_index] || null,
            turnOrder: session.turn_order,
        });
    });

    socket.on('game:update-turn-order', async ({ sessionId, turnOrder } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session || !Array.isArray(turnOrder)) return;
        if (session.combat_state?.awaitingInitiative) return fail(socket, 'Espera a que termine la fase de iniciativa.');
        const participants = await GameParticipant.findAll({ where: { session_id: session.id }, attributes: ['character_id'] });
        const tokens = await GameToken.findAll({ where: { session_id: session.id, visible: true }, attributes: ['character_id'] });
        const availableIds = [...new Set([
            ...participants.map(item => Number(item.character_id)),
            ...tokens.map(item => Number(item.character_id)),
        ].filter(Number.isInteger))];
        const allowedIds = new Set(availableIds);
        const requestedIds = [...new Set(turnOrder.map(Number).filter(id => Number.isInteger(id) && allowedIds.has(id)))];
        const nextOrder = [...requestedIds, ...availableIds.filter(id => !requestedIds.includes(id))];
        const activeCharacterId = session.turn_order?.[session.turn_index] ?? null;
        session.turn_order = nextOrder;
        session.turn_index = Math.max(0, nextOrder.indexOf(Number(activeCharacterId)));
        await session.save();
        io.to(roomName(session.id)).emit('game:turn-updated', {
            round: session.round,
            turnIndex: session.turn_index,
            activeCharacterId: session.turn_order[session.turn_index] || null,
            turnOrder: session.turn_order,
        });
    });

    socket.on('game:create-token', async ({ sessionId, characterId, x = 50, y = 50 } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session) return fail(socket, 'No tienes permiso para crear tokens.');
        const character = await Character.findByPk(characterId);
        if (!character) return fail(socket, 'Personaje no encontrado.');
        const controllingCharacterId = character.npc_type === 'compañero' && character.owner_id
            ? character.owner_id
            : character.id;
        const participant = await GameParticipant.findOne({ where: { session_id: sessionId, character_id: controllingCharacterId } });
        const [token] = await GameToken.findOrCreate({
            where: { session_id: sessionId, character_id: character.id },
            defaults: {
                owner_user_id: participant?.user_id || null,
                label: character.name,
                image_url: resolveCharacterImage(character),
                x: clamp(x),
                y: clamp(y),
            },
        });
        if (!token.owner_user_id && participant?.user_id) {
            token.owner_user_id = participant.user_id;
            await token.save();
        }
        if (!token.image_url) {
            token.image_url = resolveCharacterImage(character);
            await token.save();
        }
        await addAutomaticInitiative(session, character);
        await broadcastSession(io, session.id);
    });

    socket.on('game:create-npc-token', async ({ sessionId, name, hpMax, armorClass, imageUrl, npcType } = {}, reply = () => {}) => {
        try {
            const session = await requireHostedSession(socket, sessionId);
            if (!session) return reply({ ok: false, message: 'No tienes permiso para crear NPCs en esta sala.' });
            const normalizedName = String(name || '').trim().slice(0, 120);
            if (!normalizedName) return reply({ ok: false, message: 'El NPC necesita un nombre.' });
            const hp = Math.max(1, Number.parseInt(hpMax, 10) || 10);
            const ac = Math.max(1, Number.parseInt(armorClass, 10) || 10);
            const allowedTypes = ['neutral', 'amigo', 'compañero', 'enemigo'];
            const type = allowedTypes.includes(npcType) ? npcType : 'enemigo';
            const character = await Character.create({
                name: normalizedName,
                race: 'Criatura',
                class: 'NPC',
                is_npc: true,
                npc_type: type,
                hp_current: hp,
                hp_max: hp,
                ac_base: ac,
                image_url: String(imageUrl || '').trim() || null,
            });
            const token = await GameToken.create({
                session_id: session.id,
                character_id: character.id,
                owner_user_id: null,
                label: character.name,
                image_url: resolveCharacterImage(character),
                color: type === 'enemigo' ? '#C2452F' : type === 'amigo' || type === 'compañero' ? '#5BA86B' : '#C8A36A',
                x: 50,
                y: 50,
            });
            await addAutomaticInitiative(session, character);
            await broadcastSession(io, session.id);
            reply({ ok: true, character: character.toJSON(), token: token.toJSON() });
        } catch (error) {
            console.error('game:create-npc-token error:', error);
            reply({ ok: false, message: 'No se pudo crear la ficha y el token del NPC.' });
        }
    });

    socket.on('game:move-token', async ({ sessionId, tokenId, x, y } = {}) => {
        const session = await loadSession(sessionId);
        const token = session?.tokens?.find(item => String(item.id) === String(tokenId));
        if (!session || !token || token.locked) return;
        const dmControl = isDm(socket) && session.dm_user_id === socket.user.id;
        const activeCharacterId = session.turn_order?.[session.turn_index] ?? null;
        const playerControl = session.status === 'LIVE'
            && token.owner_user_id === socket.user.id
            && (session.combat_state?.mode !== 'COMBAT' || token.character_id === activeCharacterId);
        if (!dmControl && !playerControl) return fail(socket, 'Sólo puedes mover tu token durante tu turno.');

        if (session.combat_state?.mode === 'COMBAT' && !activeReactionWindow(session)) {
            const destination = { x: clamp(x), y: clamp(y) };
            let reactionOpened = false;
            for (const reactorToken of session.tokens.filter(item => item.visible && item.character && String(item.id) !== String(token.id))) {
                if (!validRelationship({ target: 'enemy' }, reactorToken, token)) continue;
                const wasInReach = pointDistance(reactorToken, token) <= 8;
                const leavesReach = pointDistance(reactorToken, destination) > 8;
                if (!wasInReach || !leavesReach) continue;
                const opened = await openReactionWindow(io, session, {
                    trigger: REACTION_TRIGGERS.ENEMY_LEAVES_REACH,
                    reactorToken,
                    sourceToken: token,
                    context: { pendingMove: { tokenId: token.id, x: destination.x, y: destination.y } },
                });
                if (opened) reactionOpened = true;
            }
            if (reactionOpened) {
                await broadcastSession(io, session.id);
                return;
            }
        }

        token.x = clamp(x);
        token.y = clamp(y);
        await token.save();
        io.to(roomName(session.id)).emit('game:token-moved', { tokenId: token.id, x: token.x, y: token.y });
    });

    socket.on('game:move-tokens', async ({ sessionId, moves } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session || !Array.isArray(moves) || !moves.length) return;
        const tokenIds = moves.map(move => move.tokenId).filter(Boolean);
        const tokens = await GameToken.findAll({ where: { id: tokenIds, session_id: sessionId, locked: false } });
        const positions = new Map(moves.map(move => [move.tokenId, move]));
        await Promise.all(tokens.map(token => {
            const position = positions.get(token.id);
            token.x = clamp(position.x);
            token.y = clamp(position.y);
            return token.save();
        }));
        io.to(roomName(session.id)).emit('game:tokens-moved', {
            moves: tokens.map(token => ({ tokenId: token.id, x: token.x, y: token.y })),
        });
    });

    socket.on('game:adjust-token-hp', async ({ sessionId, tokenId, delta } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session) return;
        const token = await GameToken.findOne({ where: { id: tokenId, session_id: sessionId } });
        const character = token?.character_id ? await Character.findByPk(token.character_id) : null;
        if (!token || !character) return;
        const previousHp = character.hp_current;
        character.hp_current = Math.max(0, Math.min(character.hp_max || 1, (character.hp_current || 0) + Number(delta || 0)));
        await character.save();
        emitConsciousnessChange(io, session, token, previousHp, character.hp_current);
        io.to(roomName(session.id)).emit('game:token-hp-updated', {
            tokenId: token.id,
            characterId: character.id,
            hpCurrent: character.hp_current,
            hpMax: character.hp_max,
            hpTemp: character.hp_temp,
        });
    });

    socket.on('game:set-token-hp', async ({ sessionId, tokenId, hp } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session) return;
        const token = await GameToken.findOne({ where: { id: tokenId, session_id: sessionId } });
        const character = token?.character_id ? await Character.findByPk(token.character_id) : null;
        if (!token || !character) return;
        const requestedHp = Number.parseInt(hp, 10);
        if (!Number.isFinite(requestedHp)) return;
        const previousHp = character.hp_current;
        character.hp_current = Math.max(0, Math.min(character.hp_max || 1, requestedHp));
        await character.save();
        emitConsciousnessChange(io, session, token, previousHp, character.hp_current);
        io.to(roomName(session.id)).emit('game:token-hp-updated', {
            tokenId: token.id,
            characterId: character.id,
            hpCurrent: character.hp_current,
            hpMax: character.hp_max,
            hpTemp: character.hp_temp,
        });
    });

    socket.on('game:toggle-token-condition', async ({ sessionId, tokenId, condition } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session) return;
        const token = await GameToken.findOne({ where: { id: tokenId, session_id: sessionId } });
        const normalized = String(condition || '').trim().slice(0, 40);
        if (!token || !normalized) return;
        const conditions = Array.isArray(token.conditions) ? token.conditions : [];
        token.conditions = conditions.includes(normalized)
            ? conditions.filter(item => item !== normalized)
            : [...conditions, normalized];
        await token.save();
        io.to(roomName(session.id)).emit('game:token-condition-updated', {
            tokenId: token.id,
            conditions: token.conditions,
        });
    });

    socket.on('game:duplicate-token', async ({ sessionId, tokenId } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session) return;
        const source = await GameToken.findOne({ where: { id: tokenId, session_id: sessionId }, include: [{ model: Character, as: 'character' }] });
        if (!source) return;

        let characterId = source.character_id;
        let initiativeCharacter = source.character;
        if (source.character?.is_npc) {
            const data = source.character.toJSON();
            delete data.id;
            delete data.createdAt;
            delete data.updatedAt;
            delete data.UserId;
            const clone = await Character.create({ ...data, UserId: null });
            characterId = clone.id;
            initiativeCharacter = clone;
        }

        await GameToken.create({
            session_id: session.id,
            character_id: characterId,
            owner_user_id: null,
            label: source.label,
            image_url: source.image_url,
            color: source.color,
            x: clamp(source.x + 5),
            y: clamp(source.y + 5),
            size: source.size,
            locked: false,
            visible: source.visible,
            conditions: Array.isArray(source.conditions) ? source.conditions : [],
        });
        await addAutomaticInitiative(session, initiativeCharacter);
        await broadcastSession(io, session.id);
    });

    socket.on('game:delete-token', async ({ sessionId, tokenId } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session) return;
        const token = await GameToken.findOne({ where: { id: tokenId, session_id: sessionId }, attributes: ['character_id'] });
        await GameToken.destroy({ where: { id: tokenId, session_id: sessionId } });
        if (token?.character_id && session.turn_order.map(Number).includes(Number(token.character_id))) {
            const [remainingToken, participant] = await Promise.all([
                GameToken.findOne({ where: { session_id: sessionId, character_id: token.character_id, visible: true }, attributes: ['id'] }),
                GameParticipant.findOne({ where: { session_id: sessionId, character_id: token.character_id }, attributes: ['id'] }),
            ]);
            if (!remainingToken && !participant) {
                const activeCharacterId = session.turn_order[session.turn_index] ?? null;
                session.turn_order = session.turn_order.filter(id => Number(id) !== Number(token.character_id));
                session.turn_index = Math.max(0, session.turn_order.map(Number).indexOf(Number(activeCharacterId)));
                const state = { ...(session.combat_state || {}) };
                const entries = { ...(state.initiative || {}) };
                delete entries[token.character_id];
                session.combat_state = {
                    ...state,
                    initiative: entries,
                    pendingInitiative: (state.pendingInitiative || []).map(Number).filter(id => id !== Number(token.character_id)),
                };
                session.combat_state.awaitingInitiative = session.combat_state.pendingInitiative.length > 0;
                session.changed('combat_state', true);
                await session.save();
            }
        }
        await broadcastSession(io, session.id);
    });

    socket.on('game:set-combat-mode', async ({ sessionId, mode } = {}, reply = () => {}) => {
        try {
            const session = await requireHostedSession(socket, sessionId);
            if (!session) return reply({ ok: false, message: 'No tienes permiso para controlar esta sala.' });
            const nextMode = String(mode || '').toUpperCase();
            if (!['NARRATIVE', 'COMBAT'].includes(nextMode)) return reply({ ok: false, message: 'Modo de partida inválido.' });
            if (await hasPendingCombatAction(session.id)) return reply({ ok: false, message: 'Hay una acción resolviéndose. Termínala o cancélala antes de cambiar de modo.' });

            if (nextMode === 'COMBAT') {
                const [participants, tokens] = await Promise.all([
                    GameParticipant.findAll({ where: { session_id: session.id }, attributes: ['character_id'] }),
                    GameToken.findAll({ where: { session_id: session.id, visible: true }, attributes: ['character_id'] }),
                ]);
                if (!combatantIds(participants, tokens).length) return reply({ ok: false, message: 'Agrega al menos un token o jugador antes de iniciar combate.' });
                await initializeInitiative(session, participants, tokens);
                await session.save();
                io.to(roomName(session.id)).emit('game:initiative-requested', { sessionId: session.id, round: session.round });
            } else {
                session.turn_order = [];
                session.turn_index = 0;
                session.combat_state = { resources: { ...(session.combat_state?.resources || {}) }, mode: 'NARRATIVE' };
                session.changed('combat_state', true);
                await session.save();
                io.to(roomName(session.id)).emit('game:combat-ended', { sessionId: session.id });
            }
            await broadcastSession(io, session.id);
            reply({ ok: true, mode: nextMode });
        } catch (error) {
            console.error('game:set-combat-mode error:', error);
            reply({ ok: false, message: 'No se pudo cambiar el modo de partida.' });
        }
    });

    socket.on('game:complete-initiative', async ({ sessionId } = {}, reply = () => {}) => {
        try {
            const session = await requireHostedSession(socket, sessionId);
            if (!session) return reply({ ok: false, message: 'No tienes permiso para controlar esta sala.' });
            if (session.combat_state?.mode !== 'COMBAT' || !session.combat_state?.awaitingInitiative) {
                return reply({ ok: false, message: 'No hay tiradas de iniciativa pendientes.' });
            }
            const pending = [...new Set((session.combat_state.pendingInitiative || []).map(Number).filter(Number.isInteger))];
            const characters = await Character.findAll({
                where: { id: pending },
                attributes: ['id', 'is_npc', 'initiative_bonus'],
                include: [{ model: AbilityScore, as: 'abilityScores', separate: true }],
            });
            const entries = { ...(session.combat_state.initiative || {}) };
            for (const character of characters) {
                entries[character.id] = initiativeEntry(character, randomInt(1, 21), 'dm');
            }
            session.turn_order = orderByInitiative(entries, session.turn_order);
            session.turn_index = 0;
            session.combat_state = {
                ...(session.combat_state || {}),
                initiative: entries,
                pendingInitiative: [],
                awaitingInitiative: false,
            };
            session.changed('combat_state', true);
            await session.save();
            await broadcastSession(io, session.id);
            reply({ ok: true, turnOrder: session.turn_order });
        } catch (error) {
            console.error('game:complete-initiative error:', error);
            reply({ ok: false, message: 'No se pudieron completar las iniciativas pendientes.' });
        }
    });

    socket.on('game:get-actions', async ({ sessionId, characterId = null } = {}, reply = () => {}) => {
        try {
            const session = await GameSession.findByPk(sessionId);
            if (!session) return reply({ ok: false, message: 'La mesa ya no está disponible.' });
            if (session.combat_state?.awaitingInitiative) return reply({ ok: false, message: 'Aún faltan tiradas de iniciativa.' });
            const participant = await GameParticipant.findOne({ where: { session_id: session.id, user_id: socket.user.id } });
            const actorCharacterId = isDm(socket)
                ? Number(characterId || session.turn_order?.[session.turn_index])
                : Number(participant?.character_id);
            if (!actorCharacterId || (!isDm(socket) && !participant)) return reply({ ok: false, message: 'No formas parte de esta mesa.' });
            if (isDm(socket)) {
                const controlledToken = await GameToken.findOne({ where: { session_id: session.id, character_id: actorCharacterId, owner_user_id: null, visible: true } });
                if (!controlledToken) return reply({ ok: false, message: 'Ese personaje no está controlado por el DM en esta mesa.' });
            }
            const catalog = await buildActionCatalog(actorCharacterId);
            if (!catalog) return reply({ ok: false, message: 'No se encontró el combatiente activo.' });
            const active = Number(session.turn_order?.[session.turn_index]) === actorCharacterId;
            const actions = decorateActions(catalog.actions, catalog.character, session).map(action => (active || action.economy === 'reaction') ? action : ({ ...action, available: false, unavailableReason: 'Todavía no es tu turno.' }));
            reply({ ok: true, characterId: actorCharacterId, actions, combatState: currentCombatState(session, actorCharacterId), resourceSummary: { spellSlots: catalog.character.spell_slots || {}, trackers: customTrackers(catalog.character, session) } });
        } catch (error) {
            console.error('game:get-actions error:', error);
            reply({ ok: false, message: 'No se pudieron preparar tus acciones.' });
        }
    });

    socket.on('game:adjust-tracker', async ({ sessionId, characterId: requestedCharacterId = null, trackerKey, delta } = {}, reply = () => {}) => {
        try {
            const session = await GameSession.findByPk(sessionId);
            if (!session) return reply({ ok: false, message: 'La mesa ya no está disponible.' });
            const participant = await GameParticipant.findOne({ where: { session_id: session.id, user_id: socket.user.id } });
            const characterId = isDm(socket) ? Number(requestedCharacterId || session.turn_order?.[session.turn_index]) : Number(participant?.character_id);
            if (!characterId || (!isDm(socket) && !participant)) return reply({ ok: false, message: 'No formas parte de esta mesa.' });
            if (isDm(socket)) {
                const controlledToken = await GameToken.findOne({ where: { session_id: session.id, character_id: characterId, owner_user_id: null, visible: true } });
                if (!controlledToken) return reply({ ok: false, message: 'Ese personaje no está controlado por el DM en esta mesa.' });
            }
            const catalog = await buildActionCatalog(characterId);
            const tracker = customTrackers(catalog.character, session).find(item => item.key === trackerKey);
            if (!tracker) return reply({ ok: false, message: 'Ese rastreador no está configurado.' });
            const adjustment = Math.max(-99, Math.min(99, Number(delta) || 0));
            const resourceKey = `${characterId}:tracker:${tracker.key}`;
            const resources = { ...(session.combat_state?.resources || {}) };
            resources[resourceKey] = Math.max(0, Math.min(tracker.max, tracker.value + adjustment));
            session.combat_state = { ...(session.combat_state || {}), resources };
            session.changed('combat_state', true);
            await session.save();
            await broadcastSession(io, session.id);
            reply({ ok: true, value: resources[resourceKey] });
        } catch (error) {
            console.error('game:adjust-tracker error:', error);
            reply({ ok: false, message: 'No se pudo actualizar el rastreador.' });
        }
    });

    socket.on('game:resolve-reaction', async ({ sessionId, windowId, actionKey = null } = {}, reply = () => {}) => {
        try {
            const result = await resolveReactionWindow(io, sessionId, windowId, actionKey, socket.user.id);
            reply(result);
        } catch (error) {
            console.error('game:resolve-reaction error:', error);
            reply({ ok: false, message: 'No se pudo resolver la reacción.' });
        }
    });

    socket.on('game:begin-action', async ({ sessionId, characterId: requestedCharacterId = null, actionKey, targetTokenIds = [], secondaryTargetTokenId = null, area = null, slotLevel = null } = {}, reply = () => {}) => {
        try {
            const requestKey = `${socket.id}:${sessionId}:${requestedCharacterId || 'active'}:${actionKey}`;
            const now = Date.now();
            if (now - Number(recentActionRequests.get(requestKey) || 0) < 1200) return reply({ ok: false, message: 'La acción ya se está procesando.' });
            recentActionRequests.set(requestKey, now);
            setTimeout(() => recentActionRequests.delete(requestKey), 1500);
            const session = await loadSession(sessionId);
            if (!session || session.status !== 'LIVE') return reply({ ok: false, message: 'La partida no está en vivo.' });
            if (session.combat_state?.mode !== 'COMBAT') return reply({ ok: false, message: 'Las acciones de combate se habilitan al iniciar combate.' });
            if (session.combat_state?.awaitingInitiative) return reply({ ok: false, message: 'Aún faltan tiradas de iniciativa.' });
            const participant = await GameParticipant.findOne({ where: { session_id: session.id, user_id: socket.user.id } });
            const activeCharacterId = Number(session.turn_order?.[session.turn_index]);
            const actorCharacterId = isDm(socket) ? Number(requestedCharacterId || activeCharacterId) : Number(participant?.character_id);
            if (!actorCharacterId || (!isDm(socket) && !participant)) return reply({ ok: false, message: 'No formas parte de esta mesa.' });
            if (isDm(socket)) {
                const controlledToken = session.tokens.find(token => token.visible && !token.owner_user_id && Number(token.character_id) === actorCharacterId);
                if (!controlledToken) return reply({ ok: false, message: 'Ese personaje no está controlado por el DM en esta mesa.' });
            }
            const pending = await GameCombatAction.findOne({
                where: { session_id: session.id, actor_character_id: actorCharacterId, status: { [Op.in]: ['ATTACK_ROLL', 'DAMAGE_READY', 'EFFECT_ROLL'] } },
            });
            if (pending) return reply({ ok: false, message: 'Ya hay una acción esperando el resultado de los dados.' });

            const catalog = await buildActionCatalog(actorCharacterId);
            if (!catalog) return reply({ ok: false, message: 'No se encontró el combatiente activo.' });
            const decorated = decorateActions(catalog.actions, catalog.character, session);
            const action = decorated.find(item => item.key === actionKey);
            if (!action) return reply({ ok: false, message: 'Esa acción ya no está disponible.' });
            const reactionWindow = activeReactionWindow(session);
            if (action.economy === 'reaction' && reactionWindow?.options?.some(option => option.key === action.key)) {
                const result = await resolveReactionWindow(io, session.id, reactionWindow.id, action.key, socket.user.id);
                return reply(result);
            }
            if (actorCharacterId !== activeCharacterId && action.economy !== 'reaction') return reply({ ok: false, message: 'Todavía no es tu turno.' });
            if (!action.available) return reply({ ok: false, message: action.unavailableReason || 'No puedes usar esa acción ahora.' });

            const actorToken = session.tokens.find(token => token.visible && Number(token.character_id) === actorCharacterId);
            if (!actorToken) return reply({ ok: false, message: 'Tu personaje necesita un token visible en el tablero.' });
            const targets = resolveTargetTokens(action, actorToken, session.tokens, targetTokenIds, area);
            if (!targets.length) return reply({ ok: false, message: String(action.target).startsWith('area-') ? 'El área no contiene objetivos válidos.' : 'Selecciona un objetivo válido.' });
            let secondaryTarget = null;
            if (action.secondaryHealing) {
                secondaryTarget = resolveTargetTokens({ target: 'ally', range: action.secondaryHealingRange || 15 }, actorToken, session.tokens, [secondaryTargetTokenId], null)[0];
                if (!secondaryTarget) return reply({ ok: false, message: `Selecciona una criatura aliada a ${action.secondaryHealingRange || 15} pies para recibir la curación.` });
            }
            if (action.movement) {
                if (!area || !Number.isFinite(Number(area.x)) || !Number.isFinite(Number(area.y))) return reply({ ok: false, message: 'Marca un destino válido en el tablero.' });
                if (pointDistance(actorToken, area) > Math.max(8, Number(action.movement.maxFeet || 5) * 0.8)) return reply({ ok: false, message: `El destino supera los ${action.movement.maxFeet} pies.` });
            }

            const beforeState = {
                actor: {
                    characterId: catalog.character.id,
                    spellSlots: JSON.parse(JSON.stringify(catalog.character.spell_slots || {})),
                    featureActionId: action.resource?.type === 'feature-use' ? action.resource.actionId : null,
                    featureUsedUses: action.resource?.type === 'feature-use' ? action.resource.used : null,
                },
                targets: targets.map(token => ({
                    tokenId: token.id,
                    characterId: token.character.id,
                    hpCurrent: token.character.hp_current,
                    hpMax: token.character.hp_max,
                    hpTemp: token.character.hp_temp,
                })),
                combatState: JSON.parse(JSON.stringify(session.combat_state || {})),
            };

            // Una reacción puede pertenecer a un NPC fuera de turno. En ese
            // caso no debe reemplazar el actor ni borrar la economía usada por
            // el combatiente activo; sólo comparte recursos y reacciones.
            const combatState = actorCharacterId !== activeCharacterId && action.economy === 'reaction'
                ? {
                    ...(session.combat_state || {}),
                    used: { ...(session.combat_state?.used || {}) },
                    resources: { ...(session.combat_state?.resources || {}) },
                    reactions: { ...(session.combat_state?.reactions || {}) },
                    acBonuses: { ...(session.combat_state?.acBonuses || {}) },
                    shields: { ...(session.combat_state?.shields || {}) },
                }
                : currentCombatState(session, actorCharacterId);
            if (action.attackBonus != null && combatState.effectsByTarget?.[targets[0].id]?.nextAttackAdvantage) {
                action.attackRollMode = 'advantage';
                combatState.effectsByTarget = { ...(combatState.effectsByTarget || {}) };
                delete combatState.effectsByTarget[targets[0].id];
            }
            if (action.shield && combatState.shields?.[actorCharacterId]?.broken) {
                return reply({ ok: false, message: 'El escudo retráctil está roto y debe repararse antes de volver a usarlo.' });
            }
            if (action.resource?.type === 'spell-slot') {
                const minimum = Number(action.resource.level) || 1;
                const slots = JSON.parse(JSON.stringify(catalog.character.spell_slots || {}));
                const selected = Number(slotLevel || action.selectedSlotLevel);
                const slot = slots[selected] || slots[String(selected)];
                if (!selected || selected < minimum || !slot || Number(slot.used || 0) >= Number(slot.max || 0)) {
                    return reply({ ok: false, message: 'Ese espacio de conjuro ya no está disponible.' });
                }
                slot.used = Number(slot.used || 0) + 1;
                catalog.character.spell_slots = slots;
                catalog.character.changed('spell_slots', true);
                await catalog.character.save();
            } else if (action.resource?.type === 'feature-use') {
                const feature = (catalog.character.npcActions || []).find(item => Number(item.id) === Number(action.resource.actionId));
                if (!feature || Number(feature.used_uses) >= Number(feature.max_uses)) return reply({ ok: false, message: 'No quedan usos de este rasgo.' });
                feature.used_uses = Number(feature.used_uses) + 1;
                await feature.save();
            } else if (action.resource?.type === 'session-use') {
                const resourceKey = `${actorCharacterId}:${action.resource.key}`;
                const used = Number(combatState.resources?.[resourceKey] || 0);
                if (used >= Number(action.resource.max)) return reply({ ok: false, message: 'No quedan usos de este rasgo.' });
                combatState.resources[resourceKey] = used + 1;
            } else if (action.resource?.type === 'recharge') {
                const resourceKey = `${actorCharacterId}:${action.resource.key}`;
                if (Number(combatState.resources?.[resourceKey] || 0) >= 1) return reply({ ok: false, message: 'Esta habilidad todavía no se recargó.' });
                combatState.resources[resourceKey] = 1;
            }

            if (action.trackerCost?.key) {
                const tracker = customTrackers(catalog.character, session).find(item => item.key === action.trackerCost.key);
                const amount = Math.max(1, Number(action.trackerCost.amount) || 1);
                if (!tracker || tracker.value < amount) return reply({ ok: false, message: `No quedan ${tracker?.label || 'recursos'} suficientes.` });
                combatState.resources[`${actorCharacterId}:tracker:${tracker.key}`] = tracker.value - amount;
            }
            if (action.trackerRefill?.key) {
                const tracker = customTrackers(catalog.character, session).find(item => item.key === action.trackerRefill.key);
                if (!tracker) return reply({ ok: false, message: 'No se encontró el cargador a recargar.' });
                combatState.resources[`${actorCharacterId}:tracker:${tracker.key}`] = tracker.max;
            }

            if (action.economy === 'reaction') combatState.reactions[actorCharacterId] = true;
            else combatState.used[action.economy] = true;
            if (action.effect?.type === 'MARK_EXTRA_DAMAGE') {
                combatState.effects = {
                    ...(combatState.effects || {}),
                    [actorCharacterId]: { ...(combatState.effects?.[actorCharacterId] || {}), mark: { targetTokenId: targets[0].id, damage: action.effect.damage, damageType: action.effect.damageType, source: action.name } },
                };
            }
            if (action.effect?.type === 'TEMP_HP_RETALIATION') {
                combatState.effects = {
                    ...(combatState.effects || {}),
                    [actorCharacterId]: { ...(combatState.effects?.[actorCharacterId] || {}), retaliation: { damage: action.effect.damage, damageType: action.effect.damageType, source: action.name } },
                };
            }
            if (action.effect?.type === 'GRANT_NEXT_ATTACK_ADVANTAGE') {
                combatState.effectsByTarget = { ...(combatState.effectsByTarget || {}), [targets[0].id]: { nextAttackAdvantage: true, source: action.name } };
            }
            if (action.effect?.type === 'REMOVE_CONDITIONS') {
                for (const target of targets) {
                    const removable = new Set(action.effect.conditions || []);
                    target.conditions = (Array.isArray(target.conditions) ? target.conditions : []).filter(condition => !removable.has(condition));
                    await target.save();
                    io.to(roomName(session.id)).emit('game:token-condition-updated', { tokenId: target.id, conditions: target.conditions });
                }
            }
            if (action.clearWeaponJam) combatState.weaponJams = { ...(combatState.weaponJams || {}), [actorCharacterId]: false };
            if (action.shield) {
                combatState.acBonuses[actorCharacterId] = {
                    bonus: Number(action.shield.bonus) || 5,
                    source: action.name,
                };
            }
            session.combat_state = combatState;
            session.changed('combat_state', true);
            await session.save();

            const combatAction = await GameCombatAction.create({
                session_id: session.id,
                actor_user_id: socket.user.id,
                actor_character_id: actorCharacterId,
                action_key: action.key,
                action_name: action.name,
                status: 'PENDING',
                action_snapshot: { ...action, secondaryTargetTokenId: secondaryTarget?.id || null, utilitySave: Boolean(action.saveAbility && action.saveDc && !action.damage && !action.healing) },
                target_token_ids: targets.map(token => token.id),
                area,
                before_state: beforeState,
                result: {},
            });

            if (action.shield) {
                const shieldState = combatState.shields?.[actorCharacterId] || {};
                const threshold = Number(shieldState.breakThreshold ?? action.shield.initial_break_threshold ?? 3);
                combatAction.result = {
                    shield: { bonus: Number(action.shield.bonus) || 5, threshold },
                    summary: `${action.name}: +${Number(action.shield.bonus) || 5} CA hasta el final del turno. Tirando control de rotura (${threshold} o menos rompe).`,
                };
                const roll = await createCombatRoll(io, session, socket.user.id, catalog.character, {
                    sides: 6,
                    quantity: 1,
                    label: `${action.name} · control de rotura`,
                });
                combatAction.effect_roll_id = roll.id;
                combatAction.status = 'EFFECT_ROLL';
                await combatAction.save();
            } else if (action.attackBonus != null) {
                const roll = await createCombatRoll(io, session, socket.user.id, catalog.character, {
                    sides: 20,
                    quantity: action.attackRollMode === 'advantage' ? 2 : 1,
                    modifier: Number(action.attackBonus),
                    label: `${action.name} · ataque`,
                });
                combatAction.attack_roll_id = roll.id;
                combatAction.status = 'ATTACK_ROLL';
                await combatAction.save();
            } else {
                const expression = parseDiceExpression(action.damage || action.healing);
                if (expression) {
                    const roll = await createCombatRoll(io, session, socket.user.id, catalog.character, {
                        ...expression,
                        label: `${action.name} · ${action.healing ? 'curación' : 'efecto'}`,
                    });
                    combatAction.effect_roll_id = roll.id;
                    combatAction.status = 'EFFECT_ROLL';
                    await combatAction.save();
                } else if (action.saveAbility && action.saveDc) {
                    const target = targets[0];
                    const roll = await createCombatRoll(io, session, socket.user.id, target.character, {
                        sides: 20,
                        quantity: 1,
                        modifier: savingThrowBonus(target.character, action.saveAbility),
                        label: `${target.label} · salvación ${action.saveAbility} contra ${action.name}`,
                    });
                    combatAction.effect_roll_id = roll.id;
                    combatAction.status = 'EFFECT_ROLL';
                    await combatAction.save();
                } else {
                    if (action.movement && area) {
                        actorToken.x = clamp(area.x);
                        actorToken.y = clamp(area.y);
                        await actorToken.save();
                        io.to(roomName(session.id)).emit('game:token-moved', { tokenId: actorToken.id, x: actorToken.x, y: actorToken.y });
                    }
                    if (action.temporaryHp) {
                        for (const target of targets) {
                            target.character.hp_temp = Math.max(Number(target.character.hp_temp) || 0, Number(action.temporaryHp));
                            await target.character.save();
                            io.to(roomName(session.id)).emit('game:token-hp-updated', { tokenId: target.id, characterId: target.character.id, hpCurrent: target.character.hp_current, hpMax: target.character.hp_max, hpTemp: target.character.hp_temp });
                        }
                    }
                    combatAction.status = 'COMPLETED';
                    const manualSummary = `${catalog.character.name} usa ${action.name}. El DM resuelve su efecto.`;
                    combatAction.result = { targets: targets.map(token => ({ tokenId: token.id, name: token.label, outcome: action.temporaryHp ? 'temporary-hp' : action.movement ? 'moved' : 'used', amount: action.temporaryHp || 0 })), summary: action.temporaryHp ? `${action.name}: ${action.temporaryHp} PG temporales.` : action.movement ? `${catalog.character.name} usa ${action.name} y se reposiciona.` : action.manualResolution ? manualSummary : `${catalog.character.name} usa ${action.name}.` };
                    await combatAction.save();
                    io.to(roomName(session.id)).emit('game:combat-action-used', { actorName: catalog.character.name, characterImage: catalog.character.image_url || null, actionName: action.name, summary: action.manualResolution ? manualSummary : `${catalog.character.name} usa ${action.name}.`, manualResolution: Boolean(action.manualResolution) });
                }
            }
            await broadcastSession(io, session.id);
            reply({ ok: true, combatActionId: combatAction.id });
        } catch (error) {
            console.error('game:begin-action error:', error);
            reply({ ok: false, message: 'No se pudo iniciar la acción.' });
        }
    });

    socket.on('game:roll-action-damage', async ({ sessionId, combatActionId } = {}, reply = () => {}) => {
        try {
            const combatAction = await GameCombatAction.findOne({ where: { id: combatActionId, session_id: sessionId, status: 'DAMAGE_READY' } });
            if (!combatAction) return reply({ ok: false, message: 'La tirada de daño ya no está disponible.' });
            const session = await loadSession(sessionId);
            const authorizedDm = isDm(socket) && session?.dm_user_id === socket.user.id;
            // Los usuarios usan UUIDs: convertirlos con Number() produce NaN y
            // bloqueaba al dueño legítimo al momento de tirar su daño.
            if (!session || (!authorizedDm && String(combatAction.actor_user_id) !== String(socket.user.id))) return reply({ ok: false, message: 'No puedes tirar el daño de esta acción.' });
            const actorToken = session.tokens.find(token => Number(token.character_id) === Number(combatAction.actor_character_id));
            const expression = parseDiceExpression(combatAction.action_snapshot?.damage || combatAction.action_snapshot?.healing);
            if (!actorToken?.character || !expression) return reply({ ok: false, message: 'No se pudo preparar el daño de esta acción.' });
            // La tirada debe mostrarse a quien pulsa "Tirar daño". Para NPCs
            // normalmente es el DM, aunque la acción conserve otro actor_user_id.
            const effectRoll = await createCombatRoll(io, session, socket.user.id, actorToken.character, {
                ...expression,
                quantity: combatAction.result?.attack?.critical && combatAction.action_snapshot?.damage ? expression.quantity * 2 : expression.quantity,
                label: `${combatAction.action_name} · ${combatAction.action_snapshot?.healing ? 'curación' : 'daño'}`,
            });
            combatAction.effect_roll_id = effectRoll.id;
            combatAction.status = 'EFFECT_ROLL';
            await combatAction.save();
            await broadcastSession(io, session.id);
            reply({ ok: true, rollId: effectRoll.id });
        } catch (error) {
            console.error('game:roll-action-damage error:', error);
            reply({ ok: false, message: 'No se pudo iniciar la tirada de daño.' });
        }
    });

    socket.on('game:undo-action', async ({ sessionId, combatActionId } = {}, reply = () => {}) => {
        try {
            const session = await requireHostedSession(socket, sessionId);
            if (!session) return reply({ ok: false, message: 'Solo el DM puede deshacer acciones.' });
            const latest = await GameCombatAction.findOne({
                where: { session_id: session.id, status: 'COMPLETED', undone_at: null },
                order: [['createdAt', 'DESC']],
            });
            if (!latest || String(latest.id) !== String(combatActionId)) return reply({ ok: false, message: 'Solo se puede deshacer la última acción resuelta.' });
            const before = latest.before_state || {};
            for (const target of before.targets || []) {
                await Character.update({ hp_current: target.hpCurrent, hp_temp: target.hpTemp }, { where: { id: target.characterId } });
                io.to(roomName(session.id)).emit('game:token-hp-updated', { tokenId: target.tokenId, characterId: target.characterId, hpCurrent: target.hpCurrent, hpMax: target.hpMax, hpTemp: target.hpTemp });
            }
            if (before.actor?.characterId) {
                await Character.update({ spell_slots: before.actor.spellSlots || {} }, { where: { id: before.actor.characterId } });
            }
            if (before.actor?.featureActionId != null) {
                await NpcAction.update({ used_uses: before.actor.featureUsedUses || 0 }, { where: { id: before.actor.featureActionId } });
            }
            session.combat_state = before.combatState || {};
            session.changed('combat_state', true);
            await session.save();
            latest.status = 'UNDONE';
            latest.undone_at = new Date();
            latest.result = { ...(latest.result || {}), summary: `${latest.action_name} fue deshecha por el DM.` };
            await latest.save();
            await broadcastSession(io, session.id);
            reply({ ok: true });
        } catch (error) {
            console.error('game:undo-action error:', error);
            reply({ ok: false, message: 'No se pudo deshacer la acción.' });
        }
    });

    socket.on('game:cancel-action', async ({ sessionId, combatActionId } = {}, reply = () => {}) => {
        try {
            const action = await GameCombatAction.findOne({
                where: { id: combatActionId, session_id: sessionId, status: { [Op.in]: ['ATTACK_ROLL', 'DAMAGE_READY', 'EFFECT_ROLL', 'PENDING'] } },
            });
            if (!action) return reply({ ok: false, message: 'La acción ya no está pendiente.' });
            const session = await GameSession.findByPk(sessionId);
            const authorizedDm = isDm(socket) && session?.dm_user_id === socket.user.id;
            if (!authorizedDm && action.actor_user_id !== socket.user.id) return reply({ ok: false, message: 'No puedes cancelar esa acción.' });
            const before = action.before_state || {};
            if (before.actor?.characterId) await Character.update({ spell_slots: before.actor.spellSlots || {} }, { where: { id: before.actor.characterId } });
            if (before.actor?.featureActionId != null) await NpcAction.update({ used_uses: before.actor.featureUsedUses || 0 }, { where: { id: before.actor.featureActionId } });
            session.combat_state = before.combatState || {};
            session.changed('combat_state', true);
            await session.save();
            action.status = 'CANCELED';
            action.result = { ...(action.result || {}), summary: `${action.action_name} fue cancelada.` };
            await action.save();
            const rollIds = [action.attack_roll_id, action.effect_roll_id].filter(Boolean);
            if (rollIds.length) {
                await GameRoll.update({ dismissed: true }, { where: { id: { [Op.in]: rollIds }, session_id: session.id, resolved: false } });
                io.to(roomName(session.id)).emit('game:roll-dismissed', { rollIds });
            }
            await broadcastSession(io, session.id);
            reply({ ok: true });
        } catch (error) {
            console.error('game:cancel-action error:', error);
            reply({ ok: false, message: 'No se pudo cancelar la acción.' });
        }
    });

    socket.on('game:rest-character', async ({ sessionId, characterId, restType } = {}, reply = () => {}) => {
        try {
            const session = await requireHostedSession(socket, sessionId);
            if (!session) return reply({ ok: false, message: 'Solo el DM puede confirmar descansos.' });
            if (await hasPendingCombatAction(session.id)) return reply({ ok: false, message: 'Espera a que termine la acción pendiente.' });
            const type = restType === 'short' ? 'short' : restType === 'long' ? 'long' : null;
            if (!type) return reply({ ok: false, message: 'Tipo de descanso inválido.' });
            const catalog = await buildActionCatalog(Number(characterId));
            if (!catalog) return reply({ ok: false, message: 'Personaje no encontrado.' });

            const state = currentCombatState(session, Number(characterId));
            for (const action of catalog.actions) {
                if (action.resource?.type !== 'session-use') continue;
                const recovery = String(action.resource.recovery || 'largo');
                if (type === 'long' || recovery.includes('corto') || recovery.includes('short')) {
                    state.resources[`${characterId}:${action.resource.key}`] = 0;
                }
            }
            state.used = {};
            session.combat_state = state;
            session.changed('combat_state', true);
            await session.save();

            const slots = JSON.parse(JSON.stringify(catalog.character.spell_slots || {}));
            Object.values(slots).forEach(slot => {
                const recovery = String(slot?.recovery || slot?.source || '').toLowerCase();
                if (type === 'long' || recovery.includes('corto') || recovery.includes('short') || recovery.includes('pacto')) slot.used = 0;
            });
            catalog.character.spell_slots = slots;
            catalog.character.changed('spell_slots', true);
            await catalog.character.save();

            for (const feature of catalog.character.npcActions || []) {
                if (!feature.max_uses) continue;
                const recharge = String(feature.recharge || '').toLowerCase();
                if (type === 'long' || recharge.includes('corto') || recharge.includes('short')) {
                    feature.used_uses = 0;
                    await feature.save();
                }
            }
            await broadcastSession(io, session.id);
            reply({ ok: true });
        } catch (error) {
            console.error('game:rest-character error:', error);
            reply({ ok: false, message: 'No se pudo aplicar el descanso.' });
        }
    });

    socket.on('game:roll-dice', async ({ sessionId, sides, quantity = 1, modifier = 0, label, characterId = null } = {}, reply = () => {}) => {
        try {
            const session = await GameSession.findByPk(sessionId);
            if (!session) return reply({ ok: false, message: 'La mesa ya no esta disponible.' });

            const dmRoll = isDm(socket) && session.dm_user_id === socket.user.id;
            const participant = dmRoll ? null : await GameParticipant.findOne({
                where: { session_id: session.id, user_id: socket.user.id },
                include: [{ model: Character, as: 'character' }],
            });
            if (!dmRoll && !participant) return reply({ ok: false, message: 'No formas parte de esta mesa.' });

            const parsedSides = Number.parseInt(sides, 10);
            const parsedQuantity = Math.max(1, Math.min(20, Number.parseInt(quantity, 10) || 1));
            let parsedModifier = Math.max(-100, Math.min(100, Number.parseInt(modifier, 10) || 0));
            const participants = dmRoll ? [] : await GameParticipant.findAll({
                where: { session_id: session.id },
                attributes: ['user_id'],
                order: [['createdAt', 'ASC']],
            });
            const playerColorIndex = Math.max(0, participants.findIndex(item => item.user_id === socket.user.id));
            const themeColor = dmRoll ? '#c89b43' : PLAYER_DICE_COLORS[playerColorIndex % PLAYER_DICE_COLORS.length];
            if (![4, 6, 8, 10, 12, 20, 100].includes(parsedSides)) {
                return reply({ ok: false, message: 'Ese dado no esta permitido.' });
            }

            let character = participant?.character || null;
            if (dmRoll && characterId != null) {
                const actorToken = await GameToken.findOne({ where: { session_id: session.id, character_id: Number(characterId), visible: true } });
                if (!actorToken) return reply({ ok: false, message: 'Ese combatiente no tiene un token visible en esta mesa.' });
                character = await loadCombatCharacter(Number(characterId));
                if (!character) return reply({ ok: false, message: 'No se encontró el combatiente para la tirada.' });
            }
            const initiativeRoll = !dmRoll && isInitiativeLabel(label);
            if (initiativeRoll) {
                const pending = (session.combat_state?.pendingInitiative || []).map(Number);
                if (session.combat_state?.mode !== 'COMBAT' || !session.combat_state?.awaitingInitiative || !pending.includes(Number(character?.id))) {
                    return reply({ ok: false, message: 'Ese personaje no tiene una iniciativa pendiente.' });
                }
                if (parsedSides !== 20 || parsedQuantity !== 1) {
                    return reply({ ok: false, message: 'La iniciativa debe tirarse con 1d20.' });
                }
                const initiativeCharacter = await Character.findByPk(character.id, {
                    attributes: ['id', 'is_npc', 'initiative_bonus'],
                    include: [{ model: AbilityScore, as: 'abilityScores', separate: true }],
                });
                parsedModifier = initiativeBonus(initiativeCharacter);
            }
            const roll = await GameRoll.create({
                session_id: session.id,
                user_id: socket.user.id,
                character_id: character?.id || null,
                roller_name: socket.user.username || (dmRoll ? 'Dungeon Master' : 'Jugador'),
                character_name: character?.name || (dmRoll ? 'Dungeon Master' : null),
                character_image: character ? resolveCharacterImage(character) : null,
                label: String(label || `Tirada de d${parsedSides}`).trim().slice(0, 120) || `Tirada de d${parsedSides}`,
                sides: parsedSides,
                quantity: parsedQuantity,
                modifier: parsedModifier,
                theme_color: themeColor,
                results: [],
                total: parsedModifier,
                resolved: false,
            });

            io.to(roomName(session.id)).emit('game:roll-upsert', roll.toJSON());
            reply({ ok: true, roll: roll.toJSON() });
        } catch (error) {
            console.error('game:roll-dice error:', error);
            reply({ ok: false, message: 'No se pudo completar la tirada.' });
        }
    });

    socket.on('game:resolve-roll', async ({ sessionId, rollId, results } = {}, reply = () => {}) => {
        try {
            const roll = await GameRoll.findOne({
                where: { id: rollId, session_id: sessionId, user_id: socket.user.id, resolved: false },
            });
            if (!roll) return reply({ ok: false, message: 'La tirada ya fue resuelta o no te pertenece.' });

            const values = Array.isArray(results) ? results.map(value => Number.parseInt(value, 10)) : [];
            const validResults = values.length === roll.quantity
                && values.every(value => Number.isInteger(value) && value >= 1 && value <= roll.sides);
            if (!validResults) return reply({ ok: false, message: 'El resultado fisico de los dados no es valido.' });

            roll.results = values;
            roll.total = values.reduce((sum, value) => sum + value, 0) + roll.modifier;
            roll.resolved = true;
            await roll.save();
            io.to(roomName(roll.session_id)).emit('game:roll-upsert', roll.toJSON());
            if (isInitiativeLabel(roll.label) && Number(roll.sides) === 20 && Number(roll.quantity) === 1 && roll.character_id) {
                const session = await GameSession.findByPk(roll.session_id);
                const participant = await GameParticipant.findOne({
                    where: { session_id: roll.session_id, character_id: roll.character_id, user_id: socket.user.id },
                });
                if (session?.combat_state?.mode === 'COMBAT' && participant) {
                    const character = await Character.findByPk(roll.character_id, {
                        attributes: ['id', 'is_npc', 'initiative_bonus'],
                        include: [{ model: AbilityScore, as: 'abilityScores', separate: true }],
                    });
                    const changed = character && await recordInitiativeResult(session, character, roll, 'player');
                    if (changed) await broadcastSession(io, session.id);
                }
            }
            dismissRollForEveryone(io, roll.session_id, roll.id);
            const combatAction = await GameCombatAction.findOne({
                where: {
                    session_id: roll.session_id,
                    status: { [Op.in]: ['ATTACK_ROLL', 'EFFECT_ROLL'] },
                    [Op.or]: [{ attack_roll_id: roll.id }, { effect_roll_id: roll.id }],
                },
            });
            if (combatAction) await finalizeCombatAction(io, combatAction, roll);
            reply({ ok: true, roll: roll.toJSON() });
        } catch (error) {
            console.error('game:resolve-roll error:', error);
            reply({ ok: false, message: 'No se pudo confirmar el resultado de los dados.' });
        }
    });

    socket.on('game:dismiss-roll', async ({ sessionId, rollId } = {}) => {
        const session = await GameSession.findByPk(sessionId);
        if (!session) return;
        // Este evento elimina la card para toda la sala y por eso pertenece
        // exclusivamente al DM anfitrión. Los jugadores la ocultan sólo en
        // su cliente y no modifican el estado compartido.
        if (!isDm(socket) || String(session.dm_user_id) !== String(socket.user.id)) return;
        const roll = await GameRoll.findOne({ where: { id: rollId, session_id: session.id, dismissed: false } });
        if (!roll) return;

        const timerKey = `${session.id}:${roll.id}`;
        const automaticTimer = rollDismissTimers.get(timerKey);
        if (automaticTimer) {
            clearTimeout(automaticTimer);
            rollDismissTimers.delete(timerKey);
        }

        io.to(roomName(session.id)).emit('game:roll-dismissing', { rollIds: [roll.id] });
        const timer = setTimeout(async () => {
            rollDismissTimers.delete(timerKey);
            try {
                await GameRoll.update({ dismissed: true }, { where: { id: roll.id, session_id: session.id } });
                io.to(roomName(session.id)).emit('game:roll-dismissed', { rollIds: [roll.id] });
            } catch (error) {
                console.error('game:dismiss-roll error:', error);
                io.to(roomName(session.id)).emit('game:roll-upsert', roll.toJSON());
            }
        }, ROLL_CARD_EXIT_MS);
        rollDismissTimers.set(timerKey, timer);
    });

    socket.on('disconnect', () => {
        if (!socket.gameSessionId) return;
        const sessionId = socket.gameSessionId;
        removePresence(sessionId, socket.user.id, socket.id);
        broadcastSession(io, sessionId).catch(error => console.error('game disconnect broadcast error:', error));
    });
}

module.exports = { loadSession, registerGameSessionSocket };
