module.exports = (sequelize, DataTypes) => sequelize.define("Wallet", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  ownerCreatureId: { type: DataTypes.UUID, allowNull: false, unique: true },
  gold: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { tableName:"wallets", schema:"dwd", timestamps:true });
