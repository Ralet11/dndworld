const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CharacterAuditLog = sequelize.define('CharacterAuditLog', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    character_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    actor_user_id: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    actor_username: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Sistema',
    },
    actor_role: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'SYSTEM',
    },
    source: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: 'character-editor',
    },
    changes: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
    },
}, {
    updatedAt: false,
    indexes: [
        { fields: ['character_id', 'created_at'] },
        { fields: ['actor_user_id'] },
    ],
});

module.exports = CharacterAuditLog;
