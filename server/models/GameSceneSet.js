const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GameSceneSet = sequelize.define('GameSceneSet', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    session_id: { type: DataTypes.UUID, allowNull: false },
    owner_user_id: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(120), allowNull: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
    tableName: 'game_scene_sets',
    timestamps: true,
    indexes: [
        { fields: ['session_id', 'sort_order'] },
        { fields: ['owner_user_id', 'session_id'] },
    ],
});

module.exports = GameSceneSet;
