const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TimelineEvent = sequelize.define('TimelineEvent', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    type: {
        type: DataTypes.ENUM('SCENE', 'ACTION', 'SYSTEM', 'CHAT'),
        defaultValue: 'CHAT'
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    author_id: {
        type: DataTypes.INTEGER,
        allowNull: true // Null for system messages
    },
    scene_id: {
        type: DataTypes.INTEGER,
        allowNull: true // Global chat if null, or specific scene
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {}
        // Structure ideas:
        // {
        //   roll: { total: 18, result: "Success" },
        //   media: { type: "video", url: "..." },
        //   audio: { url: "...", loop: true }
        // }
    },
    is_public: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
});

module.exports = TimelineEvent;
