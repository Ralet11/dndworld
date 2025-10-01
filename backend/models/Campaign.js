module.exports = (sequelize, DataTypes) => sequelize.define("Campaign", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  ownerDmId: { type: DataTypes.UUID, allowNull: false },
  status: { type: DataTypes.ENUM("DRAFT","ACTIVE","FINISHED","ABANDONED"), defaultValue:"DRAFT" },
  notesAssetId: { type: DataTypes.UUID }
}, { tableName:"campaigns", schema:"dwd", timestamps:true });
