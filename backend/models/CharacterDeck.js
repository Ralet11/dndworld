module.exports = (sequelize, DataTypes) => sequelize.define("CharacterDeck", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  characterId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING, defaultValue: "Main" }
}, { tableName:"character_deck", schema:"dwd", timestamps:true });
