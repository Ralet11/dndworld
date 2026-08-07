const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GameToken = sequelize.define('GameToken', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    session_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    character_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    owner_user_id: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    label: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    image_url: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    color: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: '#C8A36A',
    },
    x: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 50,
    },
    y: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 50,
    },
    size: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 1,
    },
    locked: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    visible: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
    conditions: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
    },
}, {
    tableName: 'game_tokens',
    timestamps: true,
    indexes: [{ fields: ['session_id'] }],
});

module.exports = GameToken;
