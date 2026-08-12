const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AssistantConversation = sequelize.define('AssistantConversation', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(120), allowNull: false, defaultValue: 'Nueva conversación' },
    scene_id: { type: DataTypes.INTEGER, allowNull: true },
}, {
    tableName: 'assistant_conversations',
    indexes: [{ fields: ['user_id', 'updated_at'] }],
});

module.exports = AssistantConversation;
