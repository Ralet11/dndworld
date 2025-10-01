module.exports = (sequelize, DataTypes) => sequelize.define("RaceAbility", {
  raceId: { type: DataTypes.UUID, primaryKey: true },
  abilityId: { type: DataTypes.UUID, primaryKey: true }
}, { tableName:"race_abilities", schema:"dwd", timestamps:false });
