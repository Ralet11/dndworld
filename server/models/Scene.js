const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Scene = sequelize.define('Scene', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    imageUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('ACTIVE', 'FINISHED', 'ARCHIVED'),
        defaultValue: 'ACTIVE'
    },
    location: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'scenes',
    timestamps: true
});

module.exports = Scene;
