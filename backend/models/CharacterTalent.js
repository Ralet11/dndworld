module.exports = (sequelize, DataTypes) => sequelize.define("CharacterTalent", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  characterId: { type: DataTypes.UUID, allowNull: false },
  talentId: { type: DataTypes.UUID, allowNull: false },
  points: { type: DataTypes.INTEGER, defaultValue: 1 }
}, { tableName:"character_talents", schema:"dwd", timestamps:true });
