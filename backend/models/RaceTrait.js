module.exports = (sequelize, DataTypes) => sequelize.define("RaceTrait", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  raceId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT }
}, { tableName:"race_traits", schema:"dwd", timestamps:true });
