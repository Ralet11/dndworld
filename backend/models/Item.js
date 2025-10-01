module.exports = (sequelize, DataTypes) => sequelize.define("Item", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  iconAssetId: { type: DataTypes.UUID },
  meta: { type: DataTypes.JSONB, defaultValue: {} }
}, { tableName:"items", schema:"dwd", timestamps:true });
