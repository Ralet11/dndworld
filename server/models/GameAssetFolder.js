const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GameAssetFolder = sequelize.define('GameAssetFolder', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    owner_user_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    parent_id: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    name: {
        type: DataTypes.STRING(120),
        allowNull: false,
    },
    sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
}, {
    tableName: 'game_asset_folders',
    timestamps: true,
    indexes: [
        { fields: ['owner_user_id', 'parent_id', 'sort_order'] },
        { fields: ['owner_user_id', 'name'] },
    ],
});

module.exports = GameAssetFolder;
