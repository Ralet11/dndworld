module.exports = (sequelize, DataTypes) => sequelize.define("Talent", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  classId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  maxPoints: { type: DataTypes.INTEGER, defaultValue: 1 },
  tier: { type: DataTypes.INTEGER, defaultValue: 1 },
  costPoints: { type: DataTypes.INTEGER, defaultValue: 1 }
}, { tableName:"talents", schema:"dwd", timestamps:true });
