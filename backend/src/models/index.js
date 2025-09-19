import { sequelize } from '../database/sequelize.js'
import { Campaign } from './Campaign.js'
import { Npc } from './Npc.js'
import { Scenario } from './Scenario.js'
import { User } from './User.js'

const applyAssociations = () => {
  Campaign.belongsTo(User, { as: 'dm', foreignKey: 'dmId', onDelete: 'CASCADE' })
  User.hasMany(Campaign, { as: 'managedCampaigns', foreignKey: 'dmId' })

  Scenario.belongsTo(Campaign, { as: 'campaign', foreignKey: 'campaignId', onDelete: 'CASCADE' })
  Campaign.hasMany(Scenario, { as: 'scenarios', foreignKey: 'campaignId' })

  Npc.belongsTo(Campaign, { as: 'campaign', foreignKey: 'campaignId', onDelete: 'CASCADE' })
  Campaign.hasMany(Npc, { as: 'npcs', foreignKey: 'campaignId' })

  Npc.belongsTo(Scenario, { as: 'scenario', foreignKey: 'scenarioId', onDelete: 'SET NULL' })
  Scenario.hasMany(Npc, { as: 'npcs', foreignKey: 'scenarioId' })
}

applyAssociations()

export const models = {
  User,
  Campaign,
  Scenario,
  Npc,
}

export const syncDatabase = async (options = {}) => {
  await sequelize.sync(options)
}

export { sequelize }
