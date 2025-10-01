module.exports = (sequelize, DataTypes) => sequelize.define("Character", {
  id: { type: DataTypes.UUID, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false }
}, { tableName:"characters", schema:"dwd", timestamps:false });
