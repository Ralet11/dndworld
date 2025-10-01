module.exports = (sequelize, DataTypes) => sequelize.define("TalentEdge", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  fromTalentId: { type: DataTypes.UUID, allowNull: false },
  toTalentId: { type: DataTypes.UUID, allowNull: false },
  requirementPoints: { type: DataTypes.INTEGER, defaultValue: 1 }
}, { tableName:"talent_edges", schema:"dwd", timestamps:true });
