const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GameCombatAction = sequelize.define('GameCombatAction', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    session_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    actor_user_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    actor_character_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    action_key: {
        type: DataTypes.STRING(160),
        allowNull: false,
    },
    action_name: {
        type: DataTypes.STRING(160),
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: 'PENDING',
    },
    action_snapshot: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
    },
    target_token_ids: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
    },
    area: {
        type: DataTypes.JSONB,
        allowNull: true,
    },
    before_state: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
    },
    result: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
    },
    attack_roll_id: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    effect_roll_id: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    undone_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName: 'game_combat_actions',
    timestamps: true,
    indexes: [
        { fields: ['session_id', 'created_at'] },
        { fields: ['attack_roll_id'] },
        { fields: ['effect_roll_id'] },
    ],
});

module.exports = GameCombatAction;
