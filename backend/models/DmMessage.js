module.exports = (sequelize, DataTypes) => sequelize.define('DmMessage', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  sessionId: { type: DataTypes.UUID, allowNull: false, unique: true },
  text: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' }
}, { tableName: 'dm_messages', schema: 'dwd', timestamps: true });
