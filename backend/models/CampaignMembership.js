module.exports = (sequelize, DataTypes) => sequelize.define("CampaignMembership", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  campaignId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.UUID, allowNull: false },
  role: { type: DataTypes.ENUM("DM","PLAYER"), allowNull: false },
  characterId: { type: DataTypes.UUID },
  status: { type: DataTypes.STRING, defaultValue:"ACTIVE" }
}, { tableName:"campaign_memberships", schema:"dwd", timestamps:true });
