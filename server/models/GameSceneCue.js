const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GameSceneCue = sequelize.define('GameSceneCue', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    set_id: { type: DataTypes.UUID, allowNull: false },
    asset_id: { type: DataTypes.UUID, allowNull: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_default: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    presentation_mode: { type: DataTypes.ENUM('NARRATIVE', 'COMBAT'), allowNull: false, defaultValue: 'NARRATIVE' },
}, {
    tableName: 'game_scene_cues',
    timestamps: true,
    indexes: [{ fields: ['set_id', 'sort_order'] }, { fields: ['asset_id'] }],
});

module.exports = GameSceneCue;
