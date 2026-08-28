require('dotenv').config({ quiet: true });

const sequelize = require('../config/database');
const { Character, AbilityScore, NpcAction } = require('../models');

const APPLY = process.argv.includes('--apply');

const NPCS = [
    {
        name: 'Gafel',
        fields: {
            race: 'Humano', class: 'Duelista / comandante', alignment: 'Neutral maligno',
            hp_current: 68, hp_max: 68, ac_base: 17, speed: 30, initiative_bonus: 4,
            size: 'Mediano', creature_type: 'Humanoide', proficiency_bonus: 3,
            passive_perception: 14, saving_throws: { dex: 7, wis: 4 },
            npc_type: 'enemigo', party_known: false, origin: 'Casa de la Viuda',
            notes: 'Dirige la Casa de la Viuda cuando Vorcan no está. Tranquilo, educado y desagradablemente seguro de sí mismo. No grita órdenes: los demás ya saben qué hacer.',
            abilities_text: 'Duelista y comandante de dos fases. Combina precisión, movilidad, daño furtivo y órdenes coordinadas.',
        },
        abilities: { STR: 14, DEX: 18, CON: 16, INT: 12, WIS: 12, CHA: 16 },
        actions: [
            { name: 'Multiataque', action_type: 'acción', description: 'Realiza 2 ataques con Espada fina.', sort_order: 0 },
            { name: 'Espada fina', action_type: 'acción', attack_bonus: 7, damage_dice: '1d8', damage_bonus: 4, damage_type: 'Cortante', reach: '5 pies, un objetivo', description: 'Ataque cuerpo a cuerpo con espada.', sort_order: 1 },
            { name: 'Ataque furtivo', action_type: 'rasgo', damage_dice: '2d6', recharge: '1/Turno', description: 'Una vez por turno suma 2d6 de daño si tiene ventaja o si un aliado está junto al objetivo.', sort_order: 2 },
            { name: 'Parada precisa', action_type: 'reacción', description: 'Cuando recibe un ataque cuerpo a cuerpo, gana +3 CA contra ese ataque.', sort_order: 3 },
            { name: 'Paso del duelista', action_type: 'rasgo', reach: '5 pies', description: 'Después de impactar un ataque puede desplazarse 5 pies sin provocar ataques de oportunidad.', sort_order: 4 },
            { name: 'Orden del comandante', action_type: 'acción', max_uses: 1, reach: 'Un aliado que pueda ver', description: 'Una vez por combate, un aliado que Gafel vea puede usar inmediatamente su reacción para moverse hasta la mitad de su velocidad y realizar un ataque.', sort_order: 5 },
            { name: 'Segunda fase: Doble espada', action_type: 'rasgo', description: 'Al bajar de 34 PG desenfunda otra espada. Desde entonces realiza 3 ataques por turno y cada ataque causa 1d6+4 de daño. Debe marcarse visualmente el inicio de la segunda fase.', sort_order: 6 },
        ],
    },
    {
        name: 'Saira',
        fields: {
            race: 'Humana', class: 'Especialista en movilidad', alignment: 'Neutral maligna',
            hp_current: 48, hp_max: 48, ac_base: 16, speed: 40, initiative_bonus: 4,
            size: 'Mediano', creature_type: 'Humanoide', proficiency_bonus: 3,
            passive_perception: 13, saving_throws: { dex: 7 },
            npc_type: 'enemigo', party_known: false, origin: 'Casa de la Viuda',
            notes: 'Delgada, rápida y arrogante. No pelea donde está: pelea donde quiere estar. Rival natural de Rakion.',
            abilities_text: 'Especialista en movilidad, marcas y persecución. Puede trepar a velocidad normal.',
        },
        abilities: { STR: 10, DEX: 18, CON: 14, INT: 12, WIS: 13, CHA: 14 },
        actions: [
            { name: 'Trepar sin pausa', action_type: 'rasgo', description: 'Puede trepar usando su velocidad normal.', sort_order: 0 },
            { name: 'Multiataque', action_type: 'acción', description: 'Realiza 2 ataques con Daga curva.', sort_order: 1 },
            { name: 'Daga curva', action_type: 'acción', attack_bonus: 7, damage_dice: '1d6', damage_bonus: 4, damage_type: 'Perforante', reach: '5 pies, un objetivo', description: 'Ataque cuerpo a cuerpo con daga.', sort_order: 2 },
            { name: 'Ataque furtivo', action_type: 'rasgo', damage_dice: '2d6', recharge: '1/Turno', description: 'Una vez por turno puede añadir 2d6 de daño furtivo cuando se cumplan sus condiciones.', sort_order: 3 },
            { name: 'Movilidad astuta', action_type: 'bonus', description: 'Puede Correr o Destrabarse como acción bonus.', sort_order: 4 },
            { name: 'Marca de caza', action_type: 'bonus', damage_dice: '1d6', reach: 'Una criatura que pueda ver', description: 'Marca a una criatura durante 1 minuto. Conoce aproximadamente su posición mientras esté a 60 pies y el primer impacto de cada turno contra ella causa 1d6 adicional. Sólo puede mantener una marca.', sort_order: 5 },
            { name: 'Acecho de la presa', action_type: 'reacción', reach: '15 pies', description: 'Si el objetivo marcado termina su turno sin aliados a 10 pies, Saira puede moverse hasta 15 pies hacia él sin provocar ataques de oportunidad. Este movimiento no incluye un ataque.', sort_order: 6 },
            { name: 'Salto depredador', action_type: 'acción', max_uses: 1, damage_dice: '2d6', save_ability: 'STR', save_dc: 14, description: 'Una vez por combate salta desde una posición elevada sobre un enemigo y ataca con ventaja. Si impacta, suma 2d6 de daño y el objetivo salva Fuerza CD 14 o cae Derribado.', sort_order: 7 },
        ],
    },
    {
        name: 'El Bruto',
        fields: {
            race: 'Humano', class: 'Bruto de contención', alignment: 'Neutral maligno',
            hp_current: 78, hp_max: 78, ac_base: 16, speed: 30, initiative_bonus: 1,
            size: 'Mediano', creature_type: 'Humanoide', proficiency_bonus: 3,
            passive_perception: 12, saving_throws: { str: 8, con: 7 },
            npc_type: 'enemigo', party_known: false, origin: 'Casa de la Viuda',
            notes: 'Enorme, cabeza afeitada y cubierto de cicatrices. Vorcan lo utiliza para impedir que las víctimas escapen. Rival natural de Lucario.',
            abilities_text: 'Especialista en carga, derribo, agarre y bloqueo de retirada.',
        },
        abilities: { STR: 20, DEX: 12, CON: 18, INT: 9, WIS: 12, CHA: 10 },
        actions: [
            { name: 'Multiataque', action_type: 'acción', description: 'Realiza 2 ataques con Cuchilla pesada.', sort_order: 0 },
            { name: 'Cuchilla pesada', action_type: 'acción', attack_bonus: 7, damage_dice: '1d10', damage_bonus: 5, damage_type: 'Cortante', reach: '5 pies, un objetivo', description: 'Ataque cuerpo a cuerpo con una cuchilla de gran tamaño.', sort_order: 1 },
            { name: 'Carga arrolladora', action_type: 'rasgo', save_ability: 'STR', save_dc: 15, description: 'Si se desplaza al menos 15 pies en línea recta antes de impactar, el objetivo salva Fuerza CD 15. Si falla, es empujado 10 pies y cae Derribado.', sort_order: 2 },
            { name: 'Agarre sobre el caído', action_type: 'acción', save_ability: 'STR', save_dc: 15, description: 'Al impactar a una criatura Derribada puede reemplazar su segundo ataque por un Agarre, con escape CD 15. Mientras la mantiene agarrada, su propia velocidad se reduce a la mitad.', sort_order: 3 },
            { name: 'Nadie escapa', action_type: 'reacción', description: 'Si una criatura dentro de su alcance intenta alejarse, realiza un ataque de oportunidad con ventaja. Si impacta, la velocidad del objetivo pasa a 0.', sort_order: 4 },
            { name: 'Duro de matar', action_type: 'reacción', max_uses: 1, description: 'Una vez por combate, cuando recibiría daño, lo reduce en 1d10+4.', sort_order: 5 },
        ],
    },
    {
        name: 'Odran',
        fields: {
            race: 'Humano', class: 'Saboteador alquímico', alignment: 'Neutral maligno',
            hp_current: 46, hp_max: 46, ac_base: 15, speed: 30, initiative_bonus: 3,
            size: 'Mediano', creature_type: 'Humanoide', proficiency_bonus: 3,
            passive_perception: 13, saving_throws: { dex: 6, int: 5 },
            npc_type: 'enemigo', party_known: false, origin: 'Casa de la Viuda',
            notes: 'No utiliza magia convencional: usa venenos, humo, aceite, polvo y pequeñas herramientas. Hace que una batalla normal deje de ser normal.',
            abilities_text: 'Controlador de campo y saboteador. No debería matar a nadie solo; su función es desarmar el plan de la party.',
        },
        abilities: { STR: 10, DEX: 16, CON: 14, INT: 16, WIS: 13, CHA: 11 },
        actions: [
            { name: 'Hoja envenenada', action_type: 'acción', attack_bonus: 6, damage_dice: '1d6', damage_bonus: 3, damage_type: 'Perforante + Veneno', reach: '5 pies, un objetivo', description: 'Causa 1d6+3 de daño perforante y 1d6 de daño de veneno.', sort_order: 0 },
            { name: 'Bomba de humo', action_type: 'acción', recharge: '5–6', reach: '30 pies; radio de 10 pies', description: 'Lanza una bomba que deja la zona muy oscurecida hasta el comienzo del próximo turno de Odran.', sort_order: 1 },
            { name: 'Polvo inhibidor', action_type: 'acción', max_uses: 2, save_ability: 'CON', save_dc: 14, reach: 'Cono de 15 pies', description: 'Constitución CD 14. Si falla, la criatura no puede realizar reacciones y tiene desventaja en su próximo ataque hasta el final de su próximo turno.', sort_order: 2 },
            { name: 'Aceite resbaladizo', action_type: 'acción', max_uses: 1, save_ability: 'DEX', save_dc: 13, reach: 'Zona de 10 por 10 pies', description: 'Una vez por combate cubre una zona que se vuelve terreno difícil. La primera criatura que entre rápidamente o falle Destreza CD 13 cae Derribada. Si el aceite se enciende, causa 1d6 de fuego al comenzar el turno dentro del área.', sort_order: 3 },
            { name: 'Escapista', action_type: 'bonus', description: 'Puede Esconderse o Destrabarse como acción bonus.', sort_order: 4 },
        ],
    },
    {
        name: 'Nyra',
        fields: {
            race: 'Humana', class: 'Tiradora', alignment: 'Neutral maligna',
            hp_current: 44, hp_max: 44, ac_base: 15, speed: 30, initiative_bonus: 4,
            size: 'Mediano', creature_type: 'Humanoide', proficiency_bonus: 3,
            passive_perception: 15, saving_throws: { dex: 7, wis: 5 },
            npc_type: 'enemigo', party_known: false, origin: 'Casa de la Viuda',
            notes: 'Empieza normalmente en un piso superior o balcón. No tiene interés en duelos: dispara al personaje que considera más vulnerable o peligroso. Rival natural de Paleas o cualquier combatiente a distancia.',
            abilities_text: 'Tiradora de largo alcance. Apunta si permanece inmóvil y se reposiciona cuando un enemigo consigue acercarse.',
        },
        abilities: { STR: 10, DEX: 18, CON: 14, INT: 13, WIS: 15, CHA: 11 },
        actions: [
            { name: 'Disparo de largo alcance', action_type: 'acción', attack_bonus: 7, damage_dice: '1d10', damage_bonus: 4, damage_type: 'Perforante', reach: '100/400 pies, un objetivo', description: 'Ataque a distancia contra el objetivo que Nyra considere más vulnerable o peligroso.', sort_order: 0 },
            { name: 'Ataque furtivo', action_type: 'rasgo', damage_dice: '2d6', recharge: '1/Turno', description: 'Una vez por turno suma 2d6 de daño furtivo cuando se cumplan sus condiciones.', sort_order: 1 },
            { name: 'Apuntar', action_type: 'bonus', description: 'Si Nyra no se mueve durante su turno, puede apuntar. Su próximo disparo tiene ventaja e ignora media cobertura.', sort_order: 2 },
            { name: 'Disparo incapacitante', action_type: 'acción', recharge: '5–6', save_ability: 'CON', save_dc: 14, description: 'Si impacta causa el daño normal y el objetivo salva Constitución CD 14. Si falla, su velocidad se reduce a la mitad y no puede Correr hasta terminar su siguiente turno.', sort_order: 3 },
            { name: 'Retirada de la tiradora', action_type: 'reacción', reach: '10 pies', description: 'Después de que alguien termine su turno a 15 pies de ella, Nyra puede moverse 10 pies sin provocar ataques de oportunidad.', sort_order: 4 },
            { name: 'Arma corta', action_type: 'acción', attack_bonus: 6, damage_dice: '1d6', damage_bonus: 3, damage_type: 'Perforante', reach: '5 pies, un objetivo', description: 'Recurso defensivo cuerpo a cuerpo. Nyra evita permanecer trabada en melee.', sort_order: 5 },
        ],
    },
];

async function findNpc(name, transaction) {
    return Character.findOne({ where: { name, is_npc: true }, transaction });
}

async function saveNpc(definition, transaction) {
    let npc = await findNpc(definition.name, transaction);
    const created = !npc;
    if (!npc) npc = await Character.create({ name: definition.name, is_npc: true }, { transaction });

    const previous = npc.toJSON();
    await npc.update({
        ...definition.fields,
        name: definition.name,
        is_npc: true,
        is_active: false,
        image_url: previous.image_url || null,
        base_body_url: previous.base_body_url || null,
        rendered_url: previous.rendered_url || null,
    }, { transaction });

    for (const [ability, baseValue] of Object.entries(definition.abilities)) {
        const [score] = await AbilityScore.findOrCreate({
            where: { character_id: npc.id, ability },
            defaults: { character_id: npc.id, ability, base_value: baseValue, bonus_value: 0 },
            transaction,
        });
        await score.update({ base_value: baseValue, bonus_value: 0 }, { transaction });
    }

    await NpcAction.destroy({ where: { character_id: npc.id }, transaction });
    for (const action of definition.actions) {
        await NpcAction.create({
            ...action,
            character_id: npc.id,
            used_uses: 0,
            is_public: false,
        }, { transaction });
    }

    return { id: npc.id, name: npc.name, created, actions: definition.actions.length, hp: npc.hp_max, ac: npc.ac_base };
}

async function preview() {
    const result = [];
    for (const definition of NPCS) {
        const existing = await findNpc(definition.name);
        result.push({
            name: definition.name,
            operation: existing ? 'update' : 'create',
            existingId: existing?.id || null,
            hp: definition.fields.hp_max,
            ac: definition.fields.ac_base,
            actions: definition.actions.map(action => `${action.action_type}: ${action.name}`),
        });
    }
    console.log(JSON.stringify({ mode: 'dry-run', npcs: result }, null, 2));
}

async function apply() {
    const result = [];
    await sequelize.transaction(async transaction => {
        for (const definition of NPCS) result.push(await saveNpc(definition, transaction));
    });
    console.log(JSON.stringify({ mode: 'applied', npcs: result }, null, 2));
}

(APPLY ? apply() : preview())
    .then(() => sequelize.close())
    .catch(async error => {
        console.error(error);
        await sequelize.close();
        process.exit(1);
    });
