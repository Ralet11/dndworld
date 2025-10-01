module.exports = (sequelize, DataTypes) => sequelize.define("Session", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  campaignId: { type: DataTypes.UUID, allowNull: false },
  scenarioId: { type: DataTypes.UUID },
  activeLayerId: { type: DataTypes.UUID },
  activeMapId: { type: DataTypes.UUID },
  startedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  endedAt: { type: DataTypes.DATE }
}, { tableName:"sessions", schema:"dwd", timestamps:false });
