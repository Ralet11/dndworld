module.exports = (sequelize, DataTypes) => sequelize.define("ClassAbility", {
  classId: { type: DataTypes.UUID, primaryKey: true },
  abilityId: { type: DataTypes.UUID, primaryKey: true },
  levelAvailable: { type: DataTypes.INTEGER, defaultValue: 1 }
}, { tableName:"class_abilities", schema:"dwd", timestamps:false });
