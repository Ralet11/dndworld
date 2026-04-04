const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AbilityScore = sequelize.define('AbilityScore', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    character_id: {
        type: DataTypes.INTEGER,
        primaryKey: true
    },
    ability: {
        type: DataTypes.ENUM('STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'),
        allowNull: false
    },
    base_value: {
        type: DataTypes.INTEGER,
        defaultValue: 10
    },
    bonus_value: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    timestamps: false
});

module.exports = AbilityScore;
