const { Character } = require('./models');
const sequelize = require('./config/database');

async function check() {
    try {
        await sequelize.authenticate();
        console.log('Connection established.');
        const characters = await Character.findAll({
            where: { is_npc: false },
            attributes: ['id', 'name', 'UserId']
        });
        console.log('Player Characters Ownership:', JSON.stringify(characters, null, 2));
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

check();
