module.exports = (sequelize, DataTypes) => sequelize.define("Scenario", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  campaignId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  shortDescription: { type: DataTypes.TEXT }
}, { tableName:"scenarios", schema:"dwd", timestamps:true });
