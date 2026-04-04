const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Character = sequelize.define('Character', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // Foreign Keys for structured data
    race_slug: {
        type: DataTypes.STRING,
        allowNull: true
    },
    class_slug: {
        type: DataTypes.STRING,
        allowNull: true
    },
    archetype_slug: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Legacy / Display fields
    race: {
        type: DataTypes.STRING,
        defaultValue: 'Humano'
    },
    subrace: {
        type: DataTypes.STRING
    },
    class: {
        type: DataTypes.STRING,
        defaultValue: 'Guerrero'
    },
    background: {
        type: DataTypes.STRING
    },
    alignment: {
        type: DataTypes.STRING,
        defaultValue: 'Neutral'
    },
    level: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    xp: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    hp_current: {
        type: DataTypes.INTEGER,
        defaultValue: 10
    },
    hp_max: {
        type: DataTypes.INTEGER,
        defaultValue: 10
    },
    hp_temp: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    ac_base: {
        type: DataTypes.INTEGER,
        defaultValue: 10
    },
    initiative_bonus: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    speed: {
        type: DataTypes.INTEGER,
        defaultValue: 30
    },
    inspiration: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_npc: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    notes: {
        type: DataTypes.TEXT
    },
    abilities_text: {
        type: DataTypes.TEXT,
        defaultValue: ''
    },
    owner_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    image_url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    image_scale: {
        type: DataTypes.FLOAT,
        defaultValue: 1.0
    },
    image_offset_x: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    image_offset_y: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    // Magic System
    spell_slots: {
        type: DataTypes.JSON, // { 1: { max: 4, used: 0 }, 2: { max: 3, used: 1 } }
        defaultValue: {}
    },
    spells_known: {
        type: DataTypes.JSON, // ['magic-missile', 'fireball'] - List of slugs
        defaultValue: []
    },
    spells_prepared: {
        type: DataTypes.JSON, // ['mage-armor'] - List of slugs (Subset of known or from class list)
        defaultValue: []
    }
});

module.exports = Character;
