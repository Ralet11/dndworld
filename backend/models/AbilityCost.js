module.exports = (sequelize, DataTypes) => sequelize.define("AbilityCost", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  abilityId: { type: DataTypes.UUID, allowNull: false },
  resource: { type: DataTypes.ENUM("MANA","ENERGY","SPIRIT","SOUL","FOCUS","RAGE"), allowNull: false },
  amount: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName:"ability_costs", schema:"dwd", timestamps:true });
