require('dotenv').config({ quiet: true });

const sequelize = require('../config/database');
const {
    AbilityScore,
    Character,
    CharacterAuditLog,
    CharacterInventory,
    Item,
    Spell,
} = require('../models');

const APPLY = process.argv.includes('--apply');

const CANTRIPS = ['vicious-mockery', 'minor-illusion', 'prestidigitation'];
const PREPARED_SPELLS = [
    'healing-word', 'faerie-fire', 'thunderwave', 'disguise-self',
    'invisibility', 'shatter', 'suggestion',
    'hypnotic-pattern', 'dispel-magic',
];
const MANAGED_FEATURES = new Set([
    'Reglas de los acordes', 'Acorde radiante', 'Acorde menor', 'Acorde mayor',
    'Inspiracion Bardica', 'Fuente de Inspiracion', 'Lanzamiento de Conjuros',
    'Pericia', 'Aprendiz de Todo', 'Pua de brumante', 'Canamo Somnoliento',
    'Ebriedad', 'Ebriedad - Nivel 0 - Sobrio', 'Ebriedad - Nivel 1 - Entonado',
    'Ebriedad - Nivel 2 - Ebrio', 'Ebriedad - Nivel 3 - Puesto',
].map(normalize));

function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u00b7\u2014]/g, '-').toLowerCase().trim();
}

function features() {
    return [
        {
            name: 'Inspiraci\u00f3n B\u00e1rdica', kind: 'Bonus', resource: '4/Descanso Corto',
            description: 'Como acci\u00f3n bonus, una criatura aliada a 60 pies que pueda ver u o\u00edr a Lucario recibe 1d8 de Inspiraci\u00f3n B\u00e1rdica para aplicar a una prueba de d20 fallida.',
            combat_action: { target: 'ally', range: 60, utilityRoll: '1d8', max_uses: 4, key: 'inspiracion-bardica', recovery: 'corto', summary: 'Aliado a 60 pies recibe 1d8 de inspiraci\u00f3n' },
        },
        { name: 'Fuente de Inspiraci\u00f3n', kind: 'Pasivo', resource: 'Nivel 5', description: 'Los cuatro usos de Inspiraci\u00f3n B\u00e1rdica se recuperan con un descanso corto o largo.' },
        { name: 'Lanzamiento de Conjuros', kind: 'Pasivo', resource: 'CAR', description: 'Lucario usa Carisma para sus conjuros: ataque +7 y CD de salvaci\u00f3n 15.' },
        { name: 'Pericia', kind: 'Pasivo', resource: 'Clase', description: 'Duplica el bono de competencia en dos habilidades elegidas. La elecci\u00f3n concreta sigue editable en la ficha.' },
        { name: 'Aprendiz de Todo', kind: 'Pasivo', resource: 'Clase', description: 'Suma la mitad del bono de competencia a pruebas en las que no tenga competencia.' },
        {
            name: 'Reglas de los acordes', kind: 'Pasivo', resource: '4/Descanso Largo',
            description: 'Los acordes del La\u00fad R\u00fanico usan una acci\u00f3n bonus, comparten cuatro usos por descanso largo y s\u00f3lo puede usarse uno por turno.',
        },
        {
            name: 'Acorde radiante', kind: 'Bonus', resource: '4/Descanso Largo',
            description: 'A 30 pies causa 1d4 + CAR de da\u00f1o radiante, m\u00e1s 1d4 por la P\u00faa de brumante. Luego cura 1d8 + 1d4 a una criatura aliada a 15 pies.',
            combat_action: { attack: false, target: 'enemy', range: 30, damage: '1d4', damageType: 'radiante', extraDamage: ['1d4'], secondaryHealing: '1d8', secondaryHealingExtra: ['1d4'], secondaryHealingRange: 15, max_uses: 4, key: 'acordes-laud-runico', recovery: 'largo' },
        },
        {
            name: 'Acorde menor', kind: 'Bonus', resource: '4/Descanso Largo',
            description: 'A 30 pies causa 1d4 + CAR de da\u00f1o s\u00f3nico, m\u00e1s 1d4 por la P\u00faa de brumante. El pr\u00f3ximo ataque contra el objetivo tiene ventaja.',
            combat_action: { attack: false, target: 'enemy', range: 30, damage: '1d4', damageType: 'sonico', extraDamage: ['1d4'], effect: { type: 'GRANT_NEXT_ATTACK_ADVANTAGE' }, max_uses: 4, key: 'acordes-laud-runico', recovery: 'largo' },
        },
        {
            name: 'Acorde mayor', kind: 'Bonus', resource: '4/Descanso Largo',
            description: 'A 30 pies causa 1d10 + CAR de da\u00f1o s\u00f3nico, m\u00e1s 1d4 por la P\u00faa de brumante.',
            combat_action: { attack: false, target: 'enemy', range: 30, damage: '1d10', damageType: 'sonico', extraDamage: ['1d4'], max_uses: 4, key: 'acordes-laud-runico', recovery: 'largo' },
        },
        { name: 'P\u00faa de brumante', kind: 'Pasivo', resource: 'Mejora equipada', description: 'La mejora fabricada por Rakion agrega 1d4 al da\u00f1o y a las curaciones canalizadas por el La\u00fad R\u00fanico.' },
        {
            name: 'C\u00e1\u00f1amo Somnoliento', kind: 'Accion', resource: '1 uso',
            description: 'Una criatura a 30 pies realiza una salvaci\u00f3n de Sabidur\u00eda CD 15. Si falla, queda Dormida. El uso se repone manualmente cuando corresponda.',
            combat_action: { target: 'enemy', range: 30, saveAbility: 'WIS', saveDc: 15, effect: { type: 'SAVE_CONDITION', conditions: ['Dormido'] }, max_uses: 1, key: 'canamo-somnoliento', recovery: 'manual' },
        },
        {
            name: 'Ebriedad', kind: 'Rastreador', resource: '0-3', description: '0 Sobrio, 1 Entonado, 2 Ebrio, 3 Puesto.',
            tracker: { key: 'ebriedad-lucario', label: 'Ebriedad', value: 0, max: 3, unit: 'nivel' },
        },
        { name: 'Ebriedad - Nivel 0 - Sobrio', kind: 'Pasivo', resource: 'Estado', description: 'CAR -1 mientras permanece sobrio.' },
        { name: 'Ebriedad - Nivel 1 - Entonado', kind: 'Pasivo', resource: 'Estado', description: 'CAR +1 y desventaja en pruebas y salvaciones de Destreza.' },
        { name: 'Ebriedad - Nivel 2 - Ebrio', kind: 'Pasivo', resource: 'Estado', description: 'CAR +2, +1 al da\u00f1o y desventaja en Destreza y Percepci\u00f3n.' },
        { name: 'Ebriedad - Nivel 3 - Puesto', kind: 'Pasivo', resource: 'Estado', description: 'CAR +3, +2 al da\u00f1o, desventaja en Destreza y Percepci\u00f3n; salvaci\u00f3n CON CD 12 o queda Inconsciente.' },
    ];
}

function mergeFeatures(previous) {
    const preserved = (Array.isArray(previous) ? previous : []).filter(feature => !MANAGED_FEATURES.has(normalize(feature?.name)));
    return [...preserved, ...features()];
}

async function run() {
    const lucario = await Character.findOne({ where: { name: 'Lucario' }, include: [{ model: AbilityScore, as: 'abilityScores' }] });
    if (!lucario) throw new Error('No se encontro Lucario.');

    const spellSlugs = [...CANTRIPS, ...PREPARED_SPELLS];
    const existingSpells = await Spell.findAll({ where: { slug: spellSlugs }, attributes: ['slug'] });
    const found = new Set(existingSpells.map(spell => spell.slug));
    const missing = spellSlugs.filter(slug => !found.has(slug));
    if (missing.length) throw new Error(`Faltan conjuros requeridos: ${missing.join(', ')}`);

    const lute = await Item.findOne({ where: { name: 'Laud Runico' } });
    const hemp = await Item.findOne({ where: { name: 'Ca\u00f1amo Somnoliento' } });
    if (!lute || !hemp) throw new Error('Falta el Laud Runico o el Canamo Somnoliento.');

    const previousSlots = lucario.spell_slots || {};
    const spellSlots = Object.fromEntries([[1, 4], [2, 3], [3, 2]].map(([level, max]) => [level, { max, used: Math.min(max, Number(previousSlots[level]?.used || 0)) }]));
    const nextCharacter = {
        proficiency_bonus: 3,
        saving_throws: { ...(lucario.saving_throws || {}), dex: true, cha: true },
        spell_slots: spellSlots,
        spells_known: spellSlugs,
        spells_prepared: PREPARED_SPELLS,
        custom_features: mergeFeatures(lucario.custom_features),
    };
    const nextLuteEffects = {
        ...(lute.use_effects || {}),
        combat_action: { ability: 'CHA', range: 30, damage: '1d4', damageType: 'sonico', extraDamage: ['1d4'], extraDamageType: 'sonico', description: 'Ataque musical a distancia con CAR y la Pua de brumante.' },
    };
    const nextHempEffects = {
        ...(hemp.use_effects || {}),
        combat_action: { target: 'enemy', range: 30, saveAbility: 'WIS', saveDc: 15, effect: { type: 'SAVE_CONDITION', conditions: ['Dormido'] } },
    };

    const preview = {
        characterId: lucario.id,
        spells: spellSlugs,
        spellSlots,
        features: nextCharacter.custom_features.map(feature => feature.name),
        luteCombatAction: nextLuteEffects.combat_action,
        hempCombatAction: nextHempEffects.combat_action,
    };
    if (!APPLY) {
        console.log(JSON.stringify({ mode: 'dry-run', preview }, null, 2));
        return;
    }

    await sequelize.transaction(async transaction => {
        const before = {
            proficiency_bonus: lucario.proficiency_bonus,
            saving_throws: lucario.saving_throws,
            spell_slots: lucario.spell_slots,
            spells_known: lucario.spells_known,
            spells_prepared: lucario.spells_prepared,
            custom_features: lucario.custom_features,
            lute_use_effects: lute.use_effects,
            hemp_use_effects: hemp.use_effects,
        };
        await lucario.update(nextCharacter, { transaction });
        await lute.update({ use_effects: nextLuteEffects, description: 'Instrumento runico de alcance 30 pies que usa CAR. Canaliza Acordes de Poder y la Pua de brumante agrega 1d4 al dano y a la curacion.' }, { transaction });
        await hemp.update({ use_effects: nextHempEffects }, { transaction });

        const [spike] = await Item.findOrCreate({
            where: { name: 'Pua de brumante' },
            defaults: { type: 'Objeto Magico', rarity: 'Raro', slot: 'none', description: 'Mejora entregada a Lucario: +1d4 al dano y las curaciones del Laud Runico.', use_effects: { bonus_dice: '1d4', applies_to: ['dano', 'curacion'] } },
            transaction,
        });
        await CharacterInventory.findOrCreate({ where: { character_id: lucario.id, item_id: spike.id }, defaults: { quantity: 1 }, transaction });
        await CharacterAuditLog.create({
            character_id: lucario.id,
            actor_username: 'Codex / DM', actor_role: 'DM', source: 'lucario-combat-loadout',
            changes: { combat_loadout: { before, after: preview } },
        }, { transaction });
    });

    console.log(JSON.stringify({ mode: 'applied', preview }, null, 2));
}

run().then(() => sequelize.close()).catch(async error => {
    console.error(error);
    await sequelize.close();
    process.exit(1);
});
