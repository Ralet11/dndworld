const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Campaign = sequelize.define('Campaign', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    owner_user_id: { type: DataTypes.UUID, allowNull: false },
    is_archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
    tableName: 'campaigns',
    timestamps: true,
    indexes: [{ fields: ['owner_user_id', 'is_archived'] }],
});

module.exports = Campaign;
