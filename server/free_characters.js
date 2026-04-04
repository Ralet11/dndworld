const { Character } = require('./models');
const sequelize = require('./config/database');

async function free() {
    try {
        await sequelize.authenticate();
        console.log('Connection established.');

        // Unassign all characters except maybe the DM if they had one (statEngine logic)
        // Actually, just unassign all player characters (not NPCs)
        const [updatedCount] = await Character.update(
            { UserId: null },
            { where: { is_npc: false } }
        );

        console.log(`Success: ${updatedCount} characters have been released.`);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

free();
