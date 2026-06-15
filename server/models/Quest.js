const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Quest = sequelize.define('Quest', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM('Comun', 'Epica', 'Personal', 'Cadena'),
        defaultValue: 'Comun'
    },
    level: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    status: {
        type: DataTypes.ENUM('En Progreso', 'Completada', 'Bloqueada', 'Fallida'),
        defaultValue: 'En Progreso'
    },
    npc_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    description: {
        type: DataTypes.TEXT
    },
    objectives: {
        type: DataTypes.JSONB,
        defaultValue: [] // Array of { id: 1, text: "Kill rat", completed: false }
    },
    rewards: {
        type: DataTypes.JSONB,
        defaultValue: {}
    }
});

module.exports = Quest;
