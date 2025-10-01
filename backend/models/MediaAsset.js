module.exports = (sequelize, DataTypes) => sequelize.define("MediaAsset", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  kind: { type: DataTypes.STRING, allowNull: false },
  url: { type: DataTypes.TEXT, allowNull: false },
  meta: { type: DataTypes.JSONB, defaultValue: {} }
}, { tableName:"media_assets", schema:"dwd", timestamps:true, createdAt:"createdAt", updatedAt:false });
