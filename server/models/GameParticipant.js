const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GameParticipant = sequelize.define('GameParticipant', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    session_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    character_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    is_ready: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
}, {
    tableName: 'game_participants',
    timestamps: true,
    indexes: [{ unique: true, fields: ['session_id', 'user_id'] }],
});

module.exports = GameParticipant;
