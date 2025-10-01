module.exports = (sequelize, DataTypes) => sequelize.define("CampaignNews", {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  campaignId: { type: DataTypes.UUID, allowNull: false },
  kind: { type: DataTypes.ENUM("MONSTER_SIGHTING","BOSS_DEFEATED","DISCOVERY","QUEST_COMPLETED"), allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  summary: { type: DataTypes.TEXT, allowNull: false },
  payload: { type: DataTypes.JSONB, defaultValue: {} }
}, { tableName:"campaign_news", schema:"dwd", timestamps:true });
