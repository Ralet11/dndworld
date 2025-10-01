module.exports = (sequelize, DataTypes) => sequelize.define("CreatureResource", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  creatureId: { type: DataTypes.UUID, allowNull: false },
  resource: { type: DataTypes.ENUM("MANA","ENERGY","SPIRIT","SOUL","FOCUS","RAGE"), allowNull: false },
  current: { type: DataTypes.INTEGER, defaultValue: 0 },
  max: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { tableName:"creature_resources", schema:"dwd", timestamps:true });
