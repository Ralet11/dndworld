module.exports = (sequelize, DataTypes) => sequelize.define("CampaignInvite", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  campaignId: { type: DataTypes.UUID, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  invitedBy: { type: DataTypes.UUID },
  token: { type: DataTypes.STRING, allowNull: false },
  accepted: { type: DataTypes.BOOLEAN, defaultValue:false }
}, { tableName:"campaign_invites", schema:"dwd", timestamps:true });
