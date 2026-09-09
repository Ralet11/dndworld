const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CampaignMember = sequelize.define('CampaignMember', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    campaign_id: { type: DataTypes.UUID, allowNull: false },
    user_id: { type: DataTypes.UUID, allowNull: false },
    role: { type: DataTypes.ENUM('DM', 'PLAYER'), allowNull: false, defaultValue: 'PLAYER' },
}, {
    tableName: 'campaign_members',
    timestamps: true,
    indexes: [{ unique: true, fields: ['campaign_id', 'user_id'] }, { fields: ['user_id', 'role'] }],
});

module.exports = CampaignMember;
