const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GameSession = sequelize.define('GameSession', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    code: {
        type: DataTypes.STRING(8),
        allowNull: false,
        unique: true,
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Partida de DnD World',
    },
    status: {
        type: DataTypes.ENUM('WAITING', 'LIVE', 'PAUSED', 'FINISHED'),
        allowNull: false,
        defaultValue: 'WAITING',
    },
    round: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },
    turn_order: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
    },
    turn_index: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    shared_type: {
        type: DataTypes.ENUM('NONE', 'IMAGE', 'MAP'),
        allowNull: false,
        defaultValue: 'NONE',
    },
    shared_url: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    shared_title: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    grid_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    grid_color: {
        type: DataTypes.STRING(7),
        allowNull: false,
        defaultValue: '#d8cdb1',
    },
    grid_line_width: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 1,
    },
    narrative_fit: {
        type: DataTypes.STRING(12),
        allowNull: false,
        defaultValue: 'COVER',
    },
    narrative_layout: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },
    narrative_panels: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
    },
    stage_annotations: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
    },
    stage_vfx: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
    },
    map_fit: {
        type: DataTypes.STRING(12),
        allowNull: false,
        defaultValue: 'COVER',
    },
    scene_npc_ids: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
    },
    speaking_npc_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    audio_track_id: {
        type: DataTypes.UUID,
        allowNull: true,
    },
    audio_status: {
        type: DataTypes.STRING(12),
        allowNull: false,
        defaultValue: 'STOPPED',
    },
    audio_position_seconds: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
    },
    combat_state: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
    },
    audio_started_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    audio_loop: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
    dm_user_id: {
        type: DataTypes.UUID,
        allowNull: false,
    },
}, {
    tableName: 'game_sessions',
    timestamps: true,
    indexes: [{ fields: ['dm_user_id', 'status'] }],
});

module.exports = GameSession;
