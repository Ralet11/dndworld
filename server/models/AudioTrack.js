const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AudioTrack = sequelize.define('AudioTrack', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(160), allowNull: false },
    category: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'Ambiente' },
    url: { type: DataTypes.TEXT, allowNull: false },
    storage_key: { type: DataTypes.TEXT, allowNull: false },
    mime_type: { type: DataTypes.STRING(100), allowNull: false },
    size_bytes: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    uploaded_by: { type: DataTypes.UUID, allowNull: true },
}, { tableName: 'audio_tracks', timestamps: true, indexes: [{ fields: ['name'] }, { fields: ['category'] }] });

module.exports = AudioTrack;
