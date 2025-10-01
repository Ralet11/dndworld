module.exports = (sequelize, DataTypes) => sequelize.define("UserRole", {
  userId: { type: DataTypes.UUID, allowNull: false },
  role: { type: DataTypes.ENUM("PLAYER","DM","ADMIN"), allowNull: false }
}, { tableName:"user_roles", schema:"dwd", timestamps:false });
