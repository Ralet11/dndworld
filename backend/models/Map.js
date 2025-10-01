module.exports = (sequelize, DataTypes) => sequelize.define("Map", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  layerId: { type: DataTypes.UUID, allowNull: false },
  gridSize: { type: DataTypes.INTEGER, defaultValue: 50 },
  widthCells: { type: DataTypes.INTEGER, defaultValue: 30 },
  heightCells: { type: DataTypes.INTEGER, defaultValue: 20 },
  backgroundAssetId: { type: DataTypes.UUID }
}, { tableName:"maps", schema:"dwd", timestamps:true });
