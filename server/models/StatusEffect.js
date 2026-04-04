const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StatusEffect = sequelize.define('StatusEffect', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM('Positivo', 'Negativo'),
        defaultValue: 'Positivo'
    },
    description: {
        type: DataTypes.TEXT
    },
    icon_url: {
        type: DataTypes.STRING
    },
    stat_changes: {
        type: DataTypes.JSONB,
        defaultValue: {}
    }
});

module.exports = StatusEffect;
