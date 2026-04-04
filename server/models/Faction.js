const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Faction = sequelize.define('Faction', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    influence: {
        type: DataTypes.INTEGER,
        defaultValue: 0 // 0 to 100
    },
    status: {
        type: DataTypes.ENUM('ALLIED', 'NEUTRAL', 'HOSTILE'),
        defaultValue: 'NEUTRAL'
    },
    color_hex: {
        type: DataTypes.STRING,
        defaultValue: '#808080'
    },
    logo_url: {
        type: DataTypes.STRING,
        allowNull: true
    }
});

module.exports = Faction;
