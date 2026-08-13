const { Op } = require('sequelize');
const {
    AbilityScore,
    Character,
    EquipmentSlots,
    Item,
    NpcAction,
    Spell,
} = require('../models');

const ABILITY_BY_CLASS = {
    artificer: 'INT', artificiero: 'INT', bard: 'CHA', bardo: 'CHA', cleric: 'WIS', clerigo: 'WIS',
    druid: 'WIS', druida: 'WIS', paladin: 'CHA', paladin_: 'CHA', ranger: 'WIS', explorador: 'WIS',
    sorcerer: 'CHA', hechicero: 'CHA', warlock: 'CHA', brujo: 'CHA', wizard: 'INT', mago: 'INT',
};

const ABILITY_NAMES = {
    strength: 'STR', fuerza: 'STR', dexterity: 'DEX', destreza: 'DEX', constitution: 'CON', constitucion: 'CON',
    intelligence: 'INT', inteligencia: 'INT', wisdom: 'WIS', sabiduria: 'WIS', charisma: 'CHA', carisma: 'CHA',
};

const SPELL_PROFILES = {
    'eldritch-blast': { attack: true, damage: '1d10', damageType: 'fuerza', target: 'enemy', range: 120, cantripScale: true },
    'poison-spray': { attack: true, damage: '1d12', damageType: 'veneno', target: 'enemy', range: 30, cantripScale: true },
    'fire-bolt': { attack: true, damage: '1d10', damageType: 'fuego', target: 'enemy', range: 120, cantripScale: true },
    'ray-of-frost': { attack: true, damage: '1d8', damageType: 'frio', target: 'enemy', range: 60, cantripScale: true },
    'sacred-flame': { save: 'DEX', damage: '1d8', damageType: 'radiante', target: 'enemy', range: 60, cantripScale: true },
    'healing-word': { healing: '2d4', addAbility: true, target: 'ally', range: 60, economy: 'bonus', slot: true },
    'cure-wounds': { healing: '2d8', addAbility: true, target: 'ally', range: 5, slot: true },
    fireball: { save: 'DEX', damage: '8d6', damageType: 'fuego', target: 'area-enemy', range: 150, area: { shape: 'circle', feet: 20 }, halfOnSave: true, slot: true },
    'burning-hands': { save: 'DEX', damage: '3d6', damageType: 'fuego', target: 'area-enemy', area: { shape: 'cone', feet: 15 }, halfOnSave: true, slot: true },
    'thunderwave': { save: 'CON', damage: '2d8', damageType: 'trueno', target: 'area-enemy', area: { shape: 'square', feet: 15 }, halfOnSave: true, slot: true },
    'magic-missile': { damage: '3d4+3', damageType: 'fuerza', target: 'enemy', range: 120, slot: true },
    'acid-splash': { save: 'DEX', damage: '1d6', damageType: 'acido', target: 'area-enemy', range: 60, area: { shape: 'circle', feet: 5 }, cantripScale: true },
    hex: { utility: true, target: 'enemy', range: 90, economy: 'bonus', slot: true, effect: { type: 'MARK_EXTRA_DAMAGE', damage: '1d6', damageType: 'necrotico' } },
    'armor-of-agathys': { utility: true, target: 'self', range: 0, economy: 'bonus', slot: true, temporaryHp: 5, effect: { type: 'TEMP_HP_RETALIATION', damage: 5, damageType: 'frio' } },
    shield: { utility: true, target: 'self', range: 0, economy: 'reaction', slot: true, trigger: 'ATTACK_HIT_BEFORE_DAMAGE', reactionEffect: { type: 'AC_BONUS', bonus: 5 } },
    'hellish-rebuke': { save: 'DEX', damage: '2d10', damageType: 'fuego', target: 'enemy', range: 60, economy: 'reaction', slot: true, trigger: 'DAMAGE_TAKEN', reactionEffect: { type: 'COUNTER_DAMAGE' } },
    'absorb-elements': { utility: true, target: 'self', range: 0, economy: 'reaction', slot: true, trigger: 'ATTACK_HIT_BEFORE_DAMAGE', reactionEffect: { type: 'RESIST_TRIGGERING_DAMAGE' } },
    counterspell: { utility: true, target: 'enemy', range: 60, economy: 'reaction', slot: true, trigger: 'SPELL_CAST_NEARBY', reactionEffect: { type: 'CANCEL_SPELL' } },
};

const CUSTOM_SPELL_ALIASES = {
    'descarga sobrenatural': 'eldritch-blast',
    'ilusion menor': 'minor-illusion',
    maleficio: 'hex',
    'armadura de agathys': 'armor-of-agathys',
};

const NPC_ACTION_PROFILES = {
    'cadena rota': { target: 'enemy', range: 30, effect: { type: 'SAVE_CONDITION', conditions: ['Apresado'] } },
    'daga corta': { extraDamage: ['1d6'], extraDamageType: 'veneno' },
    'ancla de sombra': { target: 'area-enemy', range: 30, area: { shape: 'circle', feet: 10 }, effect: { type: 'SAVE_CONDITION', conditions: ['Asustado', 'Ralentizado'] } },
    'grito quebrado': { trigger: 'ENEMY_LEAVES_REACH', reactionEffect: { type: 'FORCED_SAVE', saveAbility: 'CON', saveDc: 13, condition: 'Aturdido' } },
    'daga ignea': { extraDamage: ['1d6'], extraDamageType: 'fuego' },
    'fuego sectorial': { target: 'area-enemy', range: 60, area: { shape: 'square', feet: 15 }, halfOnSave: true },
    'latigazo encadenado': { target: 'enemy', range: 60, halfOnSave: true },
    'paso entre sombras': { target: 'self', movement: { type: 'TELEPORT', maxFeet: 15 } },
};

const CUSTOM_ACTION_PROFILES = {
    'acorde menor': { effect: { type: 'GRANT_NEXT_ATTACK_ADVANTAGE' } },
    'escupefuego · municion normal': { jamOnNaturalBelow: 7 },
    'escupefuego · municion runica': { jamOnNaturalBelow: 7 },
    'escupefuego · municion runica ii': { jamOnNaturalBelow: 7 },
    'escupefuego · municion de brumante': { jamOnNaturalBelow: 7 },
    'camara de ventilacion': { jamOnNaturalBelow: 7 },
    'desatascar escupefuego': { clearWeaponJam: true },
};

const REACTION_TRIGGERS = Object.freeze({
    ATTACK_TARGETED: 'ATTACK_TARGETED',
    ATTACK_ROLLED: 'ATTACK_ROLLED',
    ATTACK_HIT_BEFORE_DAMAGE: 'ATTACK_HIT_BEFORE_DAMAGE',
    DAMAGE_TAKEN: 'DAMAGE_TAKEN',
    SPELL_CAST_NEARBY: 'SPELL_CAST_NEARBY',
    ALLY_ATTACKED_NEARBY: 'ALLY_ATTACKED_NEARBY',
    ENEMY_LEAVES_REACH: 'ENEMY_LEAVES_REACH',
    CREATURE_REACHES_ZERO_HP: 'CREATURE_REACHES_ZERO_HP',
    TURN_END: 'TURN_END',
});

function inferReactionTrigger(name, description, override = {}) {
    const configured = String(override.trigger || override.reaction_trigger || override.reactionTrigger || '').toUpperCase();
    if (Object.values(REACTION_TRIGGERS).includes(configured)) return configured;
    const text = normalize(`${name} ${description}`);
    if (/contrahechizo|counterspell|lanza un conjuro/.test(text)) return REACTION_TRIGGERS.SPELL_CAST_NEARBY;
    if (/represion infernal|hellish rebuke|despues de recibir dano|cuando recibes dano/.test(text)) return REACTION_TRIGGERS.DAMAGE_TAKEN;
    if (/esquiva asombrosa|uncanny dodge|reduce.*mitad/.test(text)) return REACTION_TRIGGERS.ATTACK_HIT_BEFORE_DAMAGE;
    if (/escudo|shield|antes de que.*impact/.test(text) || override.shield) return REACTION_TRIGGERS.ATTACK_HIT_BEFORE_DAMAGE;
    if (/proteccion|intercepcion|ataca.*aliado/.test(text)) return REACTION_TRIGGERS.ALLY_ATTACKED_NEARBY;
    if (/oportunidad|abandona.*alcance|sale.*alcance/.test(text)) return REACTION_TRIGGERS.ENEMY_LEAVES_REACH;
    return REACTION_TRIGGERS.ATTACK_HIT_BEFORE_DAMAGE;
}

function inferReactionEffect(name, description, override = {}) {
    if (override.reactionEffect || override.reaction_effect) return override.reactionEffect || override.reaction_effect;
    const text = normalize(`${name} ${description}`);
    if (override.shield) return { type: 'AC_BONUS', bonus: Number(override.shield.bonus) || 5, shield: override.shield };
    if (/esquiva asombrosa|uncanny dodge|reduce.*mitad/.test(text)) return { type: 'HALVE_DAMAGE' };
    if (/represion infernal|hellish rebuke/.test(text)) return { type: 'COUNTER_DAMAGE' };
    if (/absorber elementos|absorb elements/.test(text)) return { type: 'RESIST_TRIGGERING_DAMAGE' };
    if (/contrahechizo|counterspell/.test(text)) return { type: 'CANCEL_SPELL' };
    if (/oportunidad/.test(text)) return { type: 'OPPORTUNITY_ATTACK' };
    if (override.save_dc || override.saveDc) return {
        type: 'FORCED_SAVE',
        saveAbility: override.save_ability || override.saveAbility || 'DEX',
        saveDc: Number(override.save_dc || override.saveDc),
        pushFeet: Number(text.match(/empujad[oa]\s+(\d+)\s*(?:pies|pie|feet)/)?.[1]) || 0,
        condition: /derribad|prone/.test(text) ? 'Derribado' : null,
        meleeOnly: /cuerpo a cuerpo|melee/.test(text),
    };
    return { type: 'CUSTOM' };
}

function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function inferDamageType(text) {
    const normalized = normalize(text);
    const aliases = {
        acido: ['acid', 'acido'], frio: ['cold', 'frio'], fuego: ['fire', 'fuego'], fuerza: ['force', 'fuerza'],
        relampago: ['lightning', 'relampago'], necrotico: ['necrotic', 'necrotico'], veneno: ['poison', 'veneno'],
        psiquico: ['psychic', 'psiquico'], radiante: ['radiant', 'radiante'], trueno: ['thunder', 'trueno'],
        contundente: ['bludgeoning', 'contundente'], perforante: ['piercing', 'perforante'], cortante: ['slashing', 'cortante'],
    };
    return Object.entries(aliases).find(([, names]) => names.some(name => normalized.includes(`${name} damage`) || normalized.includes(`dano ${name}`) || normalized.includes(`dano de ${name}`)))?.[0] || null;
}

function inferSaveEffect(description) {
    const text = normalize(description);
    const conditions = [
        [/apresad|restrained/, 'Apresado'], [/aturdid|stunned/, 'Aturdido'], [/cegad|blinded/, 'Cegado'],
        [/asustad|frightened/, 'Asustado'], [/derribad|prone/, 'Derribado'], [/inconsciente|unconscious/, 'Inconsciente'],
    ].filter(([pattern]) => pattern.test(text)).map(([, condition]) => condition);
    if (/velocidad.*mitad|speed.*half/.test(text)) conditions.push('Ralentizado');
    return conditions.length ? { type: 'SAVE_CONDITION', conditions: [...new Set(conditions)] } : null;
}

function signed(value) {
    const number = Number(value) || 0;
    return number >= 0 ? `+${number}` : String(number);
}

function abilityScores(character) {
    return Object.fromEntries(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map(key => {
        const row = (character.abilityScores || []).find(score => score.ability === key);
        return [key, (Number(row?.base_value) || 10) + (Number(row?.bonus_value) || 0)];
    }));
}

function abilityModifier(character, ability) {
    return Math.floor(((abilityScores(character)[ability] || 10) - 10) / 2);
}

function proficiencyBonus(character) {
    return Number(character.proficiency_bonus) || (2 + Math.floor((Math.max(1, Number(character.level) || 1) - 1) / 4));
}

function parseDiceExpression(expression) {
    const text = String(expression || '').replace(/\s+/g, '');
    const match = text.match(/^(\d{1,2})d(4|6|8|10|12|20|100)([+-]\d+)?$/i);
    if (!match) return null;
    return { quantity: Number(match[1]), sides: Number(match[2]), modifier: Number(match[3] || 0), formula: text.toLowerCase() };
}

function formatDice({ quantity, sides, modifier = 0 }) {
    return `${quantity}d${sides}${modifier > 0 ? `+${modifier}` : modifier < 0 ? modifier : ''}`;
}

function scaleCantrip(expression, level) {
    const parsed = parseDiceExpression(expression);
    if (!parsed) return expression;
    const multiplier = Number(level) >= 17 ? 4 : Number(level) >= 11 ? 3 : Number(level) >= 5 ? 2 : 1;
    return formatDice({ ...parsed, quantity: parsed.quantity * multiplier });
}

function firstDice(text) {
    const match = String(text || '').match(/(\d{1,2})d(4|6|8|10|12|20|100)(?:\s*([+-])\s*(\d+))?/i);
    if (!match) return null;
    const modifier = match[3] ? Number(`${match[3]}${match[4]}`) : 0;
    return formatDice({ quantity: Number(match[1]), sides: Number(match[2]), modifier });
}

function allDice(text) {
    return [...String(text || '').matchAll(/(\d{1,2})d(4|6|8|10|12|20|100)/gi)].map(match => `${Number(match[1])}d${Number(match[2])}`);
}

function spellAbility(character) {
    const classEntries = Array.isArray(character.classes) && character.classes.length
        ? character.classes
        : [{ slug: character.class_slug || character.class }];
    for (const entry of classEntries) {
        const found = ABILITY_BY_CLASS[normalize(entry?.slug)];
        if (found) return found;
    }
    return 'INT';
}

function spellProfile(spell, character) {
    const slug = normalize(spell.slug).replace(/\s+/g, '-');
    const text = normalize(`${spell.desc || ''} ${spell.higher_level || ''}`);
    const named = SPELL_PROFILES[slug] || {};
    const damage = named.utility ? null : named.damage || (/(damage|dano)/.test(text) ? firstDice(text) : null);
    const healing = named.utility ? null : named.healing || (/(regains?|restore|recupera|cura|hit points|puntos de golpe)/.test(text) ? firstDice(text) : null);
    const abilityWord = Object.keys(ABILITY_NAMES).find(word => text.includes(`${word} saving throw`) || text.includes(`salvacion de ${word}`));
    const attack = named.attack ?? /(spell attack|ataque de conjuro|ataque magico)/.test(text);
    const save = named.save || (abilityWord ? ABILITY_NAMES[abilityWord] : null);
    const range = Number(named.range) || Number(String(spell.range || '').match(/\d+/)?.[0]) || 5;
    let area = named.area || null;
    if (!area) {
        const areaMatch = text.match(/(\d+)\s*(?:foot|feet|pies|pie).*?(radius|cone|line|cube|square|sphere|radio|cono|linea|cubo|cuadrado|esfera)/);
        if (areaMatch) {
            const shapes = { radius: 'circle', sphere: 'circle', radio: 'circle', esfera: 'circle', cone: 'cone', cono: 'cone', line: 'line', linea: 'line', cube: 'square', square: 'square', cubo: 'square', cuadrado: 'square' };
            area = { shape: shapes[areaMatch[2]] || 'circle', feet: Number(areaMatch[1]) };
        }
    }
    const target = named.target || (area ? (healing ? 'area-ally' : 'area-enemy') : healing ? 'ally' : damage || attack || save ? 'enemy' : 'self');
    const level = Number(spell.level) || 0;
    const casting = normalize(spell.casting_time);
    const ability = spellAbility(character);
    const abilityMod = abilityModifier(character, ability);
    const scaledDamage = named.cantripScale && level === 0 ? scaleCantrip(damage, character.level) : damage;
    const finalHealing = healing && named.addAbility
        ? (() => { const parsed = parseDiceExpression(healing); return parsed ? formatDice({ ...parsed, modifier: parsed.modifier + abilityMod }) : healing; })()
        : healing;
    const economy = named.economy || (casting.includes('bonus') || casting.includes('adicional') ? 'bonus' : casting.includes('reaction') || casting.includes('reaccion') ? 'reaction' : 'action');
    return {
        key: `spell:${spell.id}`,
        source: 'spell',
        sourceId: spell.id,
        name: spell.translation?.name || spell.name,
        description: spell.translation?.desc || spell.desc,
        economy,
        reactionTrigger: economy === 'reaction' ? (named.trigger || inferReactionTrigger(spell.name, text, named)) : null,
        reactionEffect: economy === 'reaction' ? (named.reactionEffect || inferReactionEffect(spell.name, text, named)) : null,
        target,
        range,
        area: area ? { ...area, sizePct: Math.max(5, Math.min(36, Number(area.feet) * 0.8)) } : null,
        attackBonus: attack ? proficiencyBonus(character) + abilityMod : null,
        saveAbility: save,
        saveDc: save ? 8 + proficiencyBonus(character) + abilityMod : null,
        damage: scaledDamage,
        healing: finalHealing,
        damageType: named.damageType || inferDamageType(text),
        halfOnSave: Boolean(named.halfOnSave || /half as much|mitad del dano/.test(text)),
        temporaryHp: Number(named.temporaryHp) || null,
        effect: named.effect || null,
        spellLevel: level,
        resource: level > 0 ? { type: 'spell-slot', level } : null,
        formula: scaledDamage || finalHealing,
        summary: [attack ? `Ataque ${signed(proficiencyBonus(character) + abilityMod)}` : null, save ? `Salv. ${save} CD ${8 + proficiencyBonus(character) + abilityMod}` : null, scaledDamage && `${scaledDamage} ${named.damageType || ''}`.trim(), finalHealing && `Cura ${finalHealing}`, level > 0 && `Espacio nivel ${level}`].filter(Boolean).join(' · '),
    };
}

function weaponAbility(item) {
    const properties = normalize(Array.isArray(item.properties) ? item.properties.join(' ') : item.properties);
    if (/(sutil|finesse)/.test(properties)) return 'FINESSE';
    return /(distancia|ranged|municion|ammunition|arrojadiza|thrown)/.test(properties) ? 'DEX' : 'STR';
}

function profileOverride(source) {
    const useEffects = source?.use_effects;
    if (!useEffects || typeof useEffects !== 'object') return null;
    return useEffects.combat_action || useEffects.combatAction || null;
}

function weaponProfile(item, character, slot) {
    if (!item) return null;
    const override = profileOverride(item) || {};
    const configuredAbility = override.ability || weaponAbility(item);
    const ability = configuredAbility === 'FINESSE'
        ? (abilityModifier(character, 'DEX') >= abilityModifier(character, 'STR') ? 'DEX' : 'STR')
        : configuredAbility;
    const abilityMod = abilityModifier(character, ability);
    const properties = normalize(Array.isArray(item.properties) ? item.properties.join(' ') : item.properties);
    const ranged = /(distancia|ranged|municion|ammunition|arrojadiza|thrown|ballesta|arco|rifle|pistola)/.test(`${properties} ${normalize(item.name)}`);
    const damageBase = override.damage || item.damage || firstDice(item.description) || '1d4';
    const parsedDamage = parseDiceExpression(damageBase);
    const damage = parsedDamage ? formatDice({ ...parsedDamage, modifier: parsedDamage.modifier + abilityMod + (Number(override.damageBonus) || 0) }) : damageBase;
    return {
        key: `weapon:${slot}:${item.id}`,
        source: 'weapon',
        sourceId: item.id,
        name: override.name || (ranged ? `Disparo con ${item.name}` : `Ataque con ${item.name}`),
        description: override.description || item.description || `Ataque con el arma equipada en ${slot === 'primary' ? 'mano principal' : 'mano secundaria'}.`,
        economy: override.economy || 'action',
        target: override.target || 'enemy',
        range: Number(override.range) || (ranged ? 60 : 5),
        attackBonus: Number.isFinite(Number(override.attackBonus)) ? Number(override.attackBonus) : proficiencyBonus(character) + abilityMod,
        damage,
        damageType: override.damageType || item.damage_type || 'fisico',
        formula: damage,
        summary: `Ataque ${signed(Number.isFinite(Number(override.attackBonus)) ? Number(override.attackBonus) : proficiencyBonus(character) + abilityMod)} · ${damage} ${override.damageType || item.damage_type || ''}`.trim(),
    };
}

function npcActionProfile(action, allActions = []) {
    const actionType = normalize(action.action_type || 'action');
    if (/(rasgo|pasiv|trait)/.test(actionType)) return null;
    const named = NPC_ACTION_PROFILES[normalize(action.name)] || {};
    const isMultiattack = normalize(action.name) === 'multiataque';
    const referencedAction = isMultiattack
        ? allActions.find(candidate => candidate.id !== action.id && candidate.attack_bonus != null && candidate.damage_dice)
        : null;
    const source = referencedAction || action;
    const sourceDice = parseDiceExpression(source.damage_dice);
    const target = named.target || (source.damage_dice || source.attack_bonus != null || source.save_dc ? 'enemy' : 'self');
    const economyText = normalize(action.action_type || 'action');
    const economy = economyText.includes('reaccion') || economyText.includes('reaction') ? 'reaction' : economyText.includes('bonus') ? 'bonus' : 'action';
    const override = { ...named, ...(profileOverride(action) || {}) };
    return {
        key: `feature:${action.id}`,
        source: 'feature',
        sourceId: action.id,
        name: action.name,
        description: action.description,
        economy,
        reactionTrigger: economy === 'reaction' ? (override.trigger || inferReactionTrigger(action.name, action.description, override)) : null,
        reactionEffect: economy === 'reaction' ? inferReactionEffect(action.name, action.description, { ...action.toJSON?.(), ...action, ...override }) : null,
        target,
        range: Number(override.range) || Number(String(source.reach || '').match(/\d+/)?.[0]) || 5,
        area: override.area ? { ...override.area, sizePct: Math.max(5, Math.min(36, Number(override.area.feet) * 0.8)) } : null,
        attackBonus: source.attack_bonus == null ? null : Number(source.attack_bonus),
        saveAbility: source.save_ability || null,
        saveDc: source.save_dc == null ? null : Number(source.save_dc),
        damage: source.damage_dice ? formatDice({ ...(sourceDice || { quantity: 1, sides: 4, modifier: 0 }), modifier: (sourceDice?.modifier || 0) + (Number(source.damage_bonus) || 0) }) : null,
        damageType: source.damage_type,
        extraDamage: override.extraDamage || [],
        extraDamageType: override.extraDamageType || null,
        halfOnSave: Boolean(override.halfOnSave || /mitad del dano|mitad de dano/.test(normalize(action.description))),
        effect: override.effect || (source.save_dc ? inferSaveEffect(action.description) : null),
        movement: override.movement || null,
        multiattack: isMultiattack ? 2 : 1,
        resource: action.max_uses ? { type: 'feature-use', actionId: action.id, max: action.max_uses, used: action.used_uses || 0 }
            : /5\s*[^0-9]*\s*6/.test(String(action.recharge || '')) ? { type: 'recharge', key: `recharge:${action.id}`, min: 5, max: 1 } : null,
        formula: source.damage_dice,
        summary: [isMultiattack && '2 ataques separados', source.attack_bonus != null && `Ataque ${signed(source.attack_bonus)}`, source.save_dc && `Salv. ${source.save_ability} CD ${source.save_dc}`, source.damage_dice && `${source.damage_dice}${Number(source.damage_bonus) ? signed(source.damage_bonus) : ''} ${source.damage_type || ''}`.trim(), action.max_uses && `${Math.max(0, action.max_uses - action.used_uses)}/${action.max_uses} usos`].filter(Boolean).join(' · '),
    };
}

function customFeatureProfiles(character) {
    const features = Array.isArray(character.custom_features)
        ? character.custom_features
        : Array.isArray(character.custom_features?.combat_actions)
            ? character.custom_features.combat_actions
            : [];
    return features.flatMap((feature, index) => {
        if (!feature || typeof feature !== 'object') return [];
        if (normalize(feature.kind).includes('pasiv')) return [];
        const description = feature.description || '';
        const parsedDice = allDice(description);
        const actionableKind = /(accion|action|bonus|reaccion|reaction)/.test(normalize(feature.kind));
        const rawOverride = feature.combat_action || feature.combatAction || (feature.damage || feature.healing || feature.attack_bonus != null || actionableKind ? feature : null);
        if (!rawOverride) return [];
        const override = { ...(CUSTOM_ACTION_PROFILES[normalize(feature.name)] || {}), ...rawOverride };
        const normalizedDescription = normalize(description);
        const ability = /\bdes\b|destreza/.test(normalizedDescription) ? 'DEX'
            : /\bfue\b|fuerza/.test(normalizedDescription) ? 'STR'
                : /\bcar\b|carisma/.test(normalizedDescription) ? 'CHA'
                    : /\bsab\b|sabiduria/.test(normalizedDescription) ? 'WIS'
                        : /\bint\b|inteligencia/.test(normalizedDescription) ? 'INT' : null;
        const abilityBonus = ability && /\+\s*(des|fue|car|sab|int)\b/.test(normalizedDescription)
            ? abilityModifier(character, ability)
            : 0;
        const rawDamage = override.damage || parsedDice[0] || null;
        const secondaryHealing = normalizedDescription.match(/(?:cura|recupera).*?(\d{1,2}d(?:4|6|8|10|12|20|100))/)?.[1] || null;
        const conditionalSecondaryDamage = /\bsi\b[^.]*?(?:recibe|sufre|causa|inflige)[^.]*?\d{1,2}d(?:4|6|8|10|12|20|100)/.test(normalizedDescription);
        const damageParsed = parseDiceExpression(rawDamage);
        const damage = damageParsed ? formatDice({ ...damageParsed, modifier: damageParsed.modifier + abilityBonus }) : rawDamage;
        const attackAbility = ability || 'DEX';
        const attack = override.attack_bonus != null || override.attackBonus != null || /(ataque|disparo)/.test(normalizedDescription);
        const areaFeet = Number(normalizedDescription.match(/(?:circulo|radio|cono|linea|cuadrado).*?(\d+)\s*(?:pies|pie|feet|foot)/)?.[1]) || null;
        const range = Number(override.range) || Number(normalizedDescription.match(/(?:alcance|dentro de)\s*(\d+)\s*(?:pies|pie|feet|foot)/)?.[1]) || (areaFeet ? 60 : 5);
        const areaShape = /cono/.test(normalizedDescription) ? 'cone' : /linea/.test(normalizedDescription) ? 'line' : /cuadrado/.test(normalizedDescription) ? 'square' : 'circle';
        const resourceMatch = String(feature.resource || '').match(/(\d+)\s*\/\s*Descanso\s*(Corto|Largo)/i);
        const formulaResource = /MOD\s*CAR/i.test(String(feature.resource || ''))
            ? { max: Math.max(1, abilityModifier(character, 'CHA')), recovery: 'largo' }
            : null;
        const capacityResource = String(feature.resource || '').match(/M[aá]ximo\s*(\d+)/i);
        const sharedResourceKey = normalize(feature.name).includes('acorde') ? 'acordes-laud-runico' : `custom:${index}`;
        const inferredDamageType = inferDamageType(description) || ['fuego', 'frio', 'acido', 'veneno', 'radiante', 'necrotico', 'fuerza', 'fisico', 'perforante', 'cortante', 'contundente', 'trueno', 'relampago', 'psiquico']
            .find(type => normalizedDescription.includes(type)) || null;
        const economyText = normalize(override.economy || override.action_type || feature.kind);
        const economy = economyText.includes('bonus') ? 'bonus' : economyText.includes('reaccion') || economyText.includes('reaction') ? 'reaction' : 'action';
        const reactionTrigger = economy === 'reaction' ? inferReactionTrigger(feature.name, description, override) : null;
        const reactionEffect = economy === 'reaction' ? inferReactionEffect(feature.name, description, override) : null;
        return [{
            key: `custom:${index}:${normalize(override.name || feature.name).replace(/\s+/g, '-')}`,
            source: 'custom',
            sourceId: index,
            name: override.name || feature.name || `Rasgo ${index + 1}`,
            description: override.description || feature.description || '',
            economy,
            reactionTrigger,
            reactionEffect,
            target: override.target || (areaFeet ? 'area-enemy' : override.healing ? 'ally' : damage || attack ? 'enemy' : 'self'),
            range,
            area: override.area || (areaFeet ? { shape: areaShape, feet: areaFeet, sizePct: Math.max(5, Math.min(36, areaFeet * 0.8)) } : null),
            attackBonus: override.attack_bonus ?? override.attackBonus ?? (attack ? proficiencyBonus(character) + abilityModifier(character, attackAbility) : null),
            saveAbility: override.save_ability || override.saveAbility || null,
            saveDc: override.save_dc ?? override.saveDc ?? null,
            damage,
            extraDamage: override.extraDamage
                ? (Array.isArray(override.extraDamage) ? override.extraDamage : [override.extraDamage])
                : conditionalSecondaryDamage ? [] : parsedDice.slice(1).filter(expression => expression !== secondaryHealing),
            secondaryHealing,
            secondaryHealingRange: secondaryHealing ? 15 : null,
            healing: override.healing || null,
            damageType: override.damage_type || override.damageType || inferredDamageType,
            effect: override.effect || null,
            shield: override.shield || feature.shield || null,
            trackerCost: override.consumes_tracker || override.consumesTracker || feature.consumes_tracker || null,
            trackerRefill: override.refills_tracker || override.refillsTracker || feature.refills_tracker || null,
            jamOnNaturalBelow: Number(override.jamOnNaturalBelow) || null,
            clearWeaponJam: Boolean(override.clearWeaponJam),
            resource: override.max_uses
                ? { type: 'session-use', key: override.key || sharedResourceKey, max: override.max_uses, recovery: override.recovery || null }
                : formulaResource ? { type: 'session-use', key: sharedResourceKey, ...formulaResource }
                    : resourceMatch ? { type: 'session-use', key: sharedResourceKey, max: Number(resourceMatch[1]), recovery: normalize(resourceMatch[2]) }
                        : capacityResource ? { type: 'session-use', key: sharedResourceKey, max: Number(capacityResource[1]), recovery: 'manual' } : null,
            formula: damage || override.healing || null,
            summary: override.summary || [attack && `Ataque ${signed(override.attack_bonus ?? override.attackBonus ?? (proficiencyBonus(character) + abilityModifier(character, attackAbility)))}`, damage && `${damage}${parsedDice.length > 1 ? ` + ${parsedDice.slice(1).join(' + ')}` : ''}`, feature.resource].filter(Boolean).join(' · '),
        }];
    });
}

async function loadCombatCharacter(characterId) {
    return Character.findByPk(characterId, {
        include: [
            { model: AbilityScore, as: 'abilityScores', separate: true },
            { model: NpcAction, as: 'npcActions', separate: true, order: [['sort_order', 'ASC']] },
            {
                model: EquipmentSlots,
                as: 'equipment',
                include: [
                    { model: Item, as: 'primary_weapon' },
                    { model: Item, as: 'secondary_weapon' },
                ],
            },
        ],
    });
}

async function buildActionCatalog(characterId) {
    const character = await loadCombatCharacter(characterId);
    if (!character) return null;
    const slugs = [...new Set([...(character.spells_known || []), ...(character.spells_prepared || [])])];
    const spells = slugs.length ? await Spell.findAll({ where: { slug: { [Op.in]: slugs } }, order: [['level', 'ASC'], ['name', 'ASC']] }) : [];
    const knownSpellSlugs = new Set(spells.map(spell => normalize(spell.slug).replace(/\s+/g, '-')));
    const customActions = customFeatureProfiles(character).filter(action => {
        const alias = CUSTOM_SPELL_ALIASES[normalize(action.name)];
        return !alias || !knownSpellSlugs.has(alias);
    });
    const primaryWeapon = weaponProfile(character.equipment?.primary_weapon, character, 'primary');
    const opportunityAttack = primaryWeapon ? {
        ...primaryWeapon,
        key: `reaction:opportunity:${primaryWeapon.sourceId}`,
        name: `Ataque de oportunidad · ${character.equipment?.primary_weapon?.name || 'arma'}`,
        economy: 'reaction',
        reactionTrigger: REACTION_TRIGGERS.ENEMY_LEAVES_REACH,
        reactionEffect: { type: 'OPPORTUNITY_ATTACK' },
        summary: `Reacción al abandonar tu alcance · ${primaryWeapon.summary}`,
    } : null;
    const actions = [
        primaryWeapon,
        weaponProfile(character.equipment?.secondary_weapon, character, 'secondary'),
        ...(character.npcActions || []).map(action => npcActionProfile(action, character.npcActions || [])),
        ...customActions,
        ...spells.map(spell => spellProfile(spell, character)),
        opportunityAttack,
    ].filter(Boolean).map(action => ({ ...action, available: true, unavailableReason: null }));
    return { character, actions };
}

function relationship(actorToken, targetToken) {
    if (Number(actorToken.character_id) === Number(targetToken.character_id)) return 'self';
    const actorPlayer = Boolean(actorToken.owner_user_id);
    const targetPlayer = Boolean(targetToken.owner_user_id);
    const actorType = normalize(actorToken.character?.npc_type);
    const type = normalize(targetToken.character?.npc_type);
    if ((actorPlayer && targetPlayer) || ['amigo', 'companero', 'ally'].includes(type)) return 'ally';
    if (['enemigo', 'enemy'].includes(type)) return 'enemy';
    if (targetPlayer) return ['enemigo', 'enemy'].includes(actorType) ? 'enemy' : 'ally';
    if (!actorPlayer && !targetPlayer && ['enemigo', 'enemy'].includes(actorType) !== ['enemigo', 'enemy'].includes(type)) return 'enemy';
    return actorPlayer ? 'enemy' : 'neutral';
}

function validRelationship(action, actorToken, targetToken) {
    const relation = relationship(actorToken, targetToken);
    if (action.target === 'self') return relation === 'self';
    if (String(action.target).includes('ally')) return relation === 'ally' || relation === 'self';
    if (String(action.target).includes('enemy')) return relation === 'enemy' || relation === 'neutral';
    return true;
}

function pointDistance(left, right) {
    return Math.hypot(Number(left.x) - Number(right.x), Number(left.y) - Number(right.y));
}

// Las posiciones del tablero se guardan como porcentajes. Una casilla visible
// mide aproximadamente 5% y una diagonal contigua cerca de 7.1%; 8% cubre
// correctamente todo el perímetro cuerpo a cuerpo sin saltar una casilla.
function combatRangePct(rangeFeet) {
    const feet = Number(rangeFeet) || 5;
    if (feet <= 5) return 8;
    return Math.max(8, Math.min(100, feet * 0.8));
}

function areaContains(shape, origin, center, point, size) {
    const radius = Math.max(2, Number(size) || 10);
    if (shape === 'square') return Math.abs(point.x - center.x) <= radius / 2 && Math.abs(point.y - center.y) <= radius / 2;
    if (shape === 'line') {
        const dx = center.x - origin.x;
        const dy = center.y - origin.y;
        const length = Math.max(0.001, Math.hypot(dx, dy));
        const px = point.x - origin.x;
        const py = point.y - origin.y;
        const projection = (px * dx + py * dy) / length;
        const perpendicular = Math.abs(px * dy - py * dx) / length;
        return projection >= 0 && projection <= radius && perpendicular <= Math.max(1.8, radius * 0.12);
    }
    if (shape === 'cone') {
        const direction = Math.atan2(center.y - origin.y, center.x - origin.x);
        const angle = Math.atan2(point.y - origin.y, point.x - origin.x);
        const delta = Math.abs(Math.atan2(Math.sin(angle - direction), Math.cos(angle - direction)));
        return pointDistance(origin, point) <= radius && delta <= Math.PI / 6;
    }
    return pointDistance(center, point) <= (radius / 2) + 3;
}

function resolveTargetTokens(action, actorToken, allTokens, requestedIds = [], area = null) {
    const visible = allTokens.filter(token => token.visible && token.character);
    if (action.target === 'self') return [actorToken];
    const rangePct = combatRangePct(action.range);
    if (String(action.target).startsWith('area-')) {
        if (!area || !Number.isFinite(Number(area.x)) || !Number.isFinite(Number(area.y))) return [];
        const center = { x: Number(area.x), y: Number(area.y) };
        const origin = { x: Number(actorToken.x), y: Number(actorToken.y) };
        if (pointDistance(origin, center) > rangePct) return [];
        const shape = action.area?.shape || 'circle';
        const size = action.area?.sizePct || 12;
        return visible.filter(token => validRelationship(action, actorToken, token) && areaContains(shape, origin, center, { x: Number(token.x), y: Number(token.y) }, size));
    }
    const requested = new Set((requestedIds || []).map(String));
    return visible.filter(token => requested.has(String(token.id))
        && validRelationship(action, actorToken, token)
        && pointDistance({ x: Number(actorToken.x), y: Number(actorToken.y) }, { x: Number(token.x), y: Number(token.y) }) <= rangePct).slice(0, 1);
}

function listIncludes(values, damageType) {
    const needle = normalize(damageType);
    return (Array.isArray(values) ? values : []).some(value => {
        const current = normalize(typeof value === 'string' ? value : value?.type || value?.name);
        return current && (current.includes(needle) || needle.includes(current));
    });
}

function mitigateDamage(character, amount, damageType) {
    const raw = Math.max(0, Math.floor(Number(amount) || 0));
    if (listIncludes(character.damage_immunities, damageType)) return { amount: 0, modifier: 'immune' };
    if (listIncludes(character.damage_vulnerabilities, damageType)) return { amount: raw * 2, modifier: 'vulnerable' };
    if (listIncludes(character.damage_resistances, damageType)) return { amount: Math.floor(raw / 2), modifier: 'resistant' };
    return { amount: raw, modifier: null };
}

function hpAfterDamage(character, amount, damageType) {
    const mitigated = mitigateDamage(character, amount, damageType);
    const tempBefore = Math.max(0, Number(character.hp_temp) || 0);
    const absorbed = Math.min(tempBefore, mitigated.amount);
    const hpDamage = mitigated.amount - absorbed;
    return {
        hp_current: Math.max(0, (Number(character.hp_current) || 0) - hpDamage),
        hp_temp: tempBefore - absorbed,
        amount: mitigated.amount,
        absorbed,
        modifier: mitigated.modifier,
    };
}

function hpAfterHealing(character, amount) {
    const current = Math.max(0, Number(character.hp_current) || 0);
    const max = Math.max(1, Number(character.hp_max) || 1);
    const next = Math.min(max, current + Math.max(0, Math.floor(Number(amount) || 0)));
    return { hp_current: next, hp_temp: Math.max(0, Number(character.hp_temp) || 0), amount: next - current };
}

module.exports = {
    abilityModifier,
    buildActionCatalog,
    combatRangePct,
    customFeatureProfiles,
    hpAfterDamage,
    hpAfterHealing,
    loadCombatCharacter,
    parseDiceExpression,
    npcActionProfile,
    REACTION_TRIGGERS,
    validRelationship,
    pointDistance,
    proficiencyBonus,
    resolveTargetTokens,
    spellProfile,
    weaponProfile,
};
