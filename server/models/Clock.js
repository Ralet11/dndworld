const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Clock = sequelize.define('Clock', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    current_segments: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    max_segments: {
        type: DataTypes.INTEGER,
        defaultValue: 4 // e.g., 4, 6, 8, 12
    },
    is_visible: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    consequence: {
        type: DataTypes.STRING,
        allowNull: true
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
});

module.exports = Clock;
