const { Character } = require('./models');
const sequelize = require('./config/database');

async function debugCharacters() {
    try {
        await sequelize.authenticate();
        console.log('DB Connected.');
        const chars = await Character.findAll({
            attributes: ['id', 'name', 'is_npc']
        });
        console.log('--- CHARACTERS IN DB ---');
        console.table(chars.map(c => c.toJSON()));
        console.log('------------------------');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

debugCharacters();
