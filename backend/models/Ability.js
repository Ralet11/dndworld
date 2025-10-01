module.exports = (sequelize, DataTypes) => sequelize.define("Ability", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  description: { type: DataTypes.TEXT },
  speed: { type: DataTypes.ENUM("ACTION","REACTION","RITUAL"), defaultValue:"ACTION" },
  baseCopies: { type: DataTypes.SMALLINT, defaultValue: 4 }
}, { tableName:"abilities", schema:"dwd", timestamps:true });
