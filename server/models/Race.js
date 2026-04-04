const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Race = sequelize.define('Race', {
    slug: {
        type: DataTypes.STRING,
        primaryKey: true,
        unique: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    desc: {
        type: DataTypes.TEXT
    },
    speed: {
        type: DataTypes.INTEGER,
        defaultValue: 30
    },
    ability_bonuses: {
        type: DataTypes.TEXT // Described text
    },
    alignment: {
        type: DataTypes.TEXT
    },
    age: {
        type: DataTypes.TEXT
    },
    size: {
        type: DataTypes.TEXT // Can be descriptive
    },
    size_desc: {
        type: DataTypes.TEXT
    },
    languages: {
        type: DataTypes.TEXT
    },
    vision: {
        type: DataTypes.TEXT
    },
    traits: {
        type: DataTypes.TEXT // JSON string of traits
    },
    subraces: {
        type: DataTypes.TEXT // JSON string of subraces
    }
}, {
    tableName: 'races',
    timestamps: true
});

module.exports = Race;
