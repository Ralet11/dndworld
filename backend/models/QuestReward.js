module.exports = (sequelize, DataTypes) => sequelize.define("QuestReward", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  questId: { type: DataTypes.UUID, allowNull: false },
  rewardType: { type: DataTypes.STRING, allowNull: false },
  payload: { type: DataTypes.JSONB, defaultValue: {} }
}, { tableName:"quest_rewards", schema:"dwd", timestamps:true });
