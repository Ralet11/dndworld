module.exports = (sequelize, DataTypes) => sequelize.define("DmApplication", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.UUID, allowNull: false },
  status: { type: DataTypes.ENUM("PENDING","APPROVED","REJECTED"), defaultValue:"PENDING" },
  note: { type: DataTypes.TEXT },
  reviewedBy: { type: DataTypes.UUID }
}, { tableName:"dm_applications", schema:"dwd", timestamps:true });
