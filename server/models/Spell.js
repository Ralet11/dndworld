const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Adjust path to your sequelize instance

const Spell = sequelize.define('Spell', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    slug: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    desc: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    higher_level: {
        type: DataTypes.TEXT
    },
    page: {
        type: DataTypes.STRING
    },
    range: {
        type: DataTypes.STRING,
        allowNull: false
    },
    components: {
        type: DataTypes.STRING,
        allowNull: false
    },
    material: {
        type: DataTypes.TEXT
    },
    ritual: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    duration: {
        type: DataTypes.STRING,
        allowNull: false
    },
    concentration: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    casting_time: {
        type: DataTypes.STRING,
        allowNull: false
    },
    level: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    school: {
        type: DataTypes.STRING,
        allowNull: false
    },
    dnd_class: {
        type: DataTypes.STRING
    },
    spell_lists: {
        type: DataTypes.ARRAY(DataTypes.STRING) // Requires PostgreSQL
    },
    archetype: {
        type: DataTypes.STRING
    },
    circles: {
        type: DataTypes.STRING
    },
    document__slug: {
        type: DataTypes.STRING
    },
    document__title: {
        type: DataTypes.STRING
    }
}, {
    tableName: 'spells',
    timestamps: true
});

module.exports = Spell;
