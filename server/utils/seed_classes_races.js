const axios = require('axios');
const { Sequelize } = require('sequelize');
const Class = require('../models/Class');
const Race = require('../models/Race');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const sequelize = require('../config/database');

const seedClassesAndRaces = async () => {
    try {
        console.log('--- DEBUG INFO ---');
        console.log('DB_USER:', process.env.DB_USER);
        console.log('DB_NAME:', process.env.DB_NAME);
        console.log('------------------');

        await sequelize.authenticate();
        console.log('Database connected.');

        // Sync models
        await Class.sync({ force: true });
        await Race.sync({ force: true });
        console.log('Classes and Races tables synced.');

        // --- CLASSES ---
        console.log('Fetching Classes from Open5e...');
        const classResponse = await axios.get('https://api.open5e.com/v1/classes/?limit=100');
        const classesIn = classResponse.data.results;
        console.log(`Fetched ${classesIn.length} classes.`);

        const classesData = classesIn.map(c => ({
            slug: c.slug,
            name: c.name,
            hit_dice: c.hit_dice,
            hp_at_1st_level: c.hp_at_1st_level,
            hp_at_higher_levels: c.hp_at_higher_levels,
            prof_armor: c.prof_armor,
            prof_weapons: c.prof_weapons,
            prof_tools: c.prof_tools,
            prof_saving_throws: c.prof_saving_throws,
            prof_skills: c.prof_skills,
            equipment: c.equipment, // JSON string usually
            table: c.table,
            spellcasting_ability: c.spellcasting_ability,
            subtypes_name: c.subtypes_name,
            archetypes: JSON.stringify(c.archetypes), // Store as stringified JSON
            desc: c.desc
        }));

        await Class.bulkCreate(classesData);
        console.log(`Inserted ${classesData.length} classes.`);


        // --- RACES ---
        console.log('Fetching Races from Open5e...');
        const raceResponse = await axios.get('https://api.open5e.com/v1/races/?limit=100');
        const racesIn = raceResponse.data.results;
        console.log(`Fetched ${racesIn.length} races.`);

        const racesData = racesIn.map(r => ({
            slug: r.slug,
            name: r.name,
            desc: r.desc,
            speed: r.speed.walk || r.speed, // sometimes object, sometimes int? Open5e usually has 'speed' object with 'walk'
            ability_bonuses: r.asi_desc, // Use description or parse 'asi' array if available
            alignment: r.alignment,
            age: r.age,
            size: r.size,
            size_desc: r.size_desc,
            languages: r.languages,
            vision: r.vision,
            traits: r.traits,
            subraces: JSON.stringify(r.subraces)
        }));

        // Handle speed carefully if it's an object in API
        // Open5e Race object 'speed' is often: { "walk": 30 }
        // Our model expects INTEGER.
        racesData.forEach(r => {
            if (typeof r.speed === 'object' && r.speed !== null) {
                r.speed = r.speed.walk || 30;
            }
        });

        await Race.bulkCreate(racesData);
        console.log(`Inserted ${racesData.length} races.`);

        process.exit(0);

    } catch (error) {
        console.error('Error seeding classes/races:', error);
        process.exit(1);
    }
};

seedClassesAndRaces();
