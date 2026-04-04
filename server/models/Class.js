const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Class = sequelize.define('Class', {
    slug: {
        type: DataTypes.STRING,
        primaryKey: true,
        unique: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    hit_dice: {
        type: DataTypes.STRING, // e.g., "1d8"
        allowNull: false
    },
    hp_at_1st_level: {
        type: DataTypes.STRING
    },
    hp_at_higher_levels: {
        type: DataTypes.TEXT
    },
    prof_armor: {
        type: DataTypes.TEXT
    },
    prof_weapons: {
        type: DataTypes.TEXT
    },
    prof_tools: {
        type: DataTypes.TEXT
    },
    prof_saving_throws: {
        type: DataTypes.TEXT
    },
    prof_skills: {
        type: DataTypes.TEXT // Description of choice
    },
    equipment: {
        type: DataTypes.TEXT // JSON string or text description
    },
    table: {
        type: DataTypes.TEXT // JSON string of the level table
    },
    spellcasting_ability: {
        type: DataTypes.STRING
    },
    subtypes_name: {
        type: DataTypes.STRING // e.g., "Archetype", "Domain"
    },
    archetypes: {
        type: DataTypes.TEXT // JSON string of archetypes
    },
    desc: {
        type: DataTypes.TEXT
    }
}, {
    tableName: 'classes',
    timestamps: true
});

module.exports = Class;
