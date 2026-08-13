require('dotenv').config({ quiet: true });

const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Character } = require('../models');
const { buildActionCatalog } = require('../services/gameCombat');

const TARGET_NAMES = ['Infiltrador de Vorcan', 'Ejecutor de Vorcan I', 'Ejecutor de Vorcan II', 'Asesino Imperial de Fuego'];

function readiness(action) {
    const automatic = action.attackBonus != null || action.damage || action.healing || action.temporaryHp
        || (action.saveAbility && action.saveDc) || action.movement || action.shield
        || action.trackerCost || action.trackerRefill || action.clearWeaponJam
        || (action.effect && action.effect.type !== 'CUSTOM')
        || (action.reactionEffect && action.reactionEffect.type !== 'CUSTOM');
    return automatic ? 'automatic' : 'manual';
}

async function run() {
    await sequelize.authenticate();
    const characters = await Character.findAll({
        where: {
            [Op.or]: [
                { is_active: true, is_npc: false },
                { name: { [Op.in]: TARGET_NAMES } },
            ],
        },
        attributes: ['id', 'name', 'is_npc', 'is_active'],
        order: [['is_npc', 'ASC'], ['name', 'ASC']],
    });
    const report = [];
    for (const character of characters) {
        const catalog = await buildActionCatalog(character.id);
        const actions = (catalog?.actions || []).map(action => ({
            name: action.name,
            economy: action.economy,
            readiness: readiness(action),
            target: action.target,
            range: action.range,
            attack: action.attackBonus,
            damage: action.damage,
            extraDamage: action.extraDamage,
            save: action.saveAbility && action.saveDc ? `${action.saveAbility} CD ${action.saveDc}` : null,
            trigger: action.reactionTrigger,
            effect: action.reactionEffect?.type || action.effect?.type || null,
            resource: action.resource?.type || null,
        }));
        report.push({ character: character.name, party: !character.is_npc, actions });
    }
    const summary = {
        characters: report.length,
        actions: report.reduce((total, entry) => total + entry.actions.length, 0),
        automatic: report.reduce((total, entry) => total + entry.actions.filter(action => action.readiness === 'automatic').length, 0),
        manual: report.reduce((total, entry) => total + entry.actions.filter(action => action.readiness === 'manual').length, 0),
    };
    console.log(JSON.stringify({ summary, characters: report }, null, 2));
    await sequelize.close();
}

run().catch(async error => {
    console.error(error);
    await sequelize.close().catch(() => {});
    process.exitCode = 1;
});
