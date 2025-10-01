module.exports = (sequelize, DataTypes) => sequelize.define("Card", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  abilityId: { type: DataTypes.UUID, allowNull: false },
  source: { type: DataTypes.ENUM("CLASS","RACE","TALENT"), allowNull: false },
  classId: { type: DataTypes.UUID },
  raceId: { type: DataTypes.UUID },
  talentId: { type: DataTypes.UUID },
  levelRequired: { type: DataTypes.INTEGER, defaultValue: 1 },
  meta: { type: DataTypes.JSONB, defaultValue: {} }
}, { tableName:"cards", schema:"dwd", timestamps:true });
