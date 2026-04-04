const axios = require('axios');
const { Sequelize } = require('sequelize');
const Spell = require('../models/Spell');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Setup simple sequelize connection if not reusing existing one from app
// We need to ensure the model allows us to sync
const sequelize = require('../config/database');

const seedSpells = async () => {
    try {
        console.log('--- DEBUG INFO ---');
        console.log('DB_USER:', process.env.DB_USER);
        console.log('DB_PASS:', process.env.DB_PASS ? '******' : '(not set)');
        console.log('DB_NAME:', process.env.DB_NAME);
        console.log('DB_HOST:', process.env.DB_HOST);
        console.log('------------------');

        await sequelize.authenticate();
        console.log('Database connected.');

        // Sync model to create table if not exists
        await Spell.sync({ force: true }); // WARNING: This drops the table first!
        console.log('Spells table synced.');

        console.log('Fetching spells from Open5e...');
        const response = await axios.get('https://api.open5e.com/spells/?limit=2000');

        if (!response.data || !response.data.results) {
            throw new Error('Invalid API response');
        }

        const spellsIn = response.data.results;
        console.log(`Fetched ${spellsIn.length} spells.`);

        console.log('Inserting spells...');

        // Transform data map
        const spellsData = spellsIn.map(s => ({
            slug: s.slug,
            name: s.name,
            desc: s.desc,
            higher_level: s.higher_level,
            page: s.page,
            range: s.range,
            components: s.components,
            material: s.material,
            ritual: s.ritual === 'yes',
            duration: s.duration,
            concentration: s.concentration === 'yes',
            casting_time: s.casting_time,
            level: s.level_int,
            school: s.school,
            dnd_class: s.dnd_class,
            spell_lists: s.spell_lists,
            archetype: s.archetype,
            circles: s.circles,
            document__slug: s.document__slug,
            document__title: s.document__title
        }));

        // Bulk Create is much faster
        await Spell.bulkCreate(spellsData);

        console.log(`Successfully inserted ${spellsData.length} spells.`);
        process.exit(0);

    } catch (error) {
        console.error('Error seeding spells:', error);
        process.exit(1);
    }
};

seedSpells();
