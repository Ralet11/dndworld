module.exports = (sequelize, DataTypes) => sequelize.define("CharacterInventory", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  characterId: { type: DataTypes.UUID, allowNull: false },
  itemId: { type: DataTypes.UUID, allowNull: false },
  qty: { type: DataTypes.INTEGER, defaultValue: 1 },
  equipped: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName:"character_inventory", schema:"dwd", timestamps:true });
