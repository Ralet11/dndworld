module.exports = (sequelize, DataTypes) => sequelize.define("ScenarioLayer", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  scenarioId: { type: DataTypes.UUID, allowNull: false },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
  layerType: { type: DataTypes.ENUM("IMAGE","TACTICAL"), allowNull: false },
  imageAssetId: { type: DataTypes.UUID },
  audioAssetId: { type: DataTypes.UUID },
  notes: { type: DataTypes.TEXT }
}, { tableName:"scenario_layers", schema:"dwd", timestamps:true });
