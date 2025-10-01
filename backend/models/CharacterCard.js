module.exports = (sequelize, DataTypes) => sequelize.define("CharacterCard", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  deckId: { type: DataTypes.UUID, allowNull: false },
  cardId: { type: DataTypes.UUID, allowNull: false },
  copies: { type: DataTypes.SMALLINT, defaultValue: 4 }
}, { tableName:"character_cards", schema:"dwd", timestamps:true });
