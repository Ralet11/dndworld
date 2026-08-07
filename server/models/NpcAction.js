const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NpcAction = sequelize.define('NpcAction', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    character_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    action_type: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: 'action',
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    attack_bonus: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    damage_dice: {
        type: DataTypes.STRING(32),
        allowNull: true,
    },
    damage_bonus: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    damage_type: {
        type: DataTypes.STRING(40),
        allowNull: true,
    },
    reach: {
        type: DataTypes.STRING(60),
        allowNull: true,
    },
    save_ability: {
        type: DataTypes.STRING(3),
        allowNull: true,
    },
    save_dc: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    recharge: {
        type: DataTypes.STRING(24),
        allowNull: true,
    },
    max_uses: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    used_uses: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    is_public: {
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
    tableName: 'npc_actions',
    timestamps: true,
    indexes: [{ fields: ['character_id'] }],
});

module.exports = NpcAction;
