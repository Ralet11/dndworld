module.exports = (sequelize, DataTypes) => sequelize.define("CreatureAttribute", {
  creatureId: { type: DataTypes.UUID, primaryKey: true },
  str: { type: DataTypes.SMALLINT, defaultValue: 10 },
  dex: { type: DataTypes.SMALLINT, defaultValue: 10 },
  con: { type: DataTypes.SMALLINT, defaultValue: 10 },
  int: { type: DataTypes.SMALLINT, defaultValue: 10 },
  wis: { type: DataTypes.SMALLINT, defaultValue: 10 },
  cha: { type: DataTypes.SMALLINT, defaultValue: 10 }
}, { tableName:"creature_attributes", schema:"dwd", timestamps:false });
