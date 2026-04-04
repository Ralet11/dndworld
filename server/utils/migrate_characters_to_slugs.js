const { Sequelize } = require('sequelize');
const { Character } = require('../models');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const sequelize = require('../config/database');

const CLASS_MAP = {
    'Guerrero': 'fighter',
    'Mago': 'wizard',
    'Clérigo': 'cleric',
    'Pícaro': 'rogue',
    'Bardo': 'bard',
    'Paladín': 'paladin',
    'Explorador': 'ranger',
    'Hechicero': 'sorcerer',
    'Druida': 'druid',
    'Bárbaro': 'barbarian',
    'Monje': 'monk',
    'Brujo': 'warlock'
};

const RACE_MAP = {
    'Humano': 'human',
    'Elfo': 'elf',
    'Enano': 'dwarf',
    'Mediano': 'halfling',
    'Gnomo': 'gnome',
    'Dracónido': 'dragonborn',
    'Tiefling': 'tiefling',
    'Semiorco': 'half-orc',
    'Semielfo': 'half-elf'
};

const migrate = async () => {
    try {
        await sequelize.authenticate();
        console.log('DB Connected.');

        const characters = await Character.findAll();
        let updates = 0;

        for (const char of characters) {
            let changed = false;

            // Map Class
            if (!char.class_slug && CLASS_MAP[char.class]) {
                char.class_slug = CLASS_MAP[char.class];
                changed = true;
                console.log(`Mapped '${char.class}' -> '${char.class_slug}' for ${char.name}`);
            } else if (!char.class_slug) {
                // Try lowercase match
                const lower = char.class.toLowerCase();
                const found = Object.values(CLASS_MAP).find(v => v === lower);
                if (found) {
                    char.class_slug = found;
                    changed = true;
                    console.log(`Mapped '${char.class}' -> '${char.class_slug}' (direct) for ${char.name}`);
                }
            }

            // Map Race
            if (!char.race_slug && RACE_MAP[char.race]) {
                char.race_slug = RACE_MAP[char.race];
                changed = true;
                console.log(`Mapped '${char.race}' -> '${char.race_slug}' for ${char.name}`);
            } else if (!char.race_slug) {
                // Try lowercase match
                const lower = char.race.toLowerCase();
                const found = Object.values(RACE_MAP).find(v => v === lower);
                if (found) {
                    char.race_slug = found;
                    changed = true;
                    console.log(`Mapped '${char.race}' -> '${char.race_slug}' (direct) for ${char.name}`);
                }
            }

            if (changed) {
                await char.save();
                updates++;
            }
        }

        console.log(`Migration complete. Updated ${updates} characters.`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

migrate();
