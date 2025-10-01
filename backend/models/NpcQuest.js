module.exports = (sequelize, DataTypes) => sequelize.define("NpcQuest", {
  npcId: { type: DataTypes.UUID, primaryKey: true },
  questId: { type: DataTypes.UUID, primaryKey: true }
}, { tableName:"npc_quests", schema:"dwd", timestamps:false });
