module.exports = (sequelize, DataTypes) => sequelize.define("Race", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  description: { type: DataTypes.TEXT },
  iconAssetId: { type: DataTypes.UUID }
}, { tableName:"races", schema:"dwd", timestamps:true });
