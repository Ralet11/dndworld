const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GameAsset = sequelize.define('GameAsset', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    session_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    title: {
        type: DataTypes.STRING(160),
        allowNull: false,
    },
    url: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    type: {
        type: DataTypes.ENUM('IMAGE', 'MAP'),
        allowNull: false,
        defaultValue: 'IMAGE',
    },
    grid_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
}, {
    tableName: 'game_assets',
    timestamps: true,
    indexes: [{ fields: ['session_id', 'sort_order'] }],
});

module.exports = GameAsset;
