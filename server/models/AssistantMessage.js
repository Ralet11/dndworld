const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AssistantMessage = sequelize.define('AssistantMessage', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    conversation_id: { type: DataTypes.INTEGER, allowNull: false },
    role: { type: DataTypes.STRING(16), allowNull: false },
    kind: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'help' },
    text: { type: DataTypes.TEXT, allowNull: false },
    tool: { type: DataTypes.STRING(80), allowNull: true },
    suggestions: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    undo_available: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
    tableName: 'assistant_messages',
    indexes: [{ fields: ['conversation_id', 'created_at'] }],
});

module.exports = AssistantMessage;
