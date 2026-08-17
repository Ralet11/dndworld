const { Character, CharacterInventory, Item, MapState, NpcAction, Quest, Scene, TimelineEvent } = require('../models');
const { runAssistantConversation } = require('./dmAssistantLlm');
const { generateNpcPortrait } = require('./npcImageGenerator');
const { deriveWorldConditions, normalizeWorldTime } = require('./worldTime');

const undoStackByUser = new Map();
const pendingDeletionByUser = new Map();

const HELP_SUGGESTIONS = [
    'contexto',
    '5 menos de vida a Lucario',
    'cura 8 a Paleas Mucron',
    'sumale 50 xp a Zik',
    'sumale 25 oro a Rakion Altarion',
    'dale inspiracion a Lucario',
    'activa a Albert Obrien',
    'narra La niebla cubre el puerto',
    'pone la hora en 19:30',
    'pone la ubicacion en Prontera',
    'deshacer',
];

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function getUndoStack(userId) {
    const existing = undoStackByUser.get(userId);
    if (Array.isArray(existing)) return existing;
    const stack = [];
    undoStackByUser.set(userId, stack);
    return stack;
}

function buildReply(kind, text, extra = {}) {
    return {
        ok: kind !== 'error',
        reply: {
            kind,
            text,
            ...extra,
        },
    };
}

function clampNumber(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value ?? null));
}

function formatPartyLine(char) {
    const hp = Number.isFinite(char.hp) ? char.hp : char.hp_current;
    const maxHp = Number.isFinite(char.maxHp) ? char.maxHp : char.hp_max;
    return `${char.name}: ${hp}/${maxHp} PG, XP ${char.xp || 0}, Oro ${char.gold || 0}`;
}

function formatContextText(context) {
    const injured = context.injured.length
        ? context.injured.map((char) => `${char.name} ${char.hp}/${char.maxHp} PG`).join(' | ')
        : 'Nadie esta herido.';

    const party = context.party.length
        ? context.party.map(formatPartyLine).join('\n')
        : 'No hay party cargada.';

    const sceneLine = context.scene
        ? `Escena actual: ${context.scene.title} (${context.scene.status})`
        : 'Escena actual: ninguna';

    return [
        `Hora: ${context.world.time}`,
        `Ubicacion: ${context.world.location}`,
        sceneLine,
        `Misiones en progreso: ${context.questCount}`,
        `Heridos: ${injured}`,
        '',
        'Party:',
        party,
    ].join('\n');
}

function isContextCommand(message) {
    const normalized = normalizeText(message);
    return [
        'contexto',
        'estado',
        'estado del grupo',
        'resumen',
        'party',
        'grupo',
        'quien esta herido',
        'quien esta lastimado',
    ].includes(normalized);
}

function isHelpCommand(message) {
    const normalized = normalizeText(message);
    return [
        'ayuda',
        'help',
        'comandos',
        'lista de comandos',
        'que puedes hacer',
        'que podes hacer',
        'que podes hacer?',
        'que puedes hacer?',
    ].includes(normalized);
}

function isUndoCommand(message) {
    const normalized = normalizeText(message);
    return ['deshacer', 'undo', 'revertir', 'deshacer eso', 'revertir eso'].includes(normalized);
}

function scoreNameMatch(name, query) {
    const normalizedName = normalizeText(name);
    if (!normalizedName || !query) return 0;
    if (normalizedName === query) return 100;
    if (normalizedName.startsWith(query)) return 90;

    const nameTokens = normalizedName.split(/\s+/).filter(Boolean);
    if (nameTokens.includes(query)) return 85;
    if (normalizedName.includes(query)) return 75;
    if (nameTokens.some((token) => token.startsWith(query))) return 65;
    return 0;
}

async function resolveCharacter(target) {
    const query = normalizeText(String(target || '').replace(/[.!?,;:]+$/g, ''));
    if (!query) {
        return { ok: false, error: 'No pude detectar a que personaje te refieres.' };
    }

    const characters = await Character.findAll({
        attributes: ['id', 'name', 'hp_current', 'hp_max', 'xp', 'gold', 'inspiration', 'is_npc', 'is_active'],
    });

    const ranked = characters
        .map((character) => ({ character, score: scoreNameMatch(character.name, query) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.character.name.localeCompare(b.character.name));

    if (!ranked.length) {
        return { ok: false, error: `No encontre ningun personaje que matchee con "${target}".` };
    }

    if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
        return {
            ok: false,
            ambiguous: true,
            matches: ranked.slice(0, 4).map((entry) => entry.character.name),
            error: `Encontre varias coincidencias para "${target}": ${ranked.slice(0, 4).map((entry) => entry.character.name).join(', ')}.`,
        };
    }

    return { ok: true, character: ranked[0].character };
}

async function resolveItem(target) {
    const query = normalizeText(String(target || '').replace(/[.!?,;:]+$/g, ''));
    if (!query) return { ok: false, error: 'No pude detectar a que objeto te refieres.' };
    const items = await Item.findAll();
    const ranked = items.map((item) => ({ item, score: scoreNameMatch(item.name, query) }))
        .filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
    if (!ranked.length) return { ok: false, error: `No encontre ningun objeto que matchee con "${target}".` };
    if (ranked.length > 1 && ranked[0].score === ranked[1].score) return { ok: false, ambiguous: true, matches: ranked.slice(0, 4).map((entry) => entry.item.name), error: `Encontre varios objetos: ${ranked.slice(0, 4).map((entry) => entry.item.name).join(', ')}.` };
    return { ok: true, item: ranked[0].item };
}

function safeNpcPatch(fields = {}) {
    const text = (value, limit) => String(value || '').trim().slice(0, limit);
    const integer = (value, min, max) => Number.isFinite(Number(value)) ? clampNumber(Math.round(Number(value)), min, max) : undefined;
    const patch = {};
    if (fields.race !== undefined) patch.race = text(fields.race, 80);
    if (fields.className !== undefined) patch.class = text(fields.className, 80);
    if (fields.npcType !== undefined && ['neutral', 'amigo', 'compañero', 'enemigo'].includes(fields.npcType)) patch.npc_type = fields.npcType;
    if (fields.hpMax !== undefined) patch.hp_max = integer(fields.hpMax, 1, 9999);
    if (fields.hpCurrent !== undefined) patch.hp_current = integer(fields.hpCurrent, 0, 9999);
    if (fields.ac !== undefined) patch.ac_base = integer(fields.ac, 0, 99);
    if (fields.level !== undefined) patch.level = integer(fields.level, 1, 20);
    if (fields.speed !== undefined) patch.speed = integer(fields.speed, 0, 999);
    if (fields.notes !== undefined) patch.notes = text(fields.notes, 5000);
    if (fields.abilitiesText !== undefined) patch.abilities_text = text(fields.abilitiesText, 10000);
    if (fields.imageUrl !== undefined) patch.image_url = text(fields.imageUrl, 2000);
    Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key]);
    return patch;
}

function safeNpcActions(actions) {
    if (!Array.isArray(actions)) return [];
    return actions.slice(0, 40).map((action, index) => ({
        name: String(action?.name || '').trim().slice(0, 120),
        action_type: ['acción', 'bonus', 'reacción', 'rasgo'].includes(String(action?.type || action?.action_type || '').trim()) ? String(action.type || action.action_type).trim() : 'acción',
        description: String(action?.description || '').trim().slice(0, 5000) || null,
        attack_bonus: Number.isFinite(Number(action?.attackBonus)) ? clampNumber(Math.round(Number(action.attackBonus)), -50, 100) : null,
        damage_dice: String(action?.damage || action?.damage_dice || '').trim().slice(0, 32) || null,
        damage_bonus: Number.isFinite(Number(action?.damageBonus)) ? clampNumber(Math.round(Number(action.damageBonus)), -100, 100) : null,
        damage_type: String(action?.damageType || action?.damage_type || '').trim().slice(0, 40) || null,
        reach: String(action?.reach || '').trim().slice(0, 60) || null,
        save_ability: String(action?.saveAbility || action?.save_ability || '').trim().toUpperCase().slice(0, 3) || null,
        save_dc: Number.isFinite(Number(action?.saveDc)) ? clampNumber(Math.round(Number(action.saveDc)), 1, 100) : null,
        recharge: String(action?.recharge || '').trim().slice(0, 24) || null,
        max_uses: Number.isFinite(Number(action?.maxUses)) ? clampNumber(Math.round(Number(action.maxUses)), 1, 99) : null,
        used_uses: 0, is_public: Boolean(action?.isPublic), sort_order: index,
    })).filter((action) => action.name);
}

async function replaceNpcActions(npcId, actions) {
    if (!Array.isArray(actions)) return 0;
    const valid = safeNpcActions(actions);
    await NpcAction.destroy({ where: { character_id: npcId } });
    if (valid.length) await NpcAction.bulkCreate(valid.map((action) => ({ ...action, character_id: npcId })));
    return valid.length;
}

async function saveNpcActions(npcId, actions, mode = 'replace') {
    if (!Array.isArray(actions)) return 0;
    if (mode !== 'append') return replaceNpcActions(npcId, actions);
    const valid = safeNpcActions(actions);
    if (!valid.length) return 0;
    const latest = await NpcAction.max('sort_order', { where: { character_id: npcId } });
    const startOrder = Number.isInteger(latest) ? latest + 1 : 0;
    await NpcAction.bulkCreate(valid.map((action, index) => ({ ...action, character_id: npcId, sort_order: startOrder + index })));
    return valid.length;
}

async function emitItemRefresh(io) { io.emit('all-items', await Item.findAll()); }

async function createNpcFromAssistant({ fields, io, getCalculatedPartyStats }) {
    const name = String(fields.name || '').trim().slice(0, 120);
    if (!name) return buildReply('error', 'Para crear un NPC necesito al menos un nombre.');
    const patch = safeNpcPatch(fields);
    const hpMax = patch.hp_max || 10;
    const npc = await Character.create({ name, is_npc: true, hp_max: hpMax, hp_current: patch.hp_current ?? hpMax, race: patch.race || 'Humanoide', class: patch.class || 'NPC', npc_type: patch.npc_type || 'neutral', level: patch.level || 1, ac_base: patch.ac_base || 10, speed: patch.speed || 30, notes: patch.notes || '', abilities_text: patch.abilities_text || '', image_url: patch.image_url || null });
    const actionCount = await saveNpcActions(npc.id, fields.actions, fields.actionMode);
    await emitNpcRefresh(io, getCalculatedPartyStats);
    return buildReply('result', `Creé a ${npc.name}: ${npc.hp_current}/${npc.hp_max} PG, CA ${npc.ac_base}, ${npc.npc_type}${actionCount ? ` y ${actionCount} acción(es)` : ''}.`, { tool: 'npc.create', suggestions: ['editar ' + npc.name, 'activar ' + npc.name] });
}

async function updateNpcFromAssistant({ target, fields, io, getCalculatedPartyStats }) {
    const resolved = await resolveCharacter(target);
    if (!resolved.ok || !resolved.character.is_npc) return buildReply('error', resolved.ok ? `${resolved.character.name} no es un NPC.` : resolved.error, resolved.ambiguous ? { suggestions: resolved.matches } : {});
    const patch = safeNpcPatch(fields);
    if (!Object.keys(patch).length && !Array.isArray(fields.actions)) return buildReply('error', 'No detecté campos válidos para cambiar en el NPC.');
    const npc = await Character.findByPk(resolved.character.id);
    Object.assign(npc, patch); if (npc.hp_current > npc.hp_max) npc.hp_current = npc.hp_max; await npc.save();
    const actionCount = await saveNpcActions(npc.id, fields.actions, fields.actionMode);
    await emitNpcRefresh(io, getCalculatedPartyStats);
    return buildReply('result', `Actualicé ${npc.name}${Array.isArray(fields.actions) ? ` con ${actionCount} acción(es)` : ''}.`, { tool: 'npc.update', suggestions: ['deshacer'] });
}

async function generateNpcImageFromAssistant({ target, prompt, quality, userId, io, getCalculatedPartyStats }) {
    const resolved = await resolveCharacter(target);
    if (!resolved.ok || !resolved.character.is_npc) {
        return buildReply(
            'error',
            resolved.ok ? `${resolved.character.name} no es un NPC.` : resolved.error,
            resolved.ambiguous ? { suggestions: resolved.matches } : {}
        );
    }

    const npc = await Character.findByPk(resolved.character.id);
    const actions = await NpcAction.findAll({
        where: { character_id: npc.id },
        order: [['sort_order', 'ASC'], ['id', 'ASC']],
    });
    const previousValues = {
        image_url: npc.image_url,
        rendered_url: npc.rendered_url,
        rendered_signature: npc.rendered_signature,
    };

    let generated;
    try {
        generated = await generateNpcPortrait({ npc, actions, direction: prompt, quality });
    } catch (error) {
        const detail = error?.code === 'NO_API_KEY'
            ? 'La clave de OpenAI no esta configurada en el servidor.'
            : error?.code === 'S3_NOT_CONFIGURED'
                ? 'El almacenamiento de imagenes no esta configurado en el servidor.'
                : `No pude generar la imagen: ${String(error?.message || 'error desconocido').slice(0, 240)}`;
        return buildReply('error', detail, { tool: 'npc.image.generate' });
    }

    npc.image_url = generated.url;
    npc.rendered_url = null;
    npc.rendered_signature = null;
    await npc.save();

    rememberUndo(userId, {
        kind: 'npc_image',
        npcId: npc.id,
        previousValues,
        undoText: `Listo, restauré la imagen anterior de ${npc.name}.`,
    });

    io.emit('npc:image-updated', { characterId: npc.id, imageUrl: generated.url });
    if (npc.is_active) {
        const updatedStats = await getCalculatedPartyStats();
        io.emit('players-data', updatedStats);
        io.emit('stats-updated', updatedStats);
    }
    io.emit('notification', { text: `Se generó y asignó un nuevo retrato a ${npc.name}.`, type: 'dm_assistant' });

    return buildReply('result', `Generé y asigné un nuevo retrato a ${npc.name}.`, {
        tool: 'npc.image.generate',
        data: { characterId: npc.id, imageUrl: generated.url },
        undoAvailable: true,
        suggestions: ['deshacer', `ver a ${npc.name}`],
    });
}

async function createItemFromAssistant({ fields, io }) {
    const name = String(fields.name || '').trim().slice(0, 120);
    if (!name) return buildReply('error', 'Para crear un objeto necesito un nombre.');
    const allowedTypes = ['Arma', 'Armadura', 'Consumible', 'Objeto Mágico', 'Otro'];
    const allowedRarities = ['Común', 'Poco Común', 'Raro', 'Muy Raro', 'Legendario'];
    const item = await Item.create({ name, type: allowedTypes.includes(fields.type) ? fields.type : 'Otro', rarity: allowedRarities.includes(fields.rarity) ? fields.rarity : 'Común', level: clampNumber(Number(fields.level) || 1, 1, 20), description: String(fields.description || '').trim().slice(0, 5000), damage: String(fields.damage || '').trim().slice(0, 32) || null, damage_type: String(fields.damageType || '').trim().slice(0, 40) || null, image_url: String(fields.imageUrl || '').trim().slice(0, 2000) || null });
    await emitItemRefresh(io);
    return buildReply('result', `Creé el objeto ${item.name} (${item.type}, ${item.rarity}).`, { tool: 'item.create', suggestions: ['editar ' + item.name] });
}

async function updateItemFromAssistant({ target, fields, io }) {
    const resolved = await resolveItem(target);
    if (!resolved.ok) return buildReply('error', resolved.error, resolved.ambiguous ? { suggestions: resolved.matches } : {});
    const item = resolved.item; const patch = {};
    if (fields.description !== undefined) patch.description = String(fields.description).slice(0, 5000);
    if (fields.damage !== undefined) patch.damage = String(fields.damage).slice(0, 32);
    if (fields.damageType !== undefined) patch.damage_type = String(fields.damageType).slice(0, 40);
    if (fields.imageUrl !== undefined) patch.image_url = String(fields.imageUrl).slice(0, 2000);
    if (fields.rarity !== undefined && ['Común', 'Poco Común', 'Raro', 'Muy Raro', 'Legendario'].includes(fields.rarity)) patch.rarity = fields.rarity;
    if (fields.type !== undefined && ['Arma', 'Armadura', 'Consumible', 'Objeto Mágico', 'Otro'].includes(fields.type)) patch.type = fields.type;
    if (!Object.keys(patch).length) return buildReply('error', 'No detecté campos válidos para cambiar en el objeto.');
    Object.assign(item, patch); await item.save(); await emitItemRefresh(io);
    return buildReply('result', `Actualicé ${item.name}.`, { tool: 'item.update', suggestions: ['deshacer'] });
}

async function requestDeletion({ entity, target, userId }) {
    const resolved = entity === 'npc' ? await resolveCharacter(target) : await resolveItem(target);
    const record = entity === 'npc' ? resolved.character : resolved.item;
    if (!resolved.ok || (entity === 'npc' && !record.is_npc)) return buildReply('error', resolved.ok ? 'Sólo se pueden eliminar NPCs desde el Oráculo.' : resolved.error, resolved.ambiguous ? { suggestions: resolved.matches } : {});
    pendingDeletionByUser.set(userId, { entity, id: record.id, name: record.name, expiresAt: Date.now() + 120000 });
    return buildReply('confirm', `Vas a eliminar ${entity === 'npc' ? 'el NPC' : 'el objeto'} "${record.name}". Esta acción no se puede deshacer. Escribí “confirmar eliminación” para continuar.`, { tool: `${entity}.delete.request`, suggestions: ['confirmar eliminación', 'cancelar'] });
}

async function confirmDeletion({ userId, io, getCalculatedPartyStats }) {
    const pending = pendingDeletionByUser.get(userId);
    if (!pending || pending.expiresAt < Date.now()) { pendingDeletionByUser.delete(userId); return buildReply('info', 'No hay ninguna eliminación pendiente para confirmar.'); }
    pendingDeletionByUser.delete(userId);
    if (pending.entity === 'npc') {
        const npc = await Character.findOne({ where: { id: pending.id, is_npc: true } });
        if (!npc) return buildReply('error', 'Ese NPC ya no existe.');
        await npc.destroy(); await emitNpcRefresh(io, getCalculatedPartyStats);
        return buildReply('result', `Eliminé el NPC ${pending.name}.`, { tool: 'npc.delete' });
    }
    const item = await Item.findByPk(pending.id);
    if (!item) return buildReply('error', 'Ese objeto ya no existe.');
    const assigned = await CharacterInventory.count({ where: { item_id: item.id } });
    if (assigned) return buildReply('error', `${item.name} está asignado a ${assigned} inventario(s). Quitalo primero antes de eliminarlo.`);
    await item.destroy(); await emitItemRefresh(io);
    return buildReply('result', `Eliminé el objeto ${pending.name}.`, { tool: 'item.delete' });
}

async function resolveQuest(target) {
    const cleanTarget = String(target || '')
        .replace(/[.!?,;:]+$/g, '')
        .trim();
    const query = normalizeText(cleanTarget);
    if (!query) {
        return { ok: false, error: 'No pude detectar a que mision te refieres.' };
    }

    if (/^\d+$/.test(query)) {
        const quest = await Quest.findByPk(parseInt(query, 10), { include: Character });
        if (!quest) {
            return { ok: false, error: `No encontre ninguna mision con id ${query}.` };
        }
        return { ok: true, quest };
    }

    const quests = await Quest.findAll({ include: Character });
    const ranked = quests
        .map((quest) => ({ quest, score: scoreNameMatch(quest.title, query) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.quest.title.localeCompare(b.quest.title));

    if (!ranked.length) {
        return { ok: false, error: `No encontre ninguna mision que matchee con "${target}".` };
    }

    if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
        return {
            ok: false,
            ambiguous: true,
            matches: ranked.slice(0, 4).map((entry) => entry.quest.title),
            error: `Encontre varias misiones para "${target}": ${ranked.slice(0, 4).map((entry) => entry.quest.title).join(', ')}.`,
        };
    }

    return { ok: true, quest: ranked[0].quest };
}

function resolveObjective(quest, target) {
    const objectives = Array.isArray(quest.objectives) ? quest.objectives : [];
    if (!objectives.length) {
        return { ok: false, error: `La mision "${quest.title}" no tiene objetivos cargados.` };
    }

    const cleanTarget = String(target || '')
        .replace(/[.!?,;:]+$/g, '')
        .replace(/^["']|["']$/g, '')
        .trim();
    if (!cleanTarget) {
        return { ok: false, error: 'No pude detectar que objetivo quieres cambiar.' };
    }

    if (/^\d+$/.test(cleanTarget)) {
        const objectiveNumber = parseInt(cleanTarget, 10);
        const objectiveIndex = objectives.findIndex((obj, index) => Number(obj.id) === objectiveNumber || index + 1 === objectiveNumber);
        if (objectiveIndex >= 0) {
            return { ok: true, objective: objectives[objectiveIndex], objectiveIndex };
        }
    }

    const query = normalizeText(cleanTarget);
    const ranked = objectives
        .map((objective, index) => ({ objective, objectiveIndex: index, score: scoreNameMatch(objective.text || '', query) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || String(a.objective.text || '').localeCompare(String(b.objective.text || '')));

    if (!ranked.length) {
        return { ok: false, error: `No encontre un objetivo en "${quest.title}" que matchee con "${target}".` };
    }

    if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
        return {
            ok: false,
            ambiguous: true,
            matches: ranked.slice(0, 4).map((entry) => entry.objective.text || `Objetivo ${entry.objective.id || entry.objectiveIndex + 1}`),
            error: `Encontre varios objetivos posibles en "${quest.title}": ${ranked.slice(0, 4).map((entry) => entry.objective.text || `Objetivo ${entry.objective.id || entry.objectiveIndex + 1}`).join(', ')}.`,
        };
    }

    return {
        ok: true,
        objective: ranked[0].objective,
        objectiveIndex: ranked[0].objectiveIndex,
    };
}

async function emitCharacterRefresh(io, getCalculatedPartyStats, character) {
    if (character.is_npc) {
        const npcs = await Character.findAll({ where: { is_npc: true } });
        io.emit('all-npcs', npcs);
    }

    if (!character.is_npc || character.is_active) {
        const updatedStats = await getCalculatedPartyStats();
        io.emit('players-data', updatedStats);
        io.emit('stats-updated', updatedStats);
    }
}

async function emitWorldRefresh(io) {
    const [state] = await MapState.findOrCreate({ where: { id: 1 } });
    io.emit('global-state-data', state);
}

async function emitQuestRefresh(io, getCalculatedPartyStats) {
    const quests = await Quest.findAll({ include: Character });
    io.emit('all-quests', quests);
    const updatedStats = await getCalculatedPartyStats();
    io.emit('stats-updated', updatedStats);
}

async function emitNpcRefresh(io, getCalculatedPartyStats) {
    const npcs = await Character.findAll({ where: { is_npc: true } });
    io.emit('all-npcs', npcs);
    const updatedStats = await getCalculatedPartyStats();
    io.emit('players-data', updatedStats);
    io.emit('stats-updated', updatedStats);
}

function rememberUndo(userId, payload) {
    const stack = getUndoStack(userId);
    stack.push(payload);
    if (stack.length > 10) {
        stack.shift();
    }
}

async function applyUndo({ userId, io, getCalculatedPartyStats }) {
    const stack = getUndoStack(userId);
    const payload = stack.pop();
    if (!payload) {
        return buildReply('info', 'No tengo ninguna accion reciente para deshacer.', {
            suggestions: HELP_SUGGESTIONS.slice(0, 4),
        });
    }

    if (payload.kind === 'character_field') {
        const character = await Character.findByPk(payload.characterId);
        if (!character) {
            return buildReply('error', 'No pude deshacer porque el personaje ya no existe.');
        }

        character[payload.field] = payload.previousValue;
        await character.save();
        await emitCharacterRefresh(io, getCalculatedPartyStats, character);
        io.emit('notification', { text: payload.notificationText || `Se deshizo el ultimo cambio sobre ${character.name}.`, type: 'dm_assistant' });

        return buildReply('result', payload.undoText || `Listo, reverti el ultimo cambio sobre ${character.name}.`, {
            tool: 'action.undo',
            undoAvailable: false,
        });
    }

    if (payload.kind === 'map_state') {
        const [state] = await MapState.findOrCreate({ where: { id: 1 } });
        Object.assign(state, payload.previousValues);
        await state.save();
        await emitWorldRefresh(io);
        return buildReply('result', payload.undoText || 'Listo, reverti el ultimo cambio global.', {
            tool: 'action.undo',
            undoAvailable: false,
        });
    }

    if (payload.kind === 'quest_progress') {
        const quest = await Quest.findByPk(payload.questId);
        if (!quest) {
            return buildReply('error', 'No pude deshacer porque la mision ya no existe.');
        }

        quest.objectives = cloneJson(payload.previousObjectives) || [];
        quest.status = payload.previousStatus;
        quest.changed('objectives', true);
        await quest.save();
        await emitQuestRefresh(io, getCalculatedPartyStats);
        io.emit('notification', { text: payload.notificationText || `Se deshizo el ultimo cambio sobre la mision ${quest.title}.`, type: 'dm_assistant' });

        return buildReply('result', payload.undoText || `Listo, reverti el ultimo cambio sobre la mision ${quest.title}.`, {
            tool: 'action.undo',
            undoAvailable: false,
        });
    }

    if (payload.kind === 'npc_activation') {
        const previousStates = Array.isArray(payload.previousStates) ? payload.previousStates : [];
        const ids = previousStates.map((state) => state.id).filter(Boolean);
        if (!ids.length) {
            return buildReply('error', 'No pude deshacer el cambio de NPC porque faltan datos previos.');
        }

        const npcs = await Character.findAll({ where: { id: ids } });
        const previousMap = new Map(previousStates.map((state) => [state.id, !!state.is_active]));
        for (const npc of npcs) {
            npc.is_active = previousMap.get(npc.id) || false;
            await npc.save();
        }

        await emitNpcRefresh(io, getCalculatedPartyStats);
        io.emit('notification', { text: payload.notificationText || 'Se deshizo el ultimo cambio de aliados activos.', type: 'dm_assistant' });

        return buildReply('result', payload.undoText || 'Listo, reverti el ultimo cambio de aliados activos.', {
            tool: 'action.undo',
            undoAvailable: false,
        });
    }

    if (payload.kind === 'npc_state') {
        const npc = await Character.findByPk(payload.npcId);
        if (!npc) {
            return buildReply('error', 'No pude deshacer porque el NPC ya no existe.');
        }

        npc.npc_type = payload.previousValues.npc_type;
        npc.is_active = !!payload.previousValues.is_active;
        npc.owner_id = payload.previousValues.owner_id || null;
        await npc.save();
        await emitNpcRefresh(io, getCalculatedPartyStats);
        io.emit('notification', { text: payload.notificationText || `Se deshizo el ultimo cambio de rol sobre ${npc.name}.`, type: 'dm_assistant' });

        return buildReply('result', payload.undoText || `Listo, reverti el ultimo cambio de rol sobre ${npc.name}.`, {
            tool: 'action.undo',
            undoAvailable: false,
        });
    }

    if (payload.kind === 'npc_image') {
        const npc = await Character.findByPk(payload.npcId);
        if (!npc) return buildReply('error', 'No pude deshacer porque el NPC ya no existe.');
        Object.assign(npc, payload.previousValues || {});
        await npc.save();
        io.emit('npc:image-updated', {
            characterId: npc.id,
            imageUrl: npc.rendered_url || npc.image_url || null,
        });
        if (npc.is_active) {
            const updatedStats = await getCalculatedPartyStats();
            io.emit('players-data', updatedStats);
            io.emit('stats-updated', updatedStats);
        }
        return buildReply('result', payload.undoText || `Listo, restauré la imagen anterior de ${npc.name}.`, {
            tool: 'action.undo',
            undoAvailable: false,
        });
    }

    return buildReply('error', 'No pude deshacer esa accion.');
}

async function getAssistantContext({ sceneId, getCalculatedPartyStats }) {
    const [state] = await MapState.findOrCreate({ where: { id: 1 } });
    const party = await getCalculatedPartyStats();
    const questCount = await Quest.count({ where: { status: 'En Progreso' } });
    const scene = sceneId ? await Scene.findByPk(sceneId) : null;
    const injured = party
        .filter((char) => Number(char.hp) < Number(char.maxHp))
        .sort((a, b) => Number(a.hp) - Number(b.hp))
        .slice(0, 5);

    return {
        world: {
            time: state.global_time,
            location: state.global_location,
        },
        scene: scene ? { id: scene.id, title: scene.title, status: scene.status } : null,
        questCount,
        injured: injured.map((char) => ({
            id: char.id,
            name: char.name,
            hp: char.hp,
            maxHp: char.maxHp,
        })),
        party: party.map((char) => ({
            id: char.id,
            name: char.name,
            hp: char.hp,
            maxHp: char.maxHp,
            xp: char.xp || 0,
            gold: char.gold || 0,
            inspiration: !!char.inspiration,
            level: char.level,
            class: char.class,
        })),
    };
}

async function readCharacterStatus(target) {
    const resolved = await resolveCharacter(target);
    if (!resolved.ok) {
        const extra = resolved.ambiguous ? { suggestions: resolved.matches } : { suggestions: HELP_SUGGESTIONS.slice(0, 4) };
        return buildReply('error', resolved.error, extra);
    }

    const character = await Character.findByPk(resolved.character.id, {
        attributes: [
            'id', 'name', 'race', 'class', 'level', 'hp_current', 'hp_max', 'ac_base',
            'initiative_bonus', 'speed', 'passive_perception', 'challenge_rating', 'xp', 'gold',
            'inspiration', 'is_npc', 'npc_type', 'is_active', 'owner_id', 'abilities_text',
        ],
    });
    const actions = character.is_npc
        ? await NpcAction.findAll({
            where: { character_id: character.id },
            order: [['sort_order', 'ASC'], ['id', 'ASC']],
        })
        : [];
    const owner = character.owner_id
        ? await Character.findByPk(character.owner_id, { attributes: ['id', 'name'] })
        : null;
    const lines = [
        `${character.name}`,
        `PG: ${character.hp_current}/${character.hp_max}`,
        `CA: ${character.ac_base || 10}`,
        `Nivel: ${character.level || 1}`,
        `Clase/Rol: ${character.class || 'sin definir'}`,
        `Raza: ${character.race || 'sin definir'}`,
        `XP: ${character.xp || 0}`,
        `Oro: ${character.gold || 0}`,
        `Inspiracion: ${character.inspiration ? 'si' : 'no'}`,
    ];

    if (character.is_npc) {
        lines.push(`Tipo NPC: ${character.npc_type || 'neutral'}`);
        lines.push(`En party: ${character.is_active ? 'si' : 'no'}`);
        if (owner?.name) {
            lines.push(`Vinculado a: ${owner.name}`);
        }
        lines.push('', 'Acciones, rasgos y reacciones:');
        if (!actions.length) {
            lines.push('- Ninguna cargada.');
        } else {
            actions.forEach((action) => {
                const mechanics = [
                    action.attack_bonus != null ? `ataque ${Number(action.attack_bonus) >= 0 ? '+' : ''}${action.attack_bonus}` : null,
                    action.damage_dice ? `daño ${action.damage_dice}${action.damage_bonus ? `${Number(action.damage_bonus) >= 0 ? '+' : ''}${action.damage_bonus}` : ''}${action.damage_type ? ` ${action.damage_type}` : ''}` : null,
                    action.reach ? `alcance ${action.reach}` : null,
                    action.save_dc ? `salvación ${action.save_ability || ''} CD ${action.save_dc}`.trim() : null,
                    action.recharge ? `recarga ${action.recharge}` : null,
                    action.max_uses ? `${action.max_uses} uso(s)` : null,
                ].filter(Boolean).join('; ');
                lines.push(`- ${action.name} [${action.action_type || 'acción'}]${action.description ? `: ${action.description}` : ''}${mechanics ? ` (${mechanics})` : ''}`);
            });
        }
        if (character.abilities_text) lines.push(`Rasgos narrativos: ${String(character.abilities_text).slice(0, 1500)}`);
    }

    return buildReply(
        'context',
        lines.join('\n'),
        {
            tool: 'character.get',
            data: {
                characterId: character.id,
                name: character.name,
                race: character.race || null,
                className: character.class || null,
                level: character.level || 1,
                hp: character.hp_current,
                maxHp: character.hp_max,
                armorClass: character.ac_base || 10,
                initiative: character.initiative_bonus || 0,
                speed: character.speed || 0,
                passivePerception: character.passive_perception || 10,
                challengeRating: character.challenge_rating || null,
                isNpc: !!character.is_npc,
                npcType: character.npc_type || null,
                isActive: !!character.is_active,
                actions: actions.map((action) => ({
                    id: action.id,
                    name: action.name,
                    type: action.action_type,
                    description: action.description,
                    attackBonus: action.attack_bonus,
                    damage: action.damage_dice,
                    damageBonus: action.damage_bonus,
                    damageType: action.damage_type,
                    reach: action.reach,
                    saveAbility: action.save_ability,
                    saveDc: action.save_dc,
                    recharge: action.recharge,
                    maxUses: action.max_uses,
                    isPublic: !!action.is_public,
                })),
                narrativeTraits: character.abilities_text || '',
            },
        }
    );
}

async function updateCharacterField({
    target,
    field,
    nextValue,
    userId,
    io,
    getCalculatedPartyStats,
    tool,
    summaryBuilder,
    notificationBuilder,
}) {
    const resolved = await resolveCharacter(target);
    if (!resolved.ok) {
        const extra = resolved.ambiguous ? { suggestions: resolved.matches } : { suggestions: HELP_SUGGESTIONS.slice(0, 4) };
        return buildReply('error', resolved.error, extra);
    }

    const character = await Character.findByPk(resolved.character.id);
    const previousValue = character[field];
    let appliedValue = nextValue;
    if (field === 'hp_current') {
        appliedValue = clampNumber(Number(nextValue) || 0, 0, character.hp_max || Number(nextValue) || 0);
    } else if (field === 'xp' || field === 'gold') {
        appliedValue = Math.max(0, Number(nextValue) || 0);
    } else if (field === 'inspiration') {
        appliedValue = !!nextValue;
    }

    character[field] = appliedValue;
    await character.save();

    await emitCharacterRefresh(io, getCalculatedPartyStats, character);

    const summaryText = summaryBuilder(character, previousValue, appliedValue);
    const notificationText = notificationBuilder ? notificationBuilder(character, previousValue, appliedValue) : null;
    if (notificationText) {
        if (field === 'gold' && character.UserId) {
            const amount = Number(appliedValue) - Number(previousValue || 0);
            io.to(`player:${character.UserId}`).emit('player:toast', {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                createdAt: new Date().toISOString(),
                characterId: character.id,
                type: amount >= 0 ? 'gold_received' : 'gold_lost',
                eyebrow: 'Recompensa del Dungeon Master',
                title: amount >= 0 ? 'Recibiste oro' : 'Se retiró oro',
                text: notificationText,
                amount: Math.abs(amount),
                total: Number(appliedValue),
                actor: { name: 'Dungeon Master', role: 'DM' },
            });
        } else {
            io.emit('notification', { text: notificationText, type: 'dm_assistant' });
        }
    }

    rememberUndo(userId, {
        kind: 'character_field',
        characterId: character.id,
        field,
        previousValue,
        undoText: `Listo, deshice el ultimo cambio sobre ${character.name}.`,
        notificationText: `Se deshizo un cambio sobre ${character.name}.`,
    });

    return buildReply('result', summaryText, {
        tool,
        undoAvailable: true,
        data: {
            characterId: character.id,
            previousValue,
            nextValue: appliedValue,
        },
    });
}

async function executeTimeSet({
    time,
    userId,
    io,
}) {
    const normalizedTime = normalizeWorldTime(time);
    if (!normalizedTime) {
        return buildReply('error', 'La hora debe tener formato HH:MM, por ejemplo 19:30.');
    }

    const [state] = await MapState.findOrCreate({ where: { id: 1 } });
    const previousValues = { global_time: state.global_time, global_location: state.global_location, day_period: state.day_period, temperature_c: state.temperature_c };
    const conditions = deriveWorldConditions(normalizedTime);
    state.global_time = conditions.time;
    state.day_period = conditions.dayPeriod;
    state.temperature_c = conditions.temperatureC;
    await state.save();
    await emitWorldRefresh(io);

    rememberUndo(userId, {
        kind: 'map_state',
        previousValues,
        undoText: 'Listo, deshice el ultimo cambio de hora/ubicacion.',
    });

    return buildReply('result', `Hora del mundo actualizada a ${state.global_time}: ${state.day_period}, ${state.temperature_c} °C.`, {
        tool: 'world.time.set',
        undoAvailable: true,
        data: {
            global_time: state.global_time,
            global_location: state.global_location,
            day_period: state.day_period,
            temperature_c: state.temperature_c,
        },
    });
}

async function executeLocationSet({
    location,
    userId,
    io,
}) {
    const cleanLocation = String(location || '').trim();
    if (!cleanLocation) {
        return buildReply('error', 'La ubicacion no puede estar vacia.');
    }

    const [state] = await MapState.findOrCreate({ where: { id: 1 } });
    const previousValues = { global_time: state.global_time, global_location: state.global_location };
    state.global_location = cleanLocation.slice(0, 120);
    await state.save();
    await emitWorldRefresh(io);

    rememberUndo(userId, {
        kind: 'map_state',
        previousValues,
        undoText: 'Listo, deshice el ultimo cambio de hora/ubicacion.',
    });

    return buildReply('result', `Ubicacion global actualizada a ${state.global_location}.`, {
        tool: 'world.location.set',
        undoAvailable: true,
        data: {
            global_time: state.global_time,
            global_location: state.global_location,
        },
    });
}

async function executeQuestObjectiveToggle({
    questTarget,
    objectiveTarget,
    completed,
    userId,
    io,
    getCalculatedPartyStats,
}) {
    const resolvedQuest = await resolveQuest(questTarget);
    if (!resolvedQuest.ok) {
        const extra = resolvedQuest.ambiguous ? { suggestions: resolvedQuest.matches } : { suggestions: HELP_SUGGESTIONS.slice(0, 5) };
        return buildReply('error', resolvedQuest.error, extra);
    }

    const quest = await Quest.findByPk(resolvedQuest.quest.id, { include: Character });
    const resolvedObjective = resolveObjective(quest, objectiveTarget);
    if (!resolvedObjective.ok) {
        const extra = resolvedObjective.ambiguous ? { suggestions: resolvedObjective.matches } : { suggestions: [quest.title, 'contexto', 'deshacer'] };
        return buildReply('error', resolvedObjective.error, extra);
    }

    const previousObjectives = cloneJson(quest.objectives) || [];
    const previousStatus = quest.status;
    const objectives = cloneJson(quest.objectives) || [];
    objectives[resolvedObjective.objectiveIndex] = {
        ...objectives[resolvedObjective.objectiveIndex],
        completed,
    };
    quest.objectives = objectives;

    const allDone = objectives.length > 0 && objectives.every((objective) => !!objective.completed);
    if (allDone && completed && quest.status !== 'Fallida') {
        quest.status = 'Completada';
    } else if (!allDone && quest.status === 'Completada') {
        quest.status = 'En Progreso';
    }

    quest.changed('objectives', true);
    await quest.save();
    await emitQuestRefresh(io, getCalculatedPartyStats);

    const objectiveLabel = resolvedObjective.objective.text || `Objetivo ${resolvedObjective.objective.id || resolvedObjective.objectiveIndex + 1}`;
    const ownerName = quest.Character ? quest.Character.name : 'el grupo';
    if (completed) {
        io.emit('notification', {
            text: `${ownerName} completo: ${objectiveLabel}`,
            type: 'objective_success',
        });
    }
    if (quest.status === 'Completada' && previousStatus !== 'Completada') {
        io.emit('notification', {
            text: `Mision completada: ${quest.title}`,
            type: 'quest_success',
        });
    }

    rememberUndo(userId, {
        kind: 'quest_progress',
        questId: quest.id,
        previousObjectives,
        previousStatus,
        undoText: `Listo, deshice el ultimo cambio sobre la mision ${quest.title}.`,
        notificationText: `Se deshizo un cambio sobre la mision ${quest.title}.`,
    });

    const replyLines = [
        `Mision "${quest.title}": ${completed ? 'marque' : 'desmarque'} "${objectiveLabel}".`,
    ];
    if (quest.status !== previousStatus) {
        replyLines.push(`Estado: ${previousStatus} -> ${quest.status}.`);
    }

    return buildReply('result', replyLines.join('\n'), {
        tool: 'quest.objective.toggle',
        undoAvailable: true,
        data: {
            questId: quest.id,
            objectiveId: resolvedObjective.objective.id || resolvedObjective.objectiveIndex + 1,
            completed,
            status: quest.status,
        },
    });
}

async function executeNpcActivation({
    target,
    active,
    userId,
    io,
    getCalculatedPartyStats,
}) {
    const resolved = await resolveCharacter(target);
    if (!resolved.ok) {
        const extra = resolved.ambiguous ? { suggestions: resolved.matches } : { suggestions: HELP_SUGGESTIONS.slice(0, 5) };
        return buildReply('error', resolved.error, extra);
    }

    const npc = await Character.findByPk(resolved.character.id, {
        attributes: ['id', 'name', 'is_npc', 'owner_id', 'is_active'],
    });
    if (!npc?.is_npc) {
        return buildReply('error', `${resolved.character.name} no es un NPC.`, {
            suggestions: ['contexto', 'ayuda'],
        });
    }

    const previousStates = npc.owner_id
        ? (await Character.findAll({
            where: { owner_id: npc.owner_id, is_npc: true },
            attributes: ['id', 'is_active'],
        })).map((character) => ({ id: character.id, is_active: !!character.is_active }))
        : [{ id: npc.id, is_active: !!npc.is_active }];

    if (npc.owner_id && active) {
        await Character.update({ is_active: false }, {
            where: { owner_id: npc.owner_id, is_npc: true },
        });
    }

    npc.is_active = !!active;
    await npc.save();
    await emitNpcRefresh(io, getCalculatedPartyStats);

    const owner = npc.owner_id ? await Character.findByPk(npc.owner_id, { attributes: ['id', 'name'] }) : null;
    io.emit('notification', {
        text: active
            ? owner ? `${npc.name} se une al grupo de ${owner.name}.` : `${npc.name} ahora esta activo.`
            : owner ? `${npc.name} deja de acompanar a ${owner.name}.` : `${npc.name} ya no esta activo.`,
        type: 'dm_assistant',
    });

    rememberUndo(userId, {
        kind: 'npc_activation',
        previousStates,
        undoText: 'Listo, deshice el ultimo cambio de aliados activos.',
        notificationText: 'Se deshizo un cambio sobre los aliados activos.',
    });

    return buildReply(
        'result',
        active
            ? `${npc.name}${owner ? ` se activo para ${owner.name}` : ' ahora esta activo'}.`
            : `${npc.name}${owner ? ` ya no acompana a ${owner.name}` : ' ya no esta activo'}.`,
        {
            tool: 'npc.activate',
            undoAvailable: true,
            data: {
                characterId: npc.id,
                active: !!active,
            },
        }
    );
}

async function executeNpcRoleSet({
    target,
    npcType,
    activeInParty,
    userId,
    io,
    getCalculatedPartyStats,
}) {
    const resolved = await resolveCharacter(target);
    if (!resolved.ok) {
        const extra = resolved.ambiguous ? { suggestions: resolved.matches } : { suggestions: HELP_SUGGESTIONS.slice(0, 5) };
        return buildReply('error', resolved.error, extra);
    }

    const npc = await Character.findByPk(resolved.character.id, {
        attributes: ['id', 'name', 'is_npc', 'npc_type', 'is_active', 'owner_id'],
    });
    if (!npc?.is_npc) {
        return buildReply('error', `${resolved.character.name} no es un NPC.`, {
            suggestions: ['contexto', 'ayuda'],
        });
    }

    const normalizedType = String(npcType || '').trim();
    const allowedTypes = new Set(['neutral', 'amigo', 'compañero', 'enemigo']);
    if (!allowedTypes.has(normalizedType)) {
        return buildReply('error', `Tipo de NPC invalido: ${npcType}.`, {
            suggestions: ['neutral', 'amigo', 'compañero', 'enemigo'],
        });
    }

    const previousValues = {
        npc_type: npc.npc_type,
        is_active: !!npc.is_active,
        owner_id: npc.owner_id,
    };

    if (activeInParty === true && npc.owner_id) {
        await Character.update({ is_active: false }, {
            where: { owner_id: npc.owner_id, is_npc: true },
        });
    }

    npc.npc_type = normalizedType;
    if (typeof activeInParty === 'boolean') {
        npc.is_active = activeInParty;
    }
    await npc.save();
    await emitNpcRefresh(io, getCalculatedPartyStats);

    rememberUndo(userId, {
        kind: 'npc_state',
        npcId: npc.id,
        previousValues,
        undoText: `Listo, deshice el ultimo cambio de rol sobre ${npc.name}.`,
        notificationText: `Se deshizo un cambio de rol sobre ${npc.name}.`,
    });

    const roleText = normalizedType === 'compañero' ? 'compañero' : normalizedType;
    const statusLine = typeof activeInParty === 'boolean'
        ? activeInParty ? 'Ahora tambien esta activo en la party.' : 'Ya no figura como activo en la party.'
        : null;

    io.emit('notification', {
        text: statusLine
            ? `${npc.name} ahora es ${roleText} y ${activeInParty ? 'entra' : 'sale'} de la party.`
            : `${npc.name} ahora es ${roleText}.`,
        type: 'dm_assistant',
    });

    return buildReply('result', [
        `${npc.name} ahora es ${roleText}.`,
        statusLine,
    ].filter(Boolean).join('\n'), {
        tool: 'npc.role.set',
        undoAvailable: true,
        data: {
            characterId: npc.id,
            npcType: normalizedType,
            isActive: !!npc.is_active,
        },
    });
}

async function executeTimelinePost({
    content,
    sceneId,
    io,
}) {
    const cleanContent = String(content || '').trim();
    if (!cleanContent) {
        return buildReply('error', 'La narracion no puede estar vacia.');
    }

    const newMessage = await TimelineEvent.create({
        type: 'SYSTEM',
        content: cleanContent.slice(0, 4000),
        author_id: null,
        scene_id: sceneId || null,
        metadata: {
            mode: 'SAY',
            source: 'dm_assistant',
        },
    });

    const fullMessage = await TimelineEvent.findByPk(newMessage.id, {
        include: [{ model: Character, as: 'author' }],
    });
    io.emit('new-message', fullMessage);

    return buildReply(
        'result',
        sceneId
            ? 'Publique una narracion en la escena actual.'
            : 'Publique una narracion en el timeline global. Si quieres verla dentro del chat de una escena, usa el assistant desde Chronicle.',
        {
            tool: 'timeline.post',
            data: {
                eventId: newMessage.id,
                sceneId: newMessage.scene_id,
                type: newMessage.type,
            },
        }
    );
}

async function getAssistantPlanningContext({ sceneId, getCalculatedPartyStats }) {
    const baseContext = await getAssistantContext({ sceneId, getCalculatedPartyStats });

    const [characters, quests, richScene, recentTimeline] = await Promise.all([
        Character.findAll({
            attributes: ['id', 'name', 'class', 'level', 'hp_current', 'hp_max', 'xp', 'gold', 'inspiration', 'is_npc', 'npc_type', 'is_active', 'owner_id'],
            limit: 80,
            order: [['name', 'ASC']],
        }),
        Quest.findAll({
            attributes: ['id', 'title', 'status', 'objectives'],
            include: [{ model: Character, attributes: ['id', 'name'] }],
            limit: 40,
            order: [['updatedAt', 'DESC']],
        }),
        sceneId ? Scene.findByPk(sceneId, {
            attributes: ['id', 'title', 'status', 'location'],
            include: [{ model: Character, as: 'participants', attributes: ['id', 'name', 'is_npc'] }],
        }) : null,
        sceneId ? TimelineEvent.findAll({
            where: { scene_id: sceneId },
            attributes: ['id', 'type', 'content', 'metadata', 'timestamp'],
            include: [{ model: Character, as: 'author', attributes: ['id', 'name'] }],
            limit: 8,
            order: [['timestamp', 'DESC']],
        }) : [],
    ]);

    return {
        world: baseContext.world,
        scene: richScene ? {
            id: richScene.id,
            title: richScene.title,
            status: richScene.status,
            location: richScene.location,
            participants: Array.isArray(richScene.participants)
                ? richScene.participants.map((participant) => ({
                    id: participant.id,
                    name: participant.name,
                    isNpc: !!participant.is_npc,
                }))
                : [],
        } : baseContext.scene,
        party: baseContext.party,
        injured: baseContext.injured,
        questCount: baseContext.questCount,
        characters: characters.map((character) => ({
            id: character.id,
            name: character.name,
            class: character.class,
            level: character.level,
            hp: character.hp_current,
            maxHp: character.hp_max,
            xp: character.xp || 0,
            gold: character.gold || 0,
            inspiration: !!character.inspiration,
            isNpc: !!character.is_npc,
            npcType: character.npc_type || null,
            isActive: !!character.is_active,
            ownerId: character.owner_id,
        })),
        quests: quests.map((quest) => ({
            id: quest.id,
            title: quest.title,
            status: quest.status,
            owner: quest.Character ? quest.Character.name : null,
            objectives: Array.isArray(quest.objectives)
                ? quest.objectives.map((objective, index) => ({
                    id: objective.id || index + 1,
                    text: String(objective.text || '').slice(0, 180),
                    completed: !!objective.completed,
                }))
                : [],
        })),
        recentTimeline: Array.isArray(recentTimeline)
            ? recentTimeline.reverse().map((event) => ({
                id: event.id,
                type: event.type,
                author: event.author ? event.author.name : 'DM',
                content: String(event.content || '').slice(0, 220),
                mode: event.metadata?.mode || 'SAY',
                timestamp: event.timestamp,
            }))
            : [],
    };
}

async function executeStructuredToolCall({
    toolCall,
    sceneId,
    user,
    io,
    getCalculatedPartyStats,
}) {
    switch (toolCall.tool) {
        case 'help':
            return buildReply(
                'help',
                [
                    'Puedo ayudarte con comandos operativos de DM.',
                    '',
                    'Ejemplos:',
                    ...HELP_SUGGESTIONS.map((item) => `- ${item}`),
                ].join('\n'),
                {
                    tool: 'help',
                    suggestions: HELP_SUGGESTIONS,
                }
            );
        case 'action.undo':
            return applyUndo({ userId: user.id, io, getCalculatedPartyStats });
        case 'session.get_context': {
            const context = await getAssistantContext({ sceneId, getCalculatedPartyStats });
            return buildReply('context', formatContextText(context), {
                tool: 'session.get_context',
                data: context,
                suggestions: HELP_SUGGESTIONS.slice(1, 6),
            });
        }
        case 'character.get':
            return readCharacterStatus(toolCall.target);
        case 'character.hp.set':
            return updateCharacterField({
                target: toolCall.target,
                field: 'hp_current',
                nextValue: clampNumber(toolCall.value, 0, 9999),
                userId: user.id,
                io,
                getCalculatedPartyStats,
                tool: 'character.hp.set',
                summaryBuilder: (character, previousValue, nextValue) => `${character.name}: PG ${previousValue} -> ${nextValue}.`,
                notificationBuilder: (character, _previousValue, nextValue) => `${character.name} ahora tiene ${nextValue} PG.`,
            });
        case 'character.hp.adjust': {
            const resolved = await resolveCharacter(toolCall.target);
            if (!resolved.ok) {
                const extra = resolved.ambiguous ? { suggestions: resolved.matches } : { suggestions: HELP_SUGGESTIONS.slice(0, 4) };
                return buildReply('error', resolved.error, extra);
            }
            const amount = Number(toolCall.amount) || 0;
            const nextValue = clampNumber((resolved.character.hp_current || 0) + amount, 0, resolved.character.hp_max || 9999);
            const absAmount = Math.abs(amount);
            return updateCharacterField({
                target: toolCall.target,
                field: 'hp_current',
                nextValue,
                userId: user.id,
                io,
                getCalculatedPartyStats,
                tool: 'character.hp.adjust',
                summaryBuilder: (character, previousValue, finalValue) => amount >= 0
                    ? `${character.name} recupera ${absAmount} PG: ${previousValue} -> ${finalValue}.`
                    : `${character.name} pierde ${absAmount} PG: ${previousValue} -> ${finalValue}.`,
                notificationBuilder: (character) => amount >= 0
                    ? `${character.name} recupera ${absAmount} PG.`
                    : `${character.name} pierde ${absAmount} PG.`,
            });
        }
        case 'character.xp.adjust': {
            const resolved = await resolveCharacter(toolCall.target);
            if (!resolved.ok) {
                const extra = resolved.ambiguous ? { suggestions: resolved.matches } : { suggestions: HELP_SUGGESTIONS.slice(0, 4) };
                return buildReply('error', resolved.error, extra);
            }
            const amount = Number(toolCall.amount) || 0;
            const nextValue = Math.max(0, (resolved.character.xp || 0) + amount);
            return updateCharacterField({
                target: toolCall.target,
                field: 'xp',
                nextValue,
                userId: user.id,
                io,
                getCalculatedPartyStats,
                tool: 'character.xp.adjust',
                summaryBuilder: (character, previousValue, finalValue) => `${character.name}: XP ${previousValue} -> ${finalValue}.`,
                notificationBuilder: (character) => `${character.name} ${amount >= 0 ? 'gana' : 'pierde'} ${Math.abs(amount)} XP.`,
            });
        }
        case 'character.gold.adjust': {
            const resolved = await resolveCharacter(toolCall.target);
            if (!resolved.ok) {
                const extra = resolved.ambiguous ? { suggestions: resolved.matches } : { suggestions: HELP_SUGGESTIONS.slice(0, 4) };
                return buildReply('error', resolved.error, extra);
            }
            const amount = Number(toolCall.amount) || 0;
            const nextValue = Math.max(0, (resolved.character.gold || 0) + amount);
            return updateCharacterField({
                target: toolCall.target,
                field: 'gold',
                nextValue,
                userId: user.id,
                io,
                getCalculatedPartyStats,
                tool: 'character.gold.adjust',
                summaryBuilder: (character, previousValue, finalValue) => `${character.name}: oro ${previousValue} -> ${finalValue}.`,
                notificationBuilder: (character) => `${character.name} ${amount >= 0 ? 'recibe' : 'pierde'} ${Math.abs(amount)} de oro.`,
            });
        }
        case 'character.inspiration.set':
            return updateCharacterField({
                target: toolCall.target,
                field: 'inspiration',
                nextValue: !!toolCall.value,
                userId: user.id,
                io,
                getCalculatedPartyStats,
                tool: 'character.inspiration.set',
                summaryBuilder: (character, previousValue, finalValue) => `${character.name}: inspiracion ${previousValue ? 'si' : 'no'} -> ${finalValue ? 'si' : 'no'}.`,
                notificationBuilder: (character) => `${character.name} ${toolCall.value ? 'recibe' : 'pierde'} inspiracion.`,
            });
        case 'world.time.set':
            return executeTimeSet({ time: toolCall.time, userId: user.id, io });
        case 'world.location.set':
            return executeLocationSet({ location: toolCall.location, userId: user.id, io });
        case 'quest.objective.toggle':
            return executeQuestObjectiveToggle({
                questTarget: toolCall.questTarget,
                objectiveTarget: toolCall.objectiveTarget,
                completed: toolCall.completed,
                userId: user.id,
                io,
                getCalculatedPartyStats,
            });
        case 'npc.activate':
            return executeNpcActivation({
                target: toolCall.target,
                active: toolCall.active,
                userId: user.id,
                io,
                getCalculatedPartyStats,
            });
        case 'npc.role.set':
            return executeNpcRoleSet({
                target: toolCall.target,
                npcType: toolCall.npcType,
                activeInParty: Object.prototype.hasOwnProperty.call(toolCall, 'activeInParty') ? toolCall.activeInParty : undefined,
                userId: user.id,
                io,
                getCalculatedPartyStats,
            });
        case 'npc.create':
            return createNpcFromAssistant({ fields: toolCall.fields || {}, io, getCalculatedPartyStats });
        case 'npc.update':
            return updateNpcFromAssistant({ target: toolCall.target, fields: toolCall.fields || {}, io, getCalculatedPartyStats });
        case 'npc.image.generate':
            return generateNpcImageFromAssistant({
                target: toolCall.target,
                prompt: toolCall.prompt,
                quality: toolCall.quality,
                userId: user.id,
                io,
                getCalculatedPartyStats,
            });
        case 'npc.delete.request':
            return requestDeletion({ entity: 'npc', target: toolCall.target, userId: user.id });
        case 'item.create':
            return createItemFromAssistant({ fields: toolCall.fields || {}, io });
        case 'item.update':
            return updateItemFromAssistant({ target: toolCall.target, fields: toolCall.fields || {}, io });
        case 'item.delete.request':
            return requestDeletion({ entity: 'item', target: toolCall.target, userId: user.id });
        case 'action.delete.confirm':
            return confirmDeletion({ userId: user.id, io, getCalculatedPartyStats });
        case 'timeline.post':
            return executeTimelinePost({
                content: toolCall.content,
                sceneId,
                io,
            });
        default:
            return buildReply('error', `No se ejecutar la tool ${toolCall.tool}.`, {
                suggestions: HELP_SUGGESTIONS.slice(0, 4),
            });
    }
}

async function executeStructuredToolBatch({
    toolCalls,
    sceneId,
    user,
    io,
    getCalculatedPartyStats,
    preface,
    suggestions,
}) {
    const successfulReplies = [];
    let undoAvailable = false;
    let replyKind = 'result';

    for (const toolCall of toolCalls) {
        const result = await executeStructuredToolCall({
            toolCall,
            sceneId,
            user,
            io,
            getCalculatedPartyStats,
        });

        if (!result.ok) {
            if (!successfulReplies.length) {
                return result;
            }

            return buildReply('error', [
                'Ejecute estas acciones antes de frenarme:',
                ...successfulReplies.map((text, index) => `${index + 1}. ${text}`),
                '',
                `Luego me detuve con este problema: ${result.reply.text}`,
                'Si hace falta, puedes usar deshacer.',
            ].join('\n'), {
                tool: 'assistant.tool_batch',
                undoAvailable,
                suggestions: result.reply.suggestions || suggestions || ['deshacer', 'contexto', 'ayuda'],
            });
        }

        successfulReplies.push(result.reply.text);
        undoAvailable = undoAvailable || !!result.reply.undoAvailable;
        if (result.reply.kind === 'context' || result.reply.kind === 'reply') {
            replyKind = result.reply.kind;
        }
    }

    const batchText = toolCalls.length > 1
        ? successfulReplies.map((text, index) => `${index + 1}. ${text}`).join('\n')
        : successfulReplies[0];

    return buildReply(replyKind, preface
        ? `${preface}\n\n${batchText}`
        : batchText, {
        tool: toolCalls.length > 1 ? 'assistant.tool_batch' : toolCalls[0].tool,
        undoAvailable,
        suggestions: suggestions && suggestions.length ? suggestions : HELP_SUGGESTIONS.slice(0, 6),
    });
}

async function executeAiAssistantFallback({
    message,
    history,
    sceneId,
    user,
    io,
    getCalculatedPartyStats,
}) {
    try {
        return await runAssistantConversation({
            message,
            history,
            defaultSuggestions: HELP_SUGGESTIONS,
            executeTool: (toolCall) => executeStructuredToolCall({
                toolCall,
                sceneId,
                user,
                io,
                getCalculatedPartyStats,
            }),
        });
    } catch (err) {
        console.error('DM Assistant LLM fallback error:', err);
        if (err?.code === 'NO_API_KEY') {
            return buildReply('info', 'El Oráculo no tiene configurada la conexión con OpenAI en el servidor. Un administrador debe configurar OPENAI_API_KEY y reiniciar únicamente el proceso dndworld.', {
                tool: 'assistant.configuration',
                suggestions: ['contexto', 'ayuda'],
            });
        }
        if (err?.status === 401 || err?.status === 403) {
            return buildReply('info', 'El Oráculo no pudo autenticarse con OpenAI. La credencial configurada en el servidor debe revisarse.', {
                tool: 'assistant.authentication',
                suggestions: ['contexto', 'ayuda'],
            });
        }
        if (err?.status === 429 && err?.error?.code === 'insufficient_quota') {
            return buildReply('info', 'El Oráculo no puede consultar la IA porque la clave de OpenAI no tiene créditos disponibles. Recargá la cuenta o configurá una clave con facturación activa; las herramientas de lenguaje natural se habilitarán automáticamente.', {
                tool: 'assistant.billing',
                suggestions: ['contexto', 'ayuda'],
            });
        }
        if (err?.status === 429) {
            return buildReply('info', 'El Oráculo alcanzó temporalmente el límite de solicitudes de OpenAI. Esperá unos segundos y volvé a intentar.', {
                tool: 'assistant.rate_limit',
                suggestions: ['contexto', 'ayuda'],
            });
        }
        if (Number(err?.status) >= 500) {
            return buildReply('info', 'OpenAI no está disponible temporalmente. El estado de la campaña sigue intacto; volvé a intentar en unos segundos.', {
                tool: 'assistant.upstream',
                suggestions: ['contexto', 'ayuda'],
            });
        }
        return null;
    }
}

async function executeAssistantCommand({
    message,
    history,
    sceneId,
    user,
    io,
    getCalculatedPartyStats,
}) {
    const trimmed = String(message || '').trim();
    if (!trimmed) {
        return buildReply('error', 'Escribe un comando para que pueda ayudarte.');
    }

    const aiPrimaryResult = await executeAiAssistantFallback({
        message: trimmed,
        history,
        sceneId,
        user,
        io,
        getCalculatedPartyStats,
    });
    if (aiPrimaryResult) {
        return aiPrimaryResult;
    }

    if (isHelpCommand(trimmed)) {
        return buildReply(
            'help',
            [
                'Puedo ayudarte con comandos operativos de DM.',
                '',
                'Ejemplos:',
                ...HELP_SUGGESTIONS.map((item) => `- ${item}`),
            ].join('\n'),
            {
                tool: 'help',
                suggestions: HELP_SUGGESTIONS,
            }
        );
    }

    if (isUndoCommand(trimmed)) {
        return applyUndo({ userId: user.id, io, getCalculatedPartyStats });
    }

    if (isContextCommand(trimmed)) {
        const context = await getAssistantContext({ sceneId, getCalculatedPartyStats });
        return buildReply('context', formatContextText(context), {
            tool: 'session.get_context',
            data: context,
            suggestions: HELP_SUGGESTIONS.slice(1, 6),
        });
    }

    let match = trimmed.match(/^(?:estado|ficha|vida|hp|stats)\s+(?:de\s+)?(.+)$/i);
    if (match) {
        return readCharacterStatus(match[1]);
    }

    match = trimmed.match(/^(?:pone|ponele|pon[eé]|deja|setea)\s+(?:la\s+vida|los\s+pg|hp)\s+(?:de\s+)?(.+?)\s+(?:en|a)\s+(\d+)$/i);
    if (match) {
        const target = match[1];
        const rawValue = parseInt(match[2], 10);
        return updateCharacterField({
            target,
            field: 'hp_current',
            nextValue: clampNumber(rawValue, 0, 9999),
            userId: user.id,
            io,
            getCalculatedPartyStats,
            tool: 'character.hp.set',
            summaryBuilder: (character, previousValue, nextValue) => `${character.name}: PG ${previousValue} -> ${nextValue}.`,
            notificationBuilder: (character, _previousValue, nextValue) => `${character.name} ahora tiene ${nextValue} PG.`,
        });
    }

    match = trimmed.match(/^(?:cura|curale|cura(le)?|sana|subile|sube)\s+(\d+)\s*(?:pg|hp|vida)?\s+(?:a|al)?\s+(.+)$/i);
    if (match) {
        const amount = parseInt(match[2], 10);
        const target = match[3];
        const resolved = await resolveCharacter(target);
        if (!resolved.ok) {
            const extra = resolved.ambiguous ? { suggestions: resolved.matches } : { suggestions: HELP_SUGGESTIONS.slice(0, 4) };
            return buildReply('error', resolved.error, extra);
        }
        const nextValue = clampNumber((resolved.character.hp_current || 0) + amount, 0, resolved.character.hp_max || 9999);
        return updateCharacterField({
            target,
            field: 'hp_current',
            nextValue,
            userId: user.id,
            io,
            getCalculatedPartyStats,
            tool: 'character.hp.adjust',
            summaryBuilder: (character, previousValue, finalValue) => `${character.name} recupera ${amount} PG: ${previousValue} -> ${finalValue}.`,
            notificationBuilder: (character, _previousValue, _finalValue) => `${character.name} recupera ${amount} PG.`,
        });
    }

    match = trimmed.match(/^(?:bajale|baja|restale|resta|quitale|quita|sacale|reduce|dana|daña)\s+(\d+)\s*(?:pg|hp|vida)?\s+(?:a|al)?\s+(.+)$/i)
        || trimmed.match(/^(\d+)\s+(?:puntos?\s+menos|menos)\s+(?:de\s+vida|pg|hp)?\s+(?:a|al|para)\s+(.+)$/i);
    if (match) {
        const amount = parseInt(match[1], 10);
        const target = match[2];
        const resolved = await resolveCharacter(target);
        if (!resolved.ok) {
            const extra = resolved.ambiguous ? { suggestions: resolved.matches } : { suggestions: HELP_SUGGESTIONS.slice(0, 4) };
            return buildReply('error', resolved.error, extra);
        }
        const nextValue = clampNumber((resolved.character.hp_current || 0) - amount, 0, resolved.character.hp_max || 9999);
        return updateCharacterField({
            target,
            field: 'hp_current',
            nextValue,
            userId: user.id,
            io,
            getCalculatedPartyStats,
            tool: 'character.hp.adjust',
            summaryBuilder: (character, previousValue, finalValue) => `${character.name} pierde ${amount} PG: ${previousValue} -> ${finalValue}.`,
            notificationBuilder: (character, _previousValue, _finalValue) => `${character.name} pierde ${amount} PG.`,
        });
    }

    match = trimmed.match(/^(?:sumale|suma|agrega|anade|añade|dale)\s+(\d+)\s*xp\s+(?:a|al)?\s+(.+)$/i)
        || trimmed.match(/^(?:quitale|quita|restale|resta)\s+(\d+)\s*xp\s+(?:a|al)?\s+(.+)$/i);
    if (match) {
        const isNegative = /^(?:quitale|quita|restale|resta)/i.test(trimmed);
        const amount = parseInt(match[1], 10) * (isNegative ? -1 : 1);
        const target = match[2];
        const resolved = await resolveCharacter(target);
        if (!resolved.ok) {
            const extra = resolved.ambiguous ? { suggestions: resolved.matches } : { suggestions: HELP_SUGGESTIONS.slice(0, 4) };
            return buildReply('error', resolved.error, extra);
        }
        const nextValue = Math.max(0, (resolved.character.xp || 0) + amount);
        return updateCharacterField({
            target,
            field: 'xp',
            nextValue,
            userId: user.id,
            io,
            getCalculatedPartyStats,
            tool: 'character.xp.adjust',
            summaryBuilder: (character, previousValue, finalValue) => `${character.name}: XP ${previousValue} -> ${finalValue}.`,
            notificationBuilder: (character, _previousValue, _finalValue) => `${character.name} ${amount >= 0 ? 'gana' : 'pierde'} ${Math.abs(amount)} XP.`,
        });
    }

    match = trimmed.match(/^(?:sumale|suma|agrega|anade|añade|dale)\s+(\d+)\s+(?:oro|gold|mo)\s+(?:a|al)?\s+(.+)$/i)
        || trimmed.match(/^(?:quitale|quita|restale|resta)\s+(\d+)\s+(?:oro|gold|mo)\s+(?:a|al)?\s+(.+)$/i);
    if (match) {
        const isNegative = /^(?:quitale|quita|restale|resta)/i.test(trimmed);
        const amount = parseInt(match[1], 10) * (isNegative ? -1 : 1);
        const target = match[2];
        const resolved = await resolveCharacter(target);
        if (!resolved.ok) {
            const extra = resolved.ambiguous ? { suggestions: resolved.matches } : { suggestions: HELP_SUGGESTIONS.slice(0, 4) };
            return buildReply('error', resolved.error, extra);
        }
        const nextValue = Math.max(0, (resolved.character.gold || 0) + amount);
        return updateCharacterField({
            target,
            field: 'gold',
            nextValue,
            userId: user.id,
            io,
            getCalculatedPartyStats,
            tool: 'character.gold.adjust',
            summaryBuilder: (character, previousValue, finalValue) => `${character.name}: oro ${previousValue} -> ${finalValue}.`,
            notificationBuilder: (character, _previousValue, _finalValue) => `${character.name} ${amount >= 0 ? 'recibe' : 'pierde'} ${Math.abs(amount)} de oro.`,
        });
    }

    match = trimmed.match(/^(?:dale|ponele|pon[eé]|activa)\s+inspiracion\s+(?:a|al)?\s+(.+)$/i);
    if (match) {
        return updateCharacterField({
            target: match[1],
            field: 'inspiration',
            nextValue: true,
            userId: user.id,
            io,
            getCalculatedPartyStats,
            tool: 'character.inspiration.set',
            summaryBuilder: (character, previousValue, finalValue) => `${character.name}: inspiracion ${previousValue ? 'si' : 'no'} -> ${finalValue ? 'si' : 'no'}.`,
            notificationBuilder: (character) => `${character.name} recibe inspiracion.`,
        });
    }

    match = trimmed.match(/^(?:quitale|desactiva|sacale)\s+inspiracion\s+(?:a|al)?\s+(.+)$/i);
    if (match) {
        return updateCharacterField({
            target: match[1],
            field: 'inspiration',
            nextValue: false,
            userId: user.id,
            io,
            getCalculatedPartyStats,
            tool: 'character.inspiration.set',
            summaryBuilder: (character, previousValue, finalValue) => `${character.name}: inspiracion ${previousValue ? 'si' : 'no'} -> ${finalValue ? 'si' : 'no'}.`,
            notificationBuilder: (character) => `${character.name} pierde inspiracion.`,
        });
    }

    match = trimmed.match(/^(?:pone|pon[eé]|cambia|setea)\s+(?:la\s+)?hora\s+(?:a|en)\s+(\d{1,2}:\d{2})$/i);
    if (match) {
        return executeTimeSet({ time: match[1], userId: user.id, io });
    }

    match = trimmed.match(/^(?:pone|pon[eé]|cambia|setea)\s+(?:la\s+)?(?:ubicacion|localizacion|lugar)\s+(?:a|en)\s+(.+)$/i);
    if (match) {
        return executeLocationSet({ location: match[1], userId: user.id, io });
    }

    match = trimmed.match(/^(?:completa|marca|tilda|checkea)\s+(?:el\s+)?objetivo\s+(.+?)\s+de\s+(?:la\s+)?misi[oó]n\s+(.+)$/i);
    if (match) {
        return executeQuestObjectiveToggle({
            objectiveTarget: match[1],
            questTarget: match[2],
            completed: true,
            userId: user.id,
            io,
            getCalculatedPartyStats,
        });
    }

    match = trimmed.match(/^(?:desmarca|destilda|reabre|rehabre|descheckea)\s+(?:el\s+)?objetivo\s+(.+?)\s+de\s+(?:la\s+)?misi[oó]n\s+(.+)$/i);
    if (match) {
        return executeQuestObjectiveToggle({
            objectiveTarget: match[1],
            questTarget: match[2],
            completed: false,
            userId: user.id,
            io,
            getCalculatedPartyStats,
        });
    }

    match = trimmed.match(/^(?:activa|trae|manda\s+al\s+grupo)\s+(?:a\s+)?(.+)$/i);
    if (match) {
        return executeNpcActivation({
            target: match[1],
            active: true,
            userId: user.id,
            io,
            getCalculatedPartyStats,
        });
    }

    match = trimmed.match(/^(?:desactiva|retira|manda\s+al\s+campamento|saca\s+del\s+grupo)\s+(?:a\s+)?(.+)$/i);
    if (match) {
        return executeNpcActivation({
            target: match[1],
            active: false,
            userId: user.id,
            io,
            getCalculatedPartyStats,
        });
    }

    match = trimmed.match(/^(?:narra|narr[aá]|postea(?:\s+en(?:\s+el)?\s+timeline)?|anota(?:\s+en(?:\s+la)?\s+escena)?|publica(?:\s+en(?:\s+el)?\s+timeline)?)\s*[:\-]?\s+(.+)$/i);
    if (match) {
        return executeTimelinePost({
            content: match[1],
            sceneId,
            io,
        });
    }

    return buildReply(
        'error',
        'Todavia no se como ejecutar ese comando. Prueba con ayuda o con uno de los ejemplos sugeridos.',
        {
            suggestions: HELP_SUGGESTIONS,
        }
    );
}

module.exports = {
    getAssistantContext,
    executeAssistantCommand,
};
