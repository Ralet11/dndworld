require('dotenv').config({ quiet: true });

const sequelize = require('../config/database');
const {
    Character, AbilityScore, Skill, NpcAction,
} = require('../models');

const APPLY = process.argv.includes('--apply');

const EXECUTOR_TRAITS = [
    { name: 'Escudo Arcano', description: 'Resistencia al daño contundente, perforante y cortante de armas no mágicas.' },
    { name: 'Enlace Gemelo', description: 'Mientras el otro Ejecutor de Vorcan siga con vida, ambos tienen ventaja en salvaciones contra ser asustados o hechizados.' },
];

const NPCS = [
    {
        key: 'executor-1', names: ['Ejecutor de Vorcan I'],
        fields: {
            name: 'Ejecutor de Vorcan I', race: 'Humanoide', class: 'Ejecutor de élite', alignment: 'Maligno',
            level: 4, hp_current: 50, hp_max: 50, ac_base: 15, speed: 30, initiative_bonus: 1,
            size: 'Mediano', creature_type: 'Humanoide', challenge_rating: '4', proficiency_bonus: 2,
            passive_perception: 13, saving_throws: { int: 4, wis: 3, con: 4 },
            damage_resistances: ['Contundente, perforante y cortante de armas no mágicas'],
            senses: ['Visión en la oscuridad 60 pies'], languages: ['Común', 'Bajo Vorcan'],
            npc_type: 'enemigo', origin: 'Vorcan', notes: 'Ejecutor de Vorcan vinculado por Enlace Gemelo al Ejecutor II.',
            abilities_text: 'Amenaza de élite calibrada. Coordina sus acciones con su gemelo y protege la línea de Vorcan.',
            custom_features: EXECUTOR_TRAITS.map(trait => ({ ...trait, kind: 'Pasivo' })),
        },
        abilities: { STR: 14, DEX: 12, CON: 14, INT: 14, WIS: 12, CHA: 10 },
        skills: { Arcanos: 2, 'Percepción': 1 },
        actions: 'executor',
    },
    {
        key: 'executor-2', names: ['Ejecutor de Vorcan II'],
        fields: {
            name: 'Ejecutor de Vorcan II', race: 'Humanoide', class: 'Ejecutor de élite', alignment: 'Maligno',
            level: 4, hp_current: 50, hp_max: 50, ac_base: 15, speed: 30, initiative_bonus: 1,
            size: 'Mediano', creature_type: 'Humanoide', challenge_rating: '4', proficiency_bonus: 2,
            passive_perception: 13, saving_throws: { int: 4, wis: 3, con: 4 },
            damage_resistances: ['Contundente, perforante y cortante de armas no mágicas'],
            senses: ['Visión en la oscuridad 60 pies'], languages: ['Común', 'Bajo Vorcan'],
            npc_type: 'enemigo', origin: 'Vorcan', notes: 'Ejecutor de Vorcan vinculado por Enlace Gemelo al Ejecutor I.',
            abilities_text: 'Amenaza de élite calibrada. Coordina sus acciones con su gemelo y protege la línea de Vorcan.',
            custom_features: EXECUTOR_TRAITS.map(trait => ({ ...trait, kind: 'Pasivo' })),
        },
        abilities: { STR: 14, DEX: 12, CON: 14, INT: 14, WIS: 12, CHA: 10 },
        skills: { Arcanos: 2, 'Percepción': 1 },
        actions: 'executor',
    },
    {
        key: 'infiltrator', names: ['Infiltrador de Vorcan'],
        fields: {
            name: 'Infiltrador de Vorcan', race: 'Humanoide', class: 'Controlador de campo', alignment: 'Maligno',
            level: 2, hp_current: 30, hp_max: 30, ac_base: 14, speed: 40, initiative_bonus: 3,
            size: 'Mediano', creature_type: 'Humanoide', challenge_rating: '2', proficiency_bonus: 2,
            passive_perception: 13, saving_throws: {}, damage_resistances: [],
            senses: ['Visión en la oscuridad 60 pies'], languages: ['Común', 'Bajo Vorcan'],
            npc_type: 'enemigo', origin: 'Vorcan', notes: 'Controlador de campo de Vorcan. No busca ganar en daño: fragmenta el mapa y castiga la salida de sus zonas.',
            abilities_text: 'Velocidad de trepar 20 pies. Especialista en movilidad, control de terreno y emboscadas.',
            custom_features: [
                { name: 'Paso entre Sombras', kind: 'Bonus', description: 'Teletransporte de hasta 15 pies entre dos puntos de luz tenue u oscuridad que pueda ver.' },
                { name: 'Maestro del Campo', kind: 'Bonus', description: 'Vuelca hasta dos mesas u objetos grandes a 30 pies y crea terreno difícil en un radio de 10 pies alrededor de cada uno.' },
            ],
        },
        abilities: { STR: 10, DEX: 16, CON: 10, INT: 12, WIS: 12, CHA: 14 },
        skills: { Sigilo: 2, Acrobacia: 1, 'Percepción': 1, 'Engaño': 1 },
        actions: 'infiltrator',
    },
    {
        key: 'fire-assassin', names: ['Asesino Imperial de Fuego'],
        fields: {
            name: 'Asesino Imperial de Fuego', race: 'Humanoide', class: 'Asesino imperial', alignment: 'Maligno',
            level: 4, hp_current: 48, hp_max: 48, ac_base: 15, speed: 35, initiative_bonus: 4,
            size: 'Mediano', creature_type: 'Humanoide', challenge_rating: '4', proficiency_bonus: 2,
            passive_perception: 14, saving_throws: {}, damage_resistances: ['Fuego'],
            senses: ['Visión en la oscuridad 60 pies'], languages: ['Común', 'Bajo Vorcan'],
            npc_type: 'enemigo', origin: 'Imperio de Fuego', notes: 'Amenaza principal. Convierte el campo de batalla en un cronómetro y ejecuta a objetivos aislados o sorprendidos.',
            abilities_text: 'Asesino imperial calibrado para controlar sectores incendiados, sorprender y aislar objetivos.',
            custom_features: [
                { name: 'Sentencia Imperial', kind: 'Pasivo', description: 'Ventaja en ataques contra criaturas que todavía no actuaron en el combate. Cualquier impacto contra una criatura sorprendida es crítico automático.' },
                { name: 'Piel de Brasa', kind: 'Pasivo', description: 'Inmune a ser incendiado por sus propios efectos de fuego y resistente al daño de fuego.' },
            ],
        },
        abilities: { STR: 10, DEX: 18, CON: 14, INT: 12, WIS: 14, CHA: 10 },
        skills: { Sigilo: 2, Acrobacia: 1, 'Percepción': 1 },
        actions: 'fire-assassin',
    },
    {
        key: 'leandro', names: ['Leandro Bonasera'],
        fields: {
            name: 'Leandro Bonasera', race: 'Humano', class: 'Patriarca Bonasera', alignment: 'Neutral bueno',
            level: 3, hp_current: 45, hp_max: 45, ac_base: 15, speed: 30, initiative_bonus: 1,
            size: 'Mediano', creature_type: 'Humanoide', challenge_rating: '3', proficiency_bonus: 2,
            passive_perception: 14, saving_throws: { con: 5, wis: 4, cha: 5 },
            damage_resistances: [], senses: ['Percepción pasiva 14'], languages: ['Común'],
            npc_type: 'amigo', origin: 'Costa Oscura',
            abilities_text: 'Cabeza de la familia Bonasera y veterano de peleas de taberna. Protege aliados, ordena reposicionamientos y se mantiene en pie cuando otros caerían.',
            custom_features: [
                { name: 'Cabeza de la Familia', kind: 'Pasivo', description: 'Aliados Bonasera a 10 pies suman +1 a salvaciones contra ser asustados o hechizados.' },
                { name: 'Aguante Bonasera', kind: 'Pasivo', resource: '1/Descanso Largo', description: 'La primera vez que fuera a caer a 0 PV, queda a 1 PV en su lugar.' },
            ],
        },
        abilities: { STR: 16, DEX: 12, CON: 16, INT: 13, WIS: 14, CHA: 16 },
        skills: { 'Perspicacia': 1, 'Intimidación': 1, 'Percepción': 1, 'Persuasión': 1 },
        actions: 'leandro',
    },
    {
        key: 'dedos', names: ['Dedos Bonasera', 'Dedos'],
        fields: {
            name: 'Dedos Bonasera', race: 'Humano', class: 'Escaramuzador Bonasera', alignment: 'Neutral bueno',
            level: 3, hp_current: 32, hp_max: 32, ac_base: 15, speed: 35, initiative_bonus: 3,
            size: 'Mediano', creature_type: 'Humanoide', challenge_rating: '2', proficiency_bonus: 2,
            passive_perception: 13, saving_throws: { dex: 5, int: 4 },
            damage_resistances: [], senses: ['Percepción pasiva 13'], languages: ['Común', 'Jerga del puerto'],
            npc_type: 'amigo', origin: 'Costa Oscura',
            abilities_text: 'Escaramuzador, ladrón de puerto y especialista en manos rápidas. Ataca desde posiciones ventajosas y se retira antes de quedar rodeado.',
            custom_features: [
                { name: 'Ataque Furtivo', kind: 'Disparador', resource: '1/Turno', description: 'Suma 2d6 al daño cuando tiene ventaja o un aliado consciente está a 5 pies del objetivo y Dedos no tiene desventaja.' },
                { name: 'Manos Rápidas', kind: 'Bonus', description: 'Puede Correr, Destrabarse, Esconderse o Utilizar un objeto como Acción bonus.' },
            ],
        },
        abilities: { STR: 10, DEX: 16, CON: 14, INT: 14, WIS: 12, CHA: 12 },
        skills: { 'Juego de Manos': 2, Sigilo: 2, 'Investigación': 1, 'Percepción': 1 },
        actions: 'dedos',
    },
];

const ACTION_SETS = {
    executor: [
        { name: 'Escudo Arcano', action_type: 'rasgo', description: EXECUTOR_TRAITS[0].description, sort_order: 0 },
        { name: 'Enlace Gemelo', action_type: 'rasgo', description: EXECUTOR_TRAITS[1].description, sort_order: 1 },
        { name: 'Multiataque', action_type: 'acción', description: 'Realiza dos ataques con su Vara de Combate.', sort_order: 2 },
        { name: 'Vara de Combate', action_type: 'acción', attack_bonus: 4, damage_dice: '1d6', damage_bonus: 1, damage_type: 'Fuerza', reach: 'Alcance 5 pies, un objetivo', description: 'Ataque de arma cuerpo a cuerpo.', sort_order: 3 },
        { name: 'Descarga de Vorcan', action_type: 'acción', attack_bonus: 4, damage_dice: '2d10', damage_type: 'Fuerza', reach: 'Alcance 60 pies, un objetivo', recharge: '5–6', description: 'Ataque de conjuro a distancia. Puede reemplazar uno de los ataques de Multiataque.', sort_order: 4 },
        { name: 'Cadena Rota', action_type: 'acción', save_ability: 'STR', save_dc: 13, reach: 'Un objetivo a 30 pies', recharge: '5–6', description: 'No se puede usar en el mismo turno que Descarga de Vorcan. Si falla la salvación queda apresado por cadenas de fuerza pura hasta el final de su siguiente turno.', sort_order: 5 },
        { name: 'Contraataque Arcano', action_type: 'reacción', save_ability: 'DEX', save_dc: 13, description: 'Cuando es alcanzado por un ataque cuerpo a cuerpo, fuerza al atacante a salvar. Si falla, es empujado 10 pies y cae derribado.', sort_order: 6 },
    ],
    infiltrator: [
        { name: 'Paso entre Sombras', action_type: 'bonus', reach: '15 pies', description: 'Se teletransporta entre dos puntos de luz tenue u oscuridad que pueda ver.', sort_order: 0 },
        { name: 'Maestro del Campo', action_type: 'bonus', reach: '30 pies', description: 'Sin límite de usos. Vuelca hasta dos mesas u objetos grandes, creando terreno difícil en un radio de 10 pies alrededor de cada uno.', sort_order: 1 },
        { name: 'Daga Corta', action_type: 'acción', attack_bonus: 5, damage_dice: '1d4', damage_bonus: 2, damage_type: 'Perforante', reach: '5 pies o distancia corta, un objetivo', description: 'Al impactar también causa 1d6 de veneno; sin ventaja o aliado adyacente al objetivo causa sólo el daño básico.', sort_order: 2 },
        { name: 'Ancla de Sombra', action_type: 'acción', save_ability: 'WIS', save_dc: 13, reach: 'Objeto plantado a 30 pies; aura de 10 pies', description: 'Reemplaza un ataque. Crea un ancla de CA 13 y 10 PG. Un enemigo que termina dentro del aura salva o queda asustado y con velocidad reducida a la mitad hasta destruir el ancla o alejarse.', sort_order: 3 },
        { name: 'Grito Quebrado', action_type: 'reacción', save_ability: 'CON', save_dc: 13, recharge: '1/Ronda', description: 'Cuando una criatura sale del radio de un Ancla de Sombra, puede forzarla a salvar. Si falla, queda aturdida hasta el final de su siguiente turno.', sort_order: 4 },
    ],
    'fire-assassin': [
        { name: 'Sentencia Imperial', action_type: 'rasgo', description: 'Ventaja en ataques contra criaturas que todavía no actuaron. Todo impacto contra una criatura sorprendida es crítico automático.', sort_order: 0 },
        { name: 'Piel de Brasa', action_type: 'rasgo', description: 'Inmune a ser incendiado por sus propios efectos de fuego y resistente al daño de fuego.', sort_order: 1 },
        { name: 'Daga Ígnea', action_type: 'acción', attack_bonus: 5, damage_dice: '1d4', damage_bonus: 2, damage_type: 'Perforante', reach: '5 pies, un objetivo', description: 'Al impactar causa además 1d6 de daño de fuego.', sort_order: 2 },
        { name: 'Fuego Sectorial', action_type: 'acción', damage_dice: '2d6', damage_type: 'Fuego', reach: 'Sector a 60 pies', save_ability: 'DEX', save_dc: 15, recharge: '5–6', description: 'Incendia un sector de la taberna, que se vuelve terreno peligroso. Salvación para mitad. Al inicio de cada ronda tira 1d20; con 13 o más el fuego se extiende a un sector contiguo.', sort_order: 3 },
        { name: 'Latigazo Encadenado', action_type: 'acción', damage_dice: '2d6', damage_type: 'Fuego', reach: 'Un objetivo distinto a 60 pies', save_ability: 'DEX', save_dc: 14, recharge: '5–6', description: 'Reemplaza un ataque. Con salvación exitosa recibe la mitad del daño.', sort_order: 4 },
        { name: 'Salto entre Llamas', action_type: 'reacción', reach: '30 pies', recharge: '1/Turno', description: 'Si hay un sector encendido, se teletransporta allí sin provocar ataques de oportunidad.', sort_order: 5 },
    ],
    leandro: [
        { name: 'Cabeza de la Familia', action_type: 'rasgo', description: 'Aliados Bonasera a 10 pies suman +1 a salvaciones contra ser asustados o hechizados.', sort_order: 0 },
        { name: 'Aguante Bonasera', action_type: 'rasgo', max_uses: 1, description: 'Una vez por descanso largo, cuando fuera a caer a 0 PV, queda a 1 PV.', sort_order: 1 },
        { name: 'Multiataque', action_type: 'acción', description: 'Realiza dos ataques con el Bastón Reforzado.', sort_order: 2 },
        { name: 'Bastón Reforzado', action_type: 'acción', attack_bonus: 5, damage_dice: '1d8', damage_bonus: 3, damage_type: 'Contundente', reach: '5 pies, un objetivo', sort_order: 3 },
        { name: 'Ballesta Ligera', action_type: 'acción', attack_bonus: 3, damage_dice: '1d8', damage_bonus: 1, damage_type: 'Perforante', reach: '80/320 pies, un objetivo', sort_order: 4 },
        { name: 'Orden de Cobertura', action_type: 'bonus', max_uses: 3, reach: 'Aliado a 30 pies', description: 'El aliado elegido puede usar su reacción para moverse hasta la mitad de su velocidad sin provocar ataques de oportunidad.', sort_order: 5 },
        { name: 'Cubrir a la Familia', action_type: 'reacción', reach: 'Aliado a 5 pies', description: 'Impone desventaja a un ataque dirigido contra un aliado que pueda ver.', sort_order: 6 },
    ],
    dedos: [
        { name: 'Ataque Furtivo', action_type: 'rasgo', damage_dice: '2d6', recharge: '1/Turno', description: 'Suma el daño si tiene ventaja o un aliado consciente está adyacente al objetivo y Dedos no tiene desventaja.', sort_order: 0 },
        { name: 'Manos Rápidas', action_type: 'bonus', description: 'Puede Correr, Destrabarse, Esconderse o Utilizar un objeto.', sort_order: 1 },
        { name: 'Daga', action_type: 'acción', attack_bonus: 5, damage_dice: '1d4', damage_bonus: 3, damage_type: 'Perforante', reach: '5 pies o 20/60 pies', sort_order: 2 },
        { name: 'Ballesta de Mano', action_type: 'acción', attack_bonus: 5, damage_dice: '1d6', damage_bonus: 3, damage_type: 'Perforante', reach: '30/120 pies, un objetivo', sort_order: 3 },
        { name: 'Arena a los Ojos', action_type: 'bonus', save_ability: 'DEX', save_dc: 13, reach: '5 pies, un objetivo', recharge: '5–6', description: 'Si falla la salvación queda cegado hasta el final de su siguiente turno.', sort_order: 4 },
        { name: 'Esquiva Instintiva', action_type: 'reacción', recharge: '1/Ronda', description: 'Cuando un atacante que puede ver lo impacta, reduce a la mitad el daño de ese ataque.', sort_order: 5 },
    ],
};

async function findExisting(names, transaction) {
    return Character.findOne({ where: { name: names }, transaction });
}

async function upsertCharacter(definition, transaction) {
    let character = await findExisting(definition.names, transaction);
    const created = !character;
    if (!character) character = await Character.create({ name: definition.fields.name, is_npc: true }, { transaction });

    const preserved = character.toJSON();
    const fields = {
        ...definition.fields,
        is_npc: true,
        // Encounter NPCs stay available to the DM without being included in
        // every global party payload sent to connected players.
        is_active: false,
        image_url: preserved.image_url || null,
        base_body_url: preserved.base_body_url || null,
        rendered_url: preserved.rendered_url || null,
    };
    await character.update(fields, { transaction });

    for (const [ability, value] of Object.entries(definition.abilities)) {
        const [score] = await AbilityScore.findOrCreate({
            where: { character_id: character.id, ability },
            defaults: { character_id: character.id, ability, base_value: value, bonus_value: 0 },
            transaction,
        });
        await score.update({ base_value: value, bonus_value: 0 }, { transaction });
    }

    await Skill.destroy({ where: { character_id: character.id }, transaction });
    for (const [name, proficiency_level] of Object.entries(definition.skills)) {
        await Skill.create({ character_id: character.id, name, proficiency_level }, { transaction });
    }

    await NpcAction.destroy({ where: { character_id: character.id }, transaction });
    for (const action of ACTION_SETS[definition.actions]) {
        await NpcAction.create({ ...action, character_id: character.id, used_uses: 0, is_public: false }, { transaction });
    }

    return { character, created, before: preserved };
}

async function preview() {
    const result = [];
    for (const definition of NPCS) {
        const existing = await findExisting(definition.names);
        result.push({
            target: definition.fields.name,
            operation: existing ? 'update' : 'create',
            existing: existing ? {
                id: existing.id, name: existing.name, hp_current: existing.hp_current, hp_max: existing.hp_max,
                ac_base: existing.ac_base, image_url: existing.image_url, npc_type: existing.npc_type,
            } : null,
            after: {
                hp: definition.fields.hp_max, ac: definition.fields.ac_base, cr: definition.fields.challenge_rating,
                abilities: definition.abilities, skills: definition.skills,
                actions: ACTION_SETS[definition.actions].map(action => `${action.action_type}: ${action.name}`),
            },
        });
    }
    console.log(JSON.stringify({ mode: 'dry-run', npcs: result }, null, 2));
}

async function apply() {
    const result = [];
    await sequelize.transaction(async transaction => {
        for (const definition of NPCS) {
            const saved = await upsertCharacter(definition, transaction);
            result.push({
                id: saved.character.id, name: saved.character.name, created: saved.created,
                hp: saved.character.hp_max, ac: saved.character.ac_base,
                imagePreserved: Boolean(saved.character.image_url), actions: ACTION_SETS[definition.actions].length,
            });
        }
    });
    console.log(JSON.stringify({ mode: 'applied', npcs: result }, null, 2));
}

(APPLY ? apply() : preview())
    .then(() => sequelize.close())
    .catch(async error => { console.error(error); await sequelize.close(); process.exit(1); });
