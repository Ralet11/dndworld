require('dotenv').config();

const sequelize = require('../config/database');
const { Character } = require('../models');

const ENCOUNTER_IDS = [14, 26, 34, 35, 36, 37];

async function run() {
    await sequelize.authenticate();
    const [updated] = await Character.update(
        { is_active: false },
        { where: { id: ENCOUNTER_IDS, is_npc: true } },
    );
    const characters = await Character.findAll({
        where: { id: ENCOUNTER_IDS },
        attributes: ['id', 'name', 'is_npc', 'is_active'],
        order: [['id', 'ASC']],
    });
    console.log(JSON.stringify({ updated, characters }, null, 2));
    await sequelize.close();
}

run().catch(async error => {
    console.error(error.message);
    await sequelize.close().catch(() => {});
    process.exit(1);
});
