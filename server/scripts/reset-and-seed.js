require('dotenv').config();

const sequelize = require('../config/database');
const seedDatabase = require('../utils/seeder');

async function run() {
    const force = process.argv.includes('--force');

    if (!force) {
        console.error('Refusing to reset the database without --force.');
        process.exitCode = 1;
        return;
    }

    try {
        console.log('Resetting database schema with sync({ force: true })...');
        await sequelize.sync({ force: true });
        console.log('Database reset complete.');

        await seedDatabase();
        console.log('Seed complete.');
    } catch (error) {
        console.error('Reset and seed failed:', error);
        process.exitCode = 1;
    } finally {
        await sequelize.close();
    }
}

run();
