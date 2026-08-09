require('dotenv').config({ quiet: true });

const sequelize = require('../config/database');
const {
    Character, CharacterAuditLog, AbilityScore, Item,
} = require('../models');

const APPLY = process.argv.includes('--apply');

const FEATURE_NAMES = new Set([
    'Reglas de los acordes',
    'Acorde radiante',
    'Acorde menor',
    'Acorde mayor',
    'Ebriedad · Nivel 0 — Sobrio',
    'Ebriedad · Nivel 1 — Entonado',
    'Ebriedad · Nivel 2 — Ebrio',
    'Ebriedad · Nivel 3 — Puesto',
].map(name => name.toLocaleLowerCase('es')));

function modifier(score) {
    return Math.floor(((Number(score) || 10) - 10) / 2);
}

function buildFeatures(chaMod) {
    const uses = Math.max(0, chaMod);
    const pool = `${uses}/Descanso Largo (MOD CAR)`;
    return [
        {
            name: 'Reglas de los acordes', kind: 'Pasivo', resource: pool,
            description: `Los acordes del Laúd Rúnico se activan como Acción bonus, comparten una reserva de ${uses} usos por descanso largo —igual al modificador de CAR actual— y sólo se puede usar un acorde por turno.`,
        },
        {
            name: 'Acorde radiante', kind: 'Bonus', resource: pool,
            description: 'Causa 1d4 + CAR de daño radiante y cura 1d8 PV a una criatura elegida que esté a 15 pies o menos. Consume un uso de acordes.',
        },
        {
            name: 'Acorde menor', kind: 'Bonus', resource: pool,
            description: 'Causa 1d4 + CAR de daño. El próximo ataque realizado contra el objetivo tiene ventaja. Consume un uso de acordes.',
        },
        {
            name: 'Acorde mayor', kind: 'Bonus', resource: pool,
            description: 'Descarga ofensiva del Laúd Rúnico que causa 1d10 + CAR de daño. No produce otro efecto. Consume un uso de acordes.',
        },
        {
            name: 'Ebriedad · Nivel 0 — Sobrio', kind: 'Pasivo', resource: 'Estado de ebriedad',
            description: 'Sin bonificación. Mientras está Sobrio, Lucario recibe −1 CAR.',
        },
        {
            name: 'Ebriedad · Nivel 1 — Entonado', kind: 'Pasivo', resource: 'Estado de ebriedad',
            description: 'Lucario recibe +1 CAR y tiene desventaja en pruebas y salvaciones de Destreza.',
        },
        {
            name: 'Ebriedad · Nivel 2 — Ebrio', kind: 'Pasivo', resource: 'Estado de ebriedad',
            description: 'Lucario recibe +2 CAR y +1 al daño. Tiene desventaja en Destreza y Percepción.',
        },
        {
            name: 'Ebriedad · Nivel 3 — Puesto', kind: 'Pasivo', resource: 'Estado de ebriedad',
            description: 'Lucario recibe +3 CAR y +2 al daño. Tiene desventaja en Destreza y Percepción; además debe superar una salvación de CON CD 12 o queda inconsciente.',
        },
    ];
}

function mergeFeatures(previous, additions) {
    const preserved = (Array.isArray(previous) ? previous : [])
        .filter(feature => !FEATURE_NAMES.has(String(feature?.name || '').toLocaleLowerCase('es')));
    return [...preserved, ...additions];
}

async function run() {
    const lucario = await Character.findOne({
        where: { name: 'Lucario' },
        include: [{ model: AbilityScore, as: 'abilityScores' }],
    });
    if (!lucario) throw new Error('No se encontró el personaje Lucario.');

    const lute = await Item.findOne({ where: { name: 'Laud Runico' } });
    if (!lute) throw new Error('No se encontró el objeto Laud Runico.');

    const charisma = lucario.abilityScores.find(score => score.ability === 'CHA');
    const charismaScore = Number(charisma?.base_value || 10) + Number(charisma?.bonus_value || 0);
    const charismaModifier = modifier(charismaScore);
    const features = buildFeatures(charismaModifier);
    const nextCharacter = { custom_features: mergeFeatures(lucario.custom_features, features) };
    const nextLute = {
        description: 'Instrumento rúnico que canaliza Acordes de Poder. Cada acorde usa una Acción bonus, comparte una reserva igual al MOD CAR por descanso largo y sólo puede activarse una vez por turno. Su potencia y sus riesgos también cambian con el nivel de ebriedad de Lucario.',
        damage: '1d4',
        damage_type: 'Radiante / sónico',
        ability: {
            nombre: 'Acordes de Poder', tipo: 'acción bonus',
            descripcion: 'Radiante: 1d4 + CAR y cura 1d8 a 15 pies. Menor: 1d4 + CAR y el próximo ataque contra el objetivo tiene ventaja. Mayor: 1d10 + CAR de daño.',
        },
        use_effects: {
            uses_formula: 'MOD CAR', recovery: 'Descanso largo', max_per_turn: 1,
            intoxication_levels: {
                0: { name: 'Sobrio', charisma: -1 },
                1: { name: 'Entonado', charisma: 1, disadvantage: ['DEX'] },
                2: { name: 'Ebrio', charisma: 2, damage: 1, disadvantage: ['DEX', 'Percepción'] },
                3: { name: 'Puesto', charisma: 3, damage: 2, disadvantage: ['DEX', 'Percepción'], constitution_save: 12, failure: 'Inconsciente' },
            },
        },
    };
    const before = {
        character: {
            id: lucario.id, level: lucario.level, hp_current: lucario.hp_current, hp_max: lucario.hp_max,
            charisma: charismaScore, charisma_modifier: charismaModifier,
            custom_features: lucario.custom_features,
        },
        lute: lute.toJSON(),
    };

    if (!APPLY) {
        console.log(JSON.stringify({
            mode: 'dry-run', before,
            after: {
                custom_features: nextCharacter.custom_features.map(feature => feature.name),
                chord_uses: Math.max(0, charismaModifier),
                lute: nextLute,
            },
        }, null, 2));
        return;
    }

    await sequelize.transaction(async transaction => {
        await lucario.update(nextCharacter, { transaction });
        await lute.update(nextLute, { transaction });
        await CharacterAuditLog.create({
            character_id: lucario.id,
            actor_username: 'Codex / DM', actor_role: 'DM', source: 'lucario-runic-lute',
            changes: {
                runic_lute_build: { before: before.character, after: nextCharacter },
                runic_lute_item: { before: before.lute, after: nextLute },
            },
        }, { transaction });
    });

    const updated = await Character.findByPk(lucario.id, {
        attributes: ['id', 'name', 'level', 'hp_current', 'hp_max', 'custom_features'],
    });
    console.log(JSON.stringify({ mode: 'applied', character: updated, lute: await Item.findByPk(lute.id) }, null, 2));
}

run()
    .then(() => sequelize.close())
    .catch(async error => { console.error(error); await sequelize.close(); process.exit(1); });
