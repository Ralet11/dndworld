module.exports = (sequelize, DataTypes) => sequelize.define("MapToken", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  mapId: { type: DataTypes.UUID, allowNull: false },
  tokenType: { type: DataTypes.ENUM("PC","NPC","OBJECT"), allowNull: false },
  creatureId: { type: DataTypes.UUID },
  label: { type: DataTypes.STRING },
  x: { type: DataTypes.INTEGER, defaultValue: 0 },
  y: { type: DataTypes.INTEGER, defaultValue: 0 },
  meta: { type: DataTypes.JSONB, defaultValue: {} }
}, { tableName:"map_tokens", schema:"dwd", timestamps:true });
