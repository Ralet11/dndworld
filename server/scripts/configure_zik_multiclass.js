require('dotenv').config({ quiet: true });

const sequelize = require('../config/database');
const { Op } = require('sequelize');
const { Character, CharacterAuditLog, Skill, Spell } = require('../models');

const APPLY = process.argv.includes('--apply');

const SPELLS = [
    {
        slug: 'eldritch-blast',
        name: 'Eldritch Blast',
        desc: 'A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 Force damage. The spell creates two beams at character level 5; make a separate attack roll for each beam.',
        higher_level: 'The spell creates two beams at character level 5, three at level 11, and four at level 17.',
        range: '120 feet', components: 'V, S', material: null, ritual: false,
        duration: 'Instantaneous', concentration: false, casting_time: '1 Action',
        level: 0, school: 'Evocation', dnd_class: 'Warlock', spell_lists: ['Warlock'],
        document__slug: 'wotc-srd', document__title: 'D&D 2024',
        translation: {
            name: 'Descarga sobrenatural',
            desc: 'Lanzás rayos de energía crepitante. Hacé un ataque de conjuro a distancia por cada rayo; al impactar, cada uno causa 1d10 de daño de fuerza. A nivel total 5 lanzás dos rayos y elegís el objetivo de cada uno.',
            higher_level: 'Dos rayos a nivel 5, tres a nivel 11 y cuatro a nivel 17.',
        },
    },
    {
        slug: 'minor-illusion',
        name: 'Minor Illusion',
        desc: 'You create a sound or an image of an object within range that lasts for the duration. Physical interaction reveals the image as an illusion. A creature can discern it with a successful Intelligence (Investigation) check against your spell save DC.',
        higher_level: '', range: '30 feet', components: 'S, M', material: 'a bit of fleece', ritual: false,
        duration: '1 minute', concentration: false, casting_time: '1 Action',
        level: 0, school: 'Illusion', dnd_class: 'Bard, Sorcerer, Warlock, Wizard', spell_lists: ['Bard', 'Sorcerer', 'Warlock', 'Wizard'],
        document__slug: 'wotc-srd', document__title: 'D&D 2024',
        translation: {
            name: 'Ilusión menor',
            desc: 'Creás un sonido o la imagen de un objeto a 30 pies durante 1 minuto. La interacción física revela la ilusión; una criatura también puede descubrirla con Inteligencia (Investigación) contra tu CD de conjuros.',
            higher_level: '',
        },
    },
    {
        slug: 'hex',
        name: 'Hex',
        desc: 'You place a curse on a creature you can see within range. Until the spell ends, you deal an extra 1d6 Necrotic damage to the target whenever you hit it with an attack roll. Choose one ability when you cast the spell; the target has disadvantage on ability checks made with that ability. If the target drops to 0 Hit Points before the spell ends, you can take a Bonus Action on a later turn to curse a new creature.',
        higher_level: 'A higher-level slot increases the duration.',
        range: '90 feet', components: 'V, S, M', material: 'the petrified eye of a newt', ritual: false,
        duration: 'Concentration, up to 1 hour', concentration: true, casting_time: '1 Bonus Action',
        level: 1, school: 'Enchantment', dnd_class: 'Warlock', spell_lists: ['Warlock'],
        document__slug: 'wotc-srd', document__title: 'D&D 2024',
        translation: {
            name: 'Maleficio',
            desc: 'Maldice a una criatura visible a 90 pies. Mientras te concentres, cada impacto de un ataque tuyo le suma 1d6 necrótico. Elegí una característica: el objetivo tiene desventaja en sus pruebas. Si cae a 0 PV, en un turno posterior podés mover el maleficio con una acción bonus.',
            higher_level: 'Una ranura superior aumenta la duración.',
        },
    },
    {
        slug: 'armor-of-agathys',
        name: 'Armor of Agathys',
        desc: 'Protective frost surrounds you. You gain 5 Temporary Hit Points. If a creature hits you with a melee attack roll before the spell ends, the creature takes 5 Cold damage. The spell ends early if you have no Temporary Hit Points.',
        higher_level: 'The Temporary Hit Points and Cold damage increase by 5 for each slot level above 1.',
        range: 'Self', components: 'V, S, M', material: 'a shard of blue glass', ritual: false,
        duration: '1 hour', concentration: false, casting_time: '1 Bonus Action',
        level: 1, school: 'Abjuration', dnd_class: 'Warlock', spell_lists: ['Warlock'],
        document__slug: 'wotc-srd', document__title: 'D&D 2024',
        translation: {
            name: 'Armadura de Agathys',
            desc: 'Una escarcha protectora te da 5 PV temporales durante 1 hora. Mientras los conserves, una criatura que te impacte con un ataque cuerpo a cuerpo recibe 5 de frío. No requiere concentración.',
            higher_level: 'Los PV temporales y el daño aumentan en 5 por cada nivel de ranura superior a 1.',
        },
    },
];

const ZIK_FEATURES = [
    {
        name: 'Ataque Furtivo', kind: 'Pasivo', resource: '1 vez por turno · 2d6',
        description: 'Una vez por turno, al impactar con un arma a distancia o sutil, sumás 2d6 si atacaste con ventaja o si un aliado está a 5 pies del objetivo y no tenés desventaja. En un crítico también se duplican estos dados.',
    },
    {
        name: 'Acción Astuta · Correr', kind: 'Bonus', resource: 'Sin límite',
        description: 'Usás una acción bonus para Correr y ganás 30 pies de movimiento adicional durante este turno.',
        combat_action: { economy: 'bonus', target: 'self', effect: { type: 'GRANT_EXTRA_MOVEMENT', feet: 30 }, summary: 'Bonus · +30 pies de movimiento este turno' },
    },
    {
        name: 'Acción Astuta · Desconectarse', kind: 'Bonus', resource: 'Sin límite',
        description: 'Usás una acción bonus para Desconectarte. Tu movimiento no provoca ataques de oportunidad durante este turno.',
        combat_action: { economy: 'bonus', target: 'self', effect: { type: 'DISENGAGE' }, summary: 'Bonus · evita ataques de oportunidad este turno' },
    },
    {
        name: 'Acción Astuta · Esconderse', kind: 'Bonus', resource: 'Sin límite',
        description: 'Usás una acción bonus para intentar Esconderte. Al lograrlo, tu próximo ataque se realiza con ventaja; el DM valida si existe cobertura u oscuridad suficiente.',
        combat_action: { economy: 'bonus', target: 'self', effect: { type: 'HIDE_FOR_ADVANTAGE' }, summary: 'Bonus · oculto; ventaja en el próximo ataque' },
    },
    {
        name: 'Puntería Estable', kind: 'Bonus', resource: 'Sin límite',
        description: 'Si todavía no te moviste, usás una acción bonus para obtener ventaja en tu próximo ataque de este turno. Después tu velocidad queda en 0 hasta que termine el turno.',
        combat_action: { economy: 'bonus', target: 'self', effect: { type: 'STEADY_AIM' }, summary: 'Bonus · ventaja en el próximo ataque · velocidad 0' },
    },
    {
        name: 'Manos Rápidas', kind: 'Bonus', resource: 'Sin límite',
        description: 'Como acción bonus podés realizar una prueba de Destreza para abrir cerraduras o desactivar trampas con herramientas de ladrón, o tomar la acción Utilizar.',
        combat_action: { economy: 'bonus', target: 'self', manualResolution: true, summary: 'Bonus · Utilizar o prueba de Destreza con herramientas' },
    },
    {
        name: 'Pacto de la Cadena', kind: 'Accion', resource: 'Sin ranura',
        description: 'Lanzás Encontrar familiar como acción mágica sin gastar ranura. Podés elegir una forma normal o Imp, Pseudodragón, Quasit, Esqueleto, Renacuajo de Slaad, Esfinge de las Maravillas, Duende o Serpiente venenosa. Al tomar la acción Atacar podés ceder uno de tus ataques para que el familiar ataque con su reacción.',
        combat_action: { economy: 'action', target: 'self', manualResolution: true, summary: 'Acción mágica · invoca o configura el familiar' },
    },
    {
        name: 'Ordenar ataque del familiar', kind: 'Accion', resource: 'Requiere familiar',
        description: 'Cedés uno de tus ataques para ordenar a tu familiar que use su reacción y ataque. El DM resuelve el bloque de estadísticas de la forma invocada.',
        combat_action: { economy: 'action', target: 'enemy', range: 120, manualResolution: true, summary: 'Acción · el familiar usa su reacción para atacar' },
    },
    {
        name: 'Descarga sobrenatural', kind: 'Accion', resource: 'Truco · +6',
        description: 'Alcance 120 pies. Lanzás 2 rayos por ser nivel total 5; cada rayo hace un ataque de conjuro a distancia +6 y causa 1d10 de fuerza al impactar. Podés repartir los objetivos.',
    },
    {
        name: 'Ilusión menor', kind: 'Accion', resource: 'Truco · CD 14',
        description: 'Creás un sonido o la imagen de un objeto a 30 pies durante 1 minuto. No usa ranura ni concentración. Investigación contra CD 14 puede descubrirla.',
    },
    {
        name: 'Maleficio', kind: 'Bonus', resource: '1 ranura · Concentración',
        description: 'Maldice a un objetivo visible a 90 pies: cada ataque tuyo que impacta suma 1d6 necrótico y el objetivo tiene desventaja en pruebas de una característica elegida. Podés moverlo con acción bonus si el objetivo cae a 0 PV.',
    },
    {
        name: 'Armadura de Agathys', kind: 'Bonus', resource: '1 ranura · 1 hora',
        description: 'Ganás 5 PV temporales sin concentración. Mientras los conserves, quien te impacte cuerpo a cuerpo recibe 5 de daño de frío.',
    },
    {
        name: 'Magia de Pacto', kind: 'Pasivo', resource: '1 ranura nivel 1',
        description: 'Tenés una ranura de nivel 1 que recuperás al terminar un descanso corto o largo. Tu característica mágica es Carisma: ataque de conjuro +6 y CD de salvación 14.',
    },
    { name: 'Pericia', kind: 'Pasivo', resource: 'Sigilo y Juego de Manos', description: 'Duplicás tu bonificador de competencia en Sigilo y Juego de Manos.' },
    { name: 'Jerga de ladrones', kind: 'Pasivo', resource: 'Idioma secreto', description: 'Conocés la jerga de ladrones y sus señales ocultas.' },
    { name: 'Trabajo en Altura', kind: 'Pasivo', resource: 'Ladrón nivel 3', description: 'Trepar ya no cuesta movimiento adicional y tus saltos con carrera aumentan según tu modificador de Destreza.' },
    { name: 'Maestría de armas · Slow', kind: 'Pasivo', resource: 'Ballesta', description: 'Al impactar con la ballesta, reducís en 10 pies la velocidad del objetivo hasta el inicio de tu próximo turno.' },
    { name: 'Mejora de característica', kind: 'Pasivo', resource: 'Pícaro nivel 4', description: 'La mejora de nivel 4 ya está reflejada en los valores actuales de la ficha.' },
];

function mergeNamed(previous, additions) {
    const values = Array.isArray(previous) ? [...previous] : [];
    additions.forEach((addition) => {
        const index = values.findIndex((entry) => String(entry?.name || '').localeCompare(addition.name, 'es', { sensitivity: 'base' }) === 0);
        if (index >= 0) values[index] = addition;
        else values.push(addition);
    });
    return values;
}

async function ensureSpell(definition, transaction) {
    const [spell, created] = await Spell.findOrCreate({
        where: { slug: definition.slug },
        defaults: definition,
        transaction,
    });

    if (!created) {
        const classNames = new Set(String(spell.dnd_class || '').split(',').map((name) => name.trim()).filter(Boolean));
        String(definition.dnd_class).split(',').map((name) => name.trim()).filter(Boolean).forEach((name) => classNames.add(name));
        await spell.update({
            dnd_class: [...classNames].join(', '),
            spell_lists: [...new Set([...(spell.spell_lists || []), ...(definition.spell_lists || [])])],
            translation: { ...(spell.translation || {}), ...(definition.translation || {}) },
        }, { transaction });
    }

    return { slug: spell.slug, created };
}

async function run() {
    const zik = await Character.findOne({ where: { name: { [Op.iLike]: 'Zik%' } }, order: [['id', 'ASC']] });
    if (!zik) throw new Error('No se encontró el personaje Zik.');

    const before = zik.toJSON();
    const next = {
        class: 'Pícaro (Ladrón) 4 / Brujo 1',
        class_slug: 'rogue',
        archetype_slug: 'thief',
        classes: [{ slug: 'rogue', level: 4 }, { slug: 'warlock', level: 1 }],
        level: 5,
        proficiency_bonus: 3,
        saving_throws: { DEX: true, INT: true },
        custom_features: mergeNamed(zik.custom_features, ZIK_FEATURES),
        spell_slots: {
            ...(zik.spell_slots || {}),
            1: { max: 1, used: 0, source: 'Magia de Pacto', recovery: 'Descanso corto o largo' },
        },
        spells_known: [...new Set([...(zik.spells_known || []), 'eldritch-blast', 'minor-illusion', 'hex', 'armor-of-agathys'])],
        spells_prepared: [...new Set([...(zik.spells_prepared || []), 'hex', 'armor-of-agathys'])],
        feature_choices: {
            ...(zik.feature_choices || {}),
            'warlock:Eldritch Invocations': ['pact-of-the-chain'],
        },
    };

    const preview = {
        characterId: zik.id,
        before: {
            class: before.class, class_slug: before.class_slug, archetype_slug: before.archetype_slug,
            classes: before.classes, level: before.level, hp_current: before.hp_current, hp_max: before.hp_max,
            spells_known: before.spells_known, spells_prepared: before.spells_prepared, spell_slots: before.spell_slots,
        },
        after: { ...next, custom_features: next.custom_features.map((feature) => feature.name) },
    };

    if (!APPLY) {
        console.log(JSON.stringify({ mode: 'dry-run', ...preview }, null, 2));
        return;
    }

    await sequelize.transaction(async (transaction) => {
        const spells = [];
        for (const definition of SPELLS) spells.push(await ensureSpell(definition, transaction));
        await zik.update(next, { transaction });
        for (const skillName of ['Sigilo', 'Juego de Manos']) {
            const skill = await Skill.findOne({ where: { character_id: zik.id, name: { [Op.iLike]: skillName } }, transaction });
            if (skill) await skill.update({ proficiency_level: 2 }, { transaction });
            else await Skill.create({ character_id: zik.id, name: skillName, proficiency_level: 2 }, { transaction });
        }
        await CharacterAuditLog.create({
            character_id: zik.id,
            actor_username: 'Codex / DM',
            actor_role: 'DM',
            source: 'zik-multiclass-setup',
            changes: {
                character_build: { before: preview.before, after: next },
                compendium_spells: { after: spells },
            },
        }, { transaction });
    });

    const updated = await Character.findByPk(zik.id, {
        attributes: ['id', 'name', 'class', 'class_slug', 'archetype_slug', 'classes', 'level', 'hp_current', 'hp_max', 'custom_features', 'spell_slots', 'spells_known', 'spells_prepared', 'feature_choices'],
    });
    console.log(JSON.stringify({ mode: 'applied', character: updated }, null, 2));
}

run()
    .then(() => sequelize.close())
    .catch(async (error) => {
        console.error(error);
        await sequelize.close();
        process.exit(1);
    });
