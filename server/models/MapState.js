const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MapState = sequelize.define('MapState', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        defaultValue: 1 // Single record for now
    },
    party_x: {
        type: DataTypes.FLOAT,
        defaultValue: 50
    },
    party_y: {
        type: DataTypes.FLOAT,
        defaultValue: 50
    },
    global_time: {
        type: DataTypes.STRING,
        defaultValue: '12:00'
    },
    global_location: {
        type: DataTypes.STRING,
        defaultValue: 'El mundo exterior'
    },
    day_period: {
        type: DataTypes.STRING(20),
        defaultValue: 'Día'
    },
    temperature_c: {
        type: DataTypes.INTEGER,
        defaultValue: 24
    }
}, {
    timestamps: false
});

module.exports = MapState;
