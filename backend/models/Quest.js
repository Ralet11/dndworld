module.exports = (sequelize, DataTypes) => sequelize.define("Quest", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  recommendedLevel: { type: DataTypes.INTEGER },
  createdBy: { type: DataTypes.UUID }
}, { tableName:"quests", schema:"dwd", timestamps:true });
