module.exports = (sequelize, DataTypes) => sequelize.define("QuestStep", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  questId: { type: DataTypes.UUID, allowNull: false },
  stepOrder: { type: DataTypes.INTEGER, defaultValue: 1 },
  text: { type: DataTypes.TEXT, allowNull: false }
}, { tableName:"quest_steps", schema:"dwd", timestamps:true });
