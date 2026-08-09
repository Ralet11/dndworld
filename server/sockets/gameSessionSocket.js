const { Op } = require('sequelize');
const { randomUUID } = require('crypto');
const {
    AbilityScore,
    AudioTrack,
    Character,
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

const presence = new Map();
const rollDismissTimers = new Map();
const PLAYER_DICE_COLORS = ['#3d8b61', '#397ca8', '#a83f35', '#c47b36', '#4f9b9a', '#d8cfb8', '#7c9c45', '#b05f72'];

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
                model: GameAsset,
                as: 'assets',
                separate: true,
                order: [['sort_order', 'ASC']],
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
        ],
    });
    if (!session) return null;

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
    return session;
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
    payload.active_character_id = payload.turn_order?.[payload.turn_index] ?? null;
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

function registerGameSessionSocket(io, socket) {
    socket.on('game:get-current', async () => {
        try {
            let session = null;
            if (isDm(socket)) {
                session = await GameSession.findOne({
                    where: { dm_user_id: socket.user.id, status: { [Op.ne]: 'FINISHED' } },
                    order: [['updatedAt', 'DESC']],
                });
            } else {
                const participant = await GameParticipant.findOne({
                    where: { user_id: socket.user.id },
                    include: [{ model: GameSession, as: 'session', where: { status: { [Op.ne]: 'FINISHED' } } }],
                    order: [['updatedAt', 'DESC']],
                });
                session = participant?.session || null;
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

    socket.on('game:create', async ({ title } = {}, reply = () => {}) => {
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
            const session = existing || await GameSession.create({
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
                const asset = await GameAsset.findOne({ where: { id: assetId, session_id: session.id } });
                if (!asset) return fail(socket, 'El asset seleccionado no pertenece a esta sala.');
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
            const maxOrder = await GameAsset.max('sort_order', { where: { session_id: session.id } });
            const asset = await GameAsset.create({
                session_id: session.id,
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
        const assets = await GameAsset.findAll({ where: { session_id: session.id, id: assetIds } });
        const orderById = new Map(assetIds.map((id, index) => [id, index]));
        await Promise.all(assets.map(asset => asset.update({ sort_order: orderById.get(asset.id) })));
        await broadcastSession(io, session.id);
    });

    socket.on('game:delete-asset', async ({ sessionId, assetId } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session) return;
        await GameAsset.destroy({ where: { id: assetId, session_id: session.id } });
        await broadcastSession(io, session.id);
    });

    socket.on('game:next-turn', async ({ sessionId } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session || !session.turn_order?.length) return;
        const nextIndex = session.turn_index + 1;
        if (nextIndex >= session.turn_order.length) {
            session.turn_index = 0;
            session.round += 1;
        } else {
            session.turn_index = nextIndex;
        }
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
        if (session.turn_index <= 0) {
            session.turn_index = session.turn_order.length - 1;
            session.round = Math.max(1, session.round - 1);
        } else {
            session.turn_index -= 1;
        }
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
        if (session.status !== 'WAITING' && !session.turn_order.map(Number).includes(Number(character.id))) {
            session.turn_order = [...session.turn_order, character.id];
            await session.save();
        }
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
            if (session.status !== 'WAITING' && !session.turn_order.map(Number).includes(Number(character.id))) {
                session.turn_order = [...session.turn_order, character.id];
                await session.save();
            }
            await broadcastSession(io, session.id);
            reply({ ok: true, character: character.toJSON(), token: token.toJSON() });
        } catch (error) {
            console.error('game:create-npc-token error:', error);
            reply({ ok: false, message: 'No se pudo crear la ficha y el token del NPC.' });
        }
    });

    socket.on('game:move-token', async ({ sessionId, tokenId, x, y } = {}) => {
        const session = await GameSession.findByPk(sessionId);
        const token = await GameToken.findOne({ where: { id: tokenId, session_id: sessionId } });
        if (!session || !token || token.locked) return;
        const dmControl = isDm(socket) && session.dm_user_id === socket.user.id;
        const activeCharacterId = session.turn_order?.[session.turn_index] ?? null;
        const playerControl = session.status === 'LIVE'
            && token.owner_user_id === socket.user.id
            && token.character_id === activeCharacterId;
        if (!dmControl && !playerControl) return fail(socket, 'Sólo puedes mover tu token durante tu turno.');

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
        character.hp_current = Math.max(0, Math.min(character.hp_max || 1, (character.hp_current || 0) + Number(delta || 0)));
        await character.save();
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
        character.hp_current = Math.max(0, Math.min(character.hp_max || 1, requestedHp));
        await character.save();
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
        if (source.character?.is_npc) {
            const data = source.character.toJSON();
            delete data.id;
            delete data.createdAt;
            delete data.updatedAt;
            delete data.UserId;
            const clone = await Character.create({ ...data, UserId: null });
            characterId = clone.id;
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
                await session.save();
            }
        }
        await broadcastSession(io, session.id);
    });

    socket.on('game:roll-dice', async ({ sessionId, sides, quantity = 1, modifier = 0, label } = {}, reply = () => {}) => {
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
            const parsedModifier = Math.max(-100, Math.min(100, Number.parseInt(modifier, 10) || 0));
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

            const character = participant?.character || null;
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
            reply({ ok: true, roll: roll.toJSON() });
        } catch (error) {
            console.error('game:resolve-roll error:', error);
            reply({ ok: false, message: 'No se pudo confirmar el resultado de los dados.' });
        }
    });

    socket.on('game:dismiss-roll', async ({ sessionId, rollId } = {}) => {
        const session = await requireHostedSession(socket, sessionId);
        if (!session) return;
        const roll = await GameRoll.findOne({ where: { id: rollId, session_id: session.id, dismissed: false } });
        if (!roll) return;

        const timerKey = `${session.id}:${roll.id}`;
        if (rollDismissTimers.has(timerKey)) return;

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
        }, 1100);
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
