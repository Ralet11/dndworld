require('dotenv').config();

const sequelize = require('../config/database');
const seedDatabase = require('../utils/seeder');

async function run() {
    try {
        await sequelize.sync({ alter: true });
        console.log('Database connected and synced.');
        await seedDatabase();
    } catch (error) {
        console.error('Seed failed:', error);
        process.exitCode = 1;
    } finally {
        await sequelize.close();
    }
}

run();
