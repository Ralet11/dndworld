const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./models');

async function listUsersAndChars() {
    try {
        const users = await db.User.findAll({
            include: [{ model: db.Character, as: 'characters' }] // Assuming relation exists
        });

        console.log('--- USERS & CHARACTERS ---');
        for (const u of users) {
            console.log(`User: ${u.username} (ID: ${u.id})`);
            if (u.characters && u.characters.length > 0) {
                u.characters.forEach(c => console.log(`  - Character: ${c.name} (ID: ${c.id})`));
            } else {
                // Try finding directly if alias not set
                const chars = await db.Character.findAll({ where: { UserId: u.id } });
                if (chars.length > 0) {
                    chars.forEach(c => console.log(`  - Character (direct query): ${c.name} (ID: ${c.id})`));
                } else {
                    console.log(`  - No characters assigned.`);
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        // process.exit(); 
    }
}

listUsersAndChars();
