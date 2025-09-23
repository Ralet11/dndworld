import { sequelize } from '../database/sequelize.js'
import { Campaign } from './Campaign.js'
import { CampaignMembership } from './CampaignMembership.js'
import { Npc } from './Npc.js'
import { Scenario } from './Scenario.js'
import { ScenarioImage } from './ScenarioImage.js'
import { Item } from './Item.js'
import { User } from './User.js'

const applyAssociations = () => {
  Campaign.belongsTo(User, { as: 'dm', foreignKey: 'dmId', onDelete: 'CASCADE' })
  User.hasMany(Campaign, { as: 'managedCampaigns', foreignKey: 'dmId' })

  Campaign.hasMany(CampaignMembership, { as: 'memberships', foreignKey: 'campaignId', onDelete: 'CASCADE' })
  CampaignMembership.belongsTo(Campaign, { as: 'campaign', foreignKey: 'campaignId', onDelete: 'CASCADE' })

  User.hasMany(CampaignMembership, { as: 'campaignMemberships', foreignKey: 'userId', onDelete: 'CASCADE' })
  CampaignMembership.belongsTo(User, { as: 'user', foreignKey: 'userId', onDelete: 'CASCADE' })

  Scenario.belongsTo(Campaign, { as: 'campaign', foreignKey: 'campaignId', onDelete: 'CASCADE' })
  Campaign.hasMany(Scenario, { as: 'scenarios', foreignKey: 'campaignId' })

  ScenarioImage.belongsTo(Scenario, { as: 'scenario', foreignKey: 'scenarioId', onDelete: 'CASCADE' })
  Scenario.hasMany(ScenarioImage, { as: 'images', foreignKey: 'scenarioId' })

  Item.belongsTo(Campaign, { as: 'campaign', foreignKey: 'campaignId', onDelete: 'CASCADE' })
  Campaign.hasMany(Item, { as: 'items', foreignKey: 'campaignId' })

  Item.belongsTo(Scenario, { as: 'scenario', foreignKey: 'scenarioId', onDelete: 'SET NULL' })
  Scenario.hasMany(Item, { as: 'items', foreignKey: 'scenarioId' })

  Npc.belongsTo(Campaign, { as: 'campaign', foreignKey: 'campaignId', onDelete: 'CASCADE' })
  Campaign.hasMany(Npc, { as: 'npcs', foreignKey: 'campaignId' })

  Npc.belongsTo(Scenario, { as: 'scenario', foreignKey: 'scenarioId', onDelete: 'SET NULL' })
  Scenario.hasMany(Npc, { as: 'npcs', foreignKey: 'scenarioId' })
}

applyAssociations()

export const models = {
  User,
  Campaign,
  CampaignMembership,
  Scenario,
  ScenarioImage,
  Item,
  Npc,
}

export const syncDatabase = async (options = {}) => {
  await sequelize.sync(options)
}

export { sequelize }

