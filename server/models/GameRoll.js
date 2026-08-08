const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GameRoll = sequelize.define('GameRoll', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    session_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    character_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    roller_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    character_name: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    character_image: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    label: {
        type: DataTypes.STRING(120),
        allowNull: false,
        defaultValue: 'Tirada',
    },
    sides: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },
    modifier: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    theme_color: {
        type: DataTypes.STRING(7),
        allowNull: false,
        defaultValue: '#c89b43',
    },
    results: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
    },
    total: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    resolved: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
    dismissed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
}, {
    tableName: 'game_rolls',
    timestamps: true,
    indexes: [
        { fields: ['session_id', 'dismissed', 'created_at'] },
        { fields: ['user_id'] },
    ],
});

module.exports = GameRoll;
