require('dotenv').config({ quiet: true });

const sequelize = require('../config/database');
const {
    Character, CharacterAuditLog, Class, Blueprint, Item,
} = require('../models');

const APPLY = process.argv.includes('--apply');

const CUSTOM_CLASS = {
    slug: 'artificer-custom',
    name: 'Artífice custom',
    hit_dice: '1d8',
    hp_at_1st_level: 'Configuración custom del DM',
    hp_at_higher_levels: 'Configuración custom del DM',
    prof_armor: 'Según la ficha configurada por el DM',
    prof_weapons: 'Armas simples y marciales; competencia con Escupefuego y gadgets propios',
    prof_tools: 'Herramientas de artesano y gadgets propios',
    prof_saving_throws: 'Según la ficha configurada por el DM',
    prof_skills: 'Según la ficha configurada por el DM',
    equipment: 'Escupefuego y gadgets construidos a partir de sus planos',
    table: '| Nivel | Comp. | Rasgos |\n|---|---|---|',
    spellcasting_ability: null,
    subtypes_name: 'Especialidad custom',
    archetypes: '[]',
    desc: 'Artífice homebrew cuya magia se expresa exclusivamente mediante gadgets, municiones y planos. No usa conjuros ni ranuras tradicionales.',
};

const BLUEPRINTS = [
    {
        slug: 'escupefuego',
        name: 'Plano del Escupefuego',
        category: 'arma',
        description: 'Rifle rúnico de proyectil sólido. Alcance 60 pies, un disparo por ronda como Acción, cargador de 6 balas y recarga mediante una Acción completa. El daño depende de la munición utilizada. Se atasca si la tirada de ataque natural es menor que 7. Desatascarlo consume una Acción completa, sin prueba, y da desventaja al siguiente ataque realizado con el arma.',
        crafting_notes: 'Plano conocido. Permite mantener, reparar y reproducir el Escupefuego si el DM autoriza los materiales.',
        item_template: {
            type: 'Arma', rarity: 'Raro', slot: 'weapon', weapon_category: 'Marcial',
            damage: '1d8', damage_type: 'Perforante',
            properties: ['Munición (60 pies)', 'Cargador (6 balas)', 'Recarga (Acción completa)', 'Atasco (tirada natural menor que 7)'],
        },
    },
    {
        slug: 'escudo-desplegable',
        name: 'Plano del Escudo retráctil',
        category: 'armadura',
        description: 'Escudo mecánico defensivo. Cuando está construido y operativo, se activa como Reacción y otorga +5 CA contra el ataque que lo provoca. Después de usarlo se tira 1d20: se rompe con 3 o menos en el primer control; cada activación posterior aumenta el umbral de rotura en 1 (4 o menos, luego 5 o menos, y así sucesivamente).',
        crafting_notes: 'Conocer el plano no concede CA por sí solo: el escudo debe estar construido, equipado y operativo.',
        item_template: {
            type: 'Armadura', rarity: 'Raro', slot: 'off_hand',
            stat_bonuses: {},
            ability: { nombre: 'Despliegue defensivo', tipo: 'reacción', descripcion: '+5 CA contra un ataque; después controla rotura con umbral creciente.' },
        },
    },
    {
        slug: 'granada-simple',
        name: 'Plano de Granada explosiva',
        category: 'consumible',
        description: 'Permite fabricar granadas explosivas. Rakion puede conservar un máximo de 2 granadas construidas al mismo tiempo. Lanzar una granada consume una Acción bonus y causa 2d8 de daño en un círculo de 20 pies.',
        crafting_notes: 'Capacidad simultánea: 2. Los materiales y la reposición se resuelven con el DM.',
        item_template: {
            type: 'Consumible', rarity: 'Poco Común', slot: 'none', damage: '2d8',
            use_effects: { action: 'Bonus', area: 'Círculo de 20 pies', max_carried: 2 },
        },
    },
];

const FEATURES = [
    {
        name: 'Gas pimienta', kind: 'Accion', resource: 'Truco gadget · Sin usos',
        description: 'Gadget adaptado de Poison Spray. Alcance 30 pies, componentes gestuales y verbales, efecto instantáneo. Hacé un ataque de gadget a distancia usando INT + competencia; al impactar causa 2d12 de veneno por ser nivel 5. Escala a 3d12 en nivel 11 y 4d12 en nivel 17.',
    },
    {
        name: 'Culatazo empoderado', kind: 'Accion', resource: '3/Descanso Corto',
        description: 'Sobrecalentás la culata del Escupefuego y hacés un ataque cuerpo a cuerpo con FUE + competencia. Al impactar causa 2d8 de daño físico + FUE. Si el objetivo se mueve o realiza una acción antes del inicio de tu próximo turno, recibe 1d8 de daño adicional.',
    },
    {
        name: 'Cámara de ventilación', kind: 'Accion', resource: '4/Descanso Largo',
        description: 'Adaptación de Catapulta integrada al Escupefuego. Hacé un disparo con DES + competencia; al impactar causa 3d8 + DES y aplica también el efecto de la bala cargada.',
    },
    {
        name: 'Escupefuego · Munición normal', kind: 'Accion', resource: '1 bala',
        consumes_tracker: { key: 'escupefuego-cargador', amount: 1 },
        description: 'Un disparo con DES + competencia a un objetivo dentro de 60 pies. Daño: 1d8 + DES.',
    },
    {
        name: 'Escupefuego · Munición rúnica', kind: 'Accion', resource: '1 bala rúnica',
        consumes_tracker: { key: 'escupefuego-cargador', amount: 1 },
        description: 'Un disparo con DES + competencia. Daño: 1d8 + DES y el efecto definido de la runa utilizada.',
    },
    {
        name: 'Escupefuego · Munición rúnica II', kind: 'Accion', resource: '1 bala rúnica II',
        consumes_tracker: { key: 'escupefuego-cargador', amount: 1 },
        description: 'Un disparo con DES + competencia. Daño: 1d8 + 1d4 + DES y el efecto definido de la runa utilizada.',
    },
    {
        name: 'Escupefuego · Munición de brumante', kind: 'Accion', resource: '1 bala de brumante',
        consumes_tracker: { key: 'escupefuego-cargador', amount: 1 },
        description: 'Un disparo con DES + competencia. Daño: 2d8 + DES.',
    },
    {
        name: 'Recargar Escupefuego', kind: 'Accion', resource: 'Cargador de 6',
        refills_tracker: { key: 'escupefuego-cargador' },
        description: 'Consumís una Acción completa para insertar un cartucho y dejar el cargador con 6 balas.',
    },
    {
        name: 'Desatascar Escupefuego', kind: 'Accion', resource: 'Tras una tirada natural < 7',
        description: 'El arma se atasca cuando su tirada de ataque natural es menor que 7. Desatascarla consume una Acción completa y no requiere prueba, pero el siguiente ataque con el Escupefuego se realiza con desventaja.',
    },
    {
        name: 'Escudo retráctil', kind: 'Reaccion', resource: 'Requiere escudo operativo',
        description: 'Activación defensiva: +5 CA contra el ataque que dispara la reacción. Después tirá 1d20; se rompe con 3 o menos la primera vez. Tras cada activación, el umbral aumenta en 1: 4 o menos, luego 5 o menos, y así sucesivamente.',
    },
    {
        name: 'Granada explosiva', kind: 'Bonus', resource: 'Máximo 2 construidas',
        consumes_tracker: { key: 'granadas-construidas', amount: 1 },
        description: 'Lanzás una granada como Acción bonus. Explota en un círculo de 20 pies y causa 2d8 de daño. Rakion no puede tener más de 2 granadas construidas simultáneamente.',
    },
    {
        name: 'Capacidad de planos', kind: 'Pasivo', resource: '3/4 planos',
        description: 'Rakion conoce actualmente tres planos: Escupefuego, Escudo retráctil y Granada explosiva. Conserva un espacio disponible para aprender un cuarto plano más adelante.',
    },
    {
        name: 'Cargador del Escupefuego', kind: 'Rastreador',
        description: 'Control manual del cargador equipado del Escupefuego.',
        tracker: { key: 'escupefuego-cargador', label: 'Cargador Escupefuego', value: 6, max: 6, unit: 'balas' },
    },
    {
        name: 'Granadas construidas', kind: 'Rastreador',
        description: 'Granadas explosivas disponibles antes de construir más.',
        tracker: { key: 'granadas-construidas', label: 'Granadas', value: 2, max: 2, unit: 'granadas' },
    },
];

const FEATURE_NAMES = new Set([...FEATURES.map(feature => feature.name.toLocaleLowerCase('es')), 'rastreador de planos']);

function mergeFeatures(previous) {
    const preserved = (Array.isArray(previous) ? previous : [])
        .filter(feature => !FEATURE_NAMES.has(String(feature?.name || '').toLocaleLowerCase('es')));
    return [...preserved, ...FEATURES];
}

async function run() {
    const rakion = await Character.findOne({ where: { name: 'Rakion Altarion' } });
    if (!rakion) throw new Error('No se encontró Rakion Altarion.');
    const escupefuego = await Item.findOne({ where: { name: 'Escupefuego' } });
    if (!escupefuego) throw new Error('No se encontró el objeto Escupefuego.');

    const before = {
        character: {
            id: rakion.id, class: rakion.class, class_slug: rakion.class_slug,
            classes: rakion.classes, level: rakion.level, hp_current: rakion.hp_current, hp_max: rakion.hp_max,
            blueprints_known: rakion.blueprints_known, spells_known: rakion.spells_known,
            custom_features: rakion.custom_features,
        },
        escupefuego: escupefuego.toJSON(),
    };
    const nextCharacter = {
        class: 'Artífice custom',
        class_slug: CUSTOM_CLASS.slug,
        archetype_slug: null,
        classes: [{ slug: CUSTOM_CLASS.slug, level: rakion.level }],
        custom_features: mergeFeatures(rakion.custom_features),
        blueprints_known: BLUEPRINTS.map(blueprint => blueprint.slug),
        spells_known: [],
        spells_prepared: [],
        spell_slots: {},
    };
    const nextWeapon = {
        type: 'Arma', rarity: 'Raro', slot: 'weapon', weapon_category: 'Marcial',
        damage: '1d8', damage_type: 'Perforante',
        properties: ['Munición (60 pies)', 'Cargador (6 balas)', 'Recarga (Acción completa)', 'Atasco (tirada natural menor que 7)'],
        mastery: null,
        description: 'Rifle rúnico de proyectil sólido. Daño según munición; alcance 60 pies; un disparo por ronda como Acción; cargador de 6 balas. Recargar consume una Acción completa. Se atasca con una tirada de ataque natural menor que 7; desatascarlo consume una Acción completa y da desventaja al siguiente ataque con el arma.',
        ability: {
            nombre: 'Sistema de munición intercambiable', tipo: 'acción',
            descripcion: 'Normal 1d8 + DES; rúnica 1d8 + DES + efecto; rúnica II 1d8 + 1d4 + DES + efecto; brumante 2d8 + DES.',
        },
        use_effects: { magazine_size: 6, range_feet: 60, jam_below: 7 },
    };

    if (!APPLY) {
        console.log(JSON.stringify({
            mode: 'dry-run', before,
            after: {
                character: { ...nextCharacter, custom_features: nextCharacter.custom_features.map(feature => feature.name) },
                escupefuego: nextWeapon,
                blueprints: BLUEPRINTS.map(blueprint => blueprint.name),
            },
        }, null, 2));
        return;
    }

    await sequelize.transaction(async transaction => {
        const [classRecord] = await Class.findOrCreate({
            where: { slug: CUSTOM_CLASS.slug }, defaults: CUSTOM_CLASS, transaction,
        });
        await classRecord.update(CUSTOM_CLASS, { transaction });

        for (const definition of BLUEPRINTS) {
            const [blueprint] = await Blueprint.findOrCreate({
                where: { slug: definition.slug }, defaults: definition, transaction,
            });
            await blueprint.update(definition, { transaction });
        }

        await escupefuego.update(nextWeapon, { transaction });
        await rakion.update(nextCharacter, { transaction });
        await CharacterAuditLog.create({
            character_id: rakion.id,
            actor_username: 'Codex / DM',
            actor_role: 'DM',
            source: 'rakion-custom-artificer',
            changes: {
                character_build: { before: before.character, after: nextCharacter },
                escupefuego: { before: before.escupefuego, after: nextWeapon },
                blueprints: { after: BLUEPRINTS },
            },
        }, { transaction });
    });

    const updated = await Character.findByPk(rakion.id, {
        attributes: ['id', 'name', 'class', 'class_slug', 'classes', 'level', 'hp_current', 'hp_max', 'custom_features', 'blueprints_known', 'spells_known'],
    });
    console.log(JSON.stringify({ mode: 'applied', character: updated, escupefuego: await Item.findByPk(escupefuego.id) }, null, 2));
}

run()
    .then(() => sequelize.close())
    .catch(async error => { console.error(error); await sequelize.close(); process.exit(1); });
