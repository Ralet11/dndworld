module.exports = (sequelize, DataTypes) => sequelize.define("Npc", {
  id: { type: DataTypes.UUID, primaryKey: true },
  tier: { type: DataTypes.ENUM("COMMON","RARE","ELITE","LEGENDARY"), defaultValue:"COMMON" },
  behaviorNotes: { type: DataTypes.TEXT },
  campaignId: { type: DataTypes.UUID }
}, { tableName:"npcs", schema:"dwd", timestamps:true });
