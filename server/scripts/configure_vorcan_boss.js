require('dotenv').config({ quiet: true });

const { Op } = require('sequelize');
const sequelize = require('../config/database');
const {
    Campaign, Character, AbilityScore, Skill, NpcAction,
} = require('../models');

const APPLY = process.argv.includes('--apply');
const CAMPAIGN_NAME = 'Campaña actual';
const NAMES = ['Vorcan, Dama de los Asesinos', 'Vorcan', 'Vorkan'];

const DEFINITION = {
    fields: {
        name: 'Vorcan, Dama de los Asesinos',
        race: 'Humana',
        class: 'Dama de los Asesinos · Boss épico',
        alignment: 'Neutral maligna',
        level: 12,
        hp_current: 175,
        hp_max: 175,
        ac_base: 18,
        speed: 40,
        initiative_bonus: 10,
        size: 'Mediano',
        creature_type: 'Humanoide épico',
        challenge_rating: '12 (Boss)',
        proficiency_bonus: 4,
        passive_perception: 10,
        saving_throws: {},
        damage_resistances: [],
        damage_vulnerabilities: [],
        damage_immunities: [],
        condition_immunities: [],
        senses: [],
        languages: [],
        npc_type: 'enemigo',
        party_known: false,
        origin: 'Casa de la Viuda',
        notes: 'Boss épico de nivel 12. Rojo significa daño; negro, muerte; azul, acciones adicionales y protección. La debilidad del collar sólo debe revelarse visualmente cuando la máscara sea destruida.',
        abilities_text: 'Asesina épica de alta movilidad. Alterna daño rojo, ejecución negra y tres esferas azules que funcionan fuera de su turno. El collar se administra con el rastreador Esferas azules.',
        custom_features: [
            { name: 'Voluntad de la Dama', kind: 'Pasivo', description: 'Dos salvaciones fallidas pueden convertirse en éxito; administración manual del DM.', tracker: { key: 'voluntad-dama', label: 'Voluntad de la Dama', max: 2, value: 2, unit: 'usos' } },
            { name: 'Máscara', kind: 'Pasivo', description: 'CA 21; dos impactos dirigidos o un crítico la destruyen.', tracker: { key: 'mascara', label: 'Impactos restantes de máscara', max: 2, value: 2, unit: 'impactos' } },
            {
                name: 'Collar de las 3 Esferas',
                kind: 'Pasivo',
                description: 'Comienza cada ronda con 3 esferas. El DM puede ajustar este recurso desde la ficha de combate.',
                tracker: { key: 'collar-esferas', label: 'Esferas azules', max: 3, value: 3, unit: 'esferas' },
            },
            {
                name: 'Regla visual',
                kind: 'Pasivo',
                description: '🔴 Rojo = daño. ⚫ Negro = muerte. 🔵 Collar = acciones adicionales o protección.',
            },
        ],
    },
    // Valores neutrales hasta que el DM defina características y salvaciones.
    abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
    skills: {},
    actions: [
        {
            name: 'Ataque cuerpo a cuerpo rojo', action_type: 'acción', attack_bonus: 10,
            damage_dice: '2d6', damage_bonus: 6, damage_type: 'Mágico', reach: '5 pies, un objetivo',
            description: '🔴 Impacto: 2d6+6 de daño y 1d6 mágico adicional.', sort_order: 0,
        },
        {
            name: 'Ataque rojo a distancia', action_type: 'acción', attack_bonus: 9,
            damage_dice: '3d8', damage_bonus: 5, damage_type: 'Mágico', reach: '60 pies, un objetivo',
            description: '🔴 Ataque mágico a distancia.', sort_order: 1,
        },
        {
            name: 'Mano Negra — Marcar presa', action_type: 'bonus', reach: 'Una criatura que pueda ver',
            description: '⚫ Marca una presa. Si Vorcan llega cuerpo a cuerpo en su siguiente turno, puede intentar Mano Negra — Ejecución.', sort_order: 2,
        },
        {
            name: 'Mano Negra — Ejecución', action_type: 'acción', attack_bonus: 10, reach: '5 pies; presa marcada',
            description: '⚫ Si impacta contra la presa marcada, causa muerte instantánea. Use o falle, Mano Negra queda 1 turno completo recargando. No puede usarse mientras Vorcan esté ciega.', sort_order: 3,
        },
        {
            name: 'Collar — Defensa', action_type: 'rasgo',
            description: '🔵 Fuera de su turno, gasta 1 esfera para anular completamente un ataque o hechizo.', sort_order: 4,
        },
        {
            name: 'Collar — Movimiento', action_type: 'rasgo', reach: '20 pies',
            description: '🔵 Fuera de su turno, gasta 1 esfera para moverse 20 pies sin provocar ataques de oportunidad.', sort_order: 5,
        },
        {
            name: 'Mano Roja', action_type: 'acción', attack_bonus: 9,
            damage_dice: '2d8', damage_bonus: 5, damage_type: 'Mágico', reach: '60 pies, un objetivo',
            description: '🔵 Gasta 1 esfera. Puede realizarse fuera de su turno. Mientras Vorcan esté ciega, se hace con desventaja y no puede gastar esferas para atacar.', sort_order: 6,
        },
        {
            name: 'Agotamiento del Collar', action_type: 'rasgo',
            description: 'Si usa sólo 1–2 esferas, recupera las 3 al comenzar su siguiente turno. Si usa las 3, queda ciega durante su próximo turno. Mientras esté ciega: no puede ejecutar; Mano Roja tiene desventaja; los ataques contra ella tienen ventaja; y no puede gastar esferas para atacar. Al terminar ese turno recupera la visión.', sort_order: 7,
        },
        {
            name: 'Máscara', action_type: 'rasgo',
            description: 'CA 21. Se destruye con 2 impactos dirigidos o 1 crítico. Oculta que cada esfera obliga a Vorcan a cerrar progresivamente los ojos; sin máscara, la party puede descubrir visualmente la debilidad del collar.', sort_order: 8,
        },
        {
            name: 'Barrido Carmesí', action_type: 'acción', damage_dice: '4d8', damage_type: 'Mágico',
            reach: 'Radio de 10 pies centrado en Vorcan', save_ability: 'DEX', save_dc: 17, recharge: '5–6',
            description: '🔴 Criaturas a 10 pies realizan Destreza CD 17. Fallo: 4d8 mágico y empuje 10 pies. Éxito: mitad del daño.', sort_order: 9,
        },
        {
            name: 'Voluntad de la Dama', action_type: 'rasgo', max_uses: 2,
            description: '2 usos. Puede convertir en éxito una salvación fallida contra Aturdido, Paralizado, Incapacitado o Encantado.', sort_order: 10,
        },
    ],
};

function argumentValue(name) {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : null;
}

async function targetCampaign() {
    const campaignId = argumentValue('--campaign-id');
    const campaignName = argumentValue('--campaign-name') || CAMPAIGN_NAME;
    const campaign = campaignId
        ? await Campaign.findByPk(campaignId)
        : await Campaign.findOne({ where: { name: campaignName, is_archived: false }, order: [['createdAt', 'ASC']] });
    if (!campaign) throw new Error(`No se encontró la campaña objetivo: ${campaignId || campaignName}`);
    return campaign;
}

async function findExisting(campaign, transaction) {
    return Character.findOne({
        where: { campaign_id: campaign.id, is_npc: true, name: { [Op.in]: NAMES } },
        transaction,
    });
}

async function save(campaign, transaction) {
    let npc = await findExisting(campaign, transaction);
    const created = !npc;
    if (!npc) npc = await Character.create({ name: DEFINITION.fields.name, campaign_id: campaign.id, is_npc: true }, { transaction });
    const previous = npc.toJSON();
    await npc.update({
        ...DEFINITION.fields,
        campaign_id: campaign.id,
        is_npc: true,
        is_active: false,
        image_url: previous.image_url || null,
        base_body_url: previous.base_body_url || null,
        rendered_url: previous.rendered_url || null,
    }, { transaction });

    for (const [ability, baseValue] of Object.entries(DEFINITION.abilities)) {
        const [score] = await AbilityScore.findOrCreate({
            where: { character_id: npc.id, ability },
            defaults: { character_id: npc.id, ability, base_value: baseValue, bonus_value: 0 },
            transaction,
        });
        await score.update({ base_value: baseValue, bonus_value: 0 }, { transaction });
    }

    await Skill.destroy({ where: { character_id: npc.id }, transaction });
    for (const [name, proficiency_level] of Object.entries(DEFINITION.skills)) {
        await Skill.create({ character_id: npc.id, name, proficiency_level }, { transaction });
    }

    await NpcAction.destroy({ where: { character_id: npc.id }, transaction });
    for (const action of DEFINITION.actions) {
        await NpcAction.create({ ...action, character_id: npc.id, used_uses: 0, is_public: false }, { transaction });
    }
    return { id: npc.id, created, imagePreserved: Boolean(previous.image_url) };
}

async function preview() {
    const campaign = await targetCampaign();
    const existing = await findExisting(campaign);
    console.log(JSON.stringify({
        mode: 'dry-run',
        campaign: { id: campaign.id, name: campaign.name },
        operation: existing ? 'update' : 'create',
        existing: existing ? { id: existing.id, name: existing.name, hp: existing.hp_max, ac: existing.ac_base, image_url: existing.image_url } : null,
        after: {
            name: DEFINITION.fields.name, level: DEFINITION.fields.level, type: DEFINITION.fields.creature_type,
            hp: DEFINITION.fields.hp_max, ac: DEFINITION.fields.ac_base, speed: DEFINITION.fields.speed,
            initiative: DEFINITION.fields.initiative_bonus, actions: DEFINITION.actions.map(action => `${action.action_type}: ${action.name}`),
        },
    }, null, 2));
}

async function apply() {
    const campaign = await targetCampaign();
    let saved;
    await sequelize.transaction(async transaction => { saved = await save(campaign, transaction); });
    console.log(JSON.stringify({
        mode: 'applied', campaign: { id: campaign.id, name: campaign.name },
        npc: { ...saved, name: DEFINITION.fields.name, hp: DEFINITION.fields.hp_max, ac: DEFINITION.fields.ac_base, actions: DEFINITION.actions.length },
    }, null, 2));
}

async function verify() {
    const campaign = await targetCampaign();
    const npc = await findExisting(campaign);
    if (!npc) throw new Error('Vorcan no existe en la campaña objetivo.');
    const { buildActionCatalog } = require('../services/gameCombat');
    const catalog = await buildActionCatalog(npc.id);
    const actions = await NpcAction.findAll({ where: { character_id: npc.id }, order: [['sort_order', 'ASC']] });
    if (actions.length !== DEFINITION.actions.length || npc.hp_max !== 175 || npc.ac_base !== 18) throw new Error('La ficha no coincide con la configuración esperada.');
    console.log(JSON.stringify({ mode: 'verified', id: npc.id, name: npc.name, campaign: campaign.name, hp: npc.hp_max, ac: npc.ac_base, level: npc.level, speed: npc.speed, initiative: npc.initiative_bonus, actions: actions.length, executable: catalog.actions.map(action => ({ name: action.name, damage: action.damage, extraDamage: action.extraDamage, area: action.area })), imagePresent: Boolean(npc.image_url) }, null, 2));
}

(process.argv.includes('--verify') ? verify() : APPLY ? apply() : preview())
    .then(() => sequelize.close())
    .catch(async error => {
        console.error(error);
        await sequelize.close();
        process.exit(1);
    });
