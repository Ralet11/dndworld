module.exports = (sequelize, DataTypes) => sequelize.define("Creature", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  kind: { type: DataTypes.ENUM("CHARACTER","NPC"), allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  portraitAssetId: { type: DataTypes.UUID },
  level: { type: DataTypes.INTEGER, defaultValue: 1 },
  alignment: { type: DataTypes.ENUM(
    "LAWFUL_GOOD","NEUTRAL_GOOD","CHAOTIC_GOOD",
    "LAWFUL_NEUTRAL","TRUE_NEUTRAL","CHAOTIC_NEUTRAL",
    "LAWFUL_EVIL","NEUTRAL_EVIL","CHAOTIC_EVIL"
  ) },
  armorClass: { type: DataTypes.INTEGER, defaultValue: 10 },
  maxHp: { type: DataTypes.INTEGER, defaultValue: 10 },
  speedValue: { type: DataTypes.INTEGER, defaultValue: 6 },
  raceId: { type: DataTypes.UUID },
  classId: { type: DataTypes.UUID },
  background: { type: DataTypes.TEXT },
  fears: { type: DataTypes.TEXT },
  goalsShort: { type: DataTypes.TEXT },
  goalsLong: { type: DataTypes.TEXT },
  createdBy: { type: DataTypes.UUID }
}, { tableName:"creatures", schema:"dwd", timestamps:true });
