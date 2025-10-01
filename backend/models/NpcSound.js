module.exports = (sequelize, DataTypes) => sequelize.define("NpcSound", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  npcId: { type: DataTypes.UUID, allowNull: false },
  assetId: { type: DataTypes.UUID, allowNull: false },
  caption: { type: DataTypes.TEXT }
}, { tableName:"npc_sounds", schema:"dwd", timestamps:true });
