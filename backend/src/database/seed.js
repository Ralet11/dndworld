import bcrypt from 'bcrypt'
import { Campaign } from '../models/Campaign.js'
import { CampaignMembership } from '../models/CampaignMembership.js'
import { Item } from '../models/Item.js'
import { Npc } from '../models/Npc.js'
import { Scenario } from '../models/Scenario.js'
import { User } from '../models/User.js'

const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12)

export const ensureSeedData = async () => {
  const passwordHash = await bcrypt.hash('dev-placeholder', saltRounds)

  const [dm] = await User.findOrCreate({
    where: { username: 'arch-dm' },
    defaults: {
      email: 'dm@example.com',
      passwordHash,
      displayName: 'Arch DM',
      role: 'dm',
    },
  })

  const [campaign] = await Campaign.findOrCreate({
    where: { name: 'Shadows of Aetherfall' },
    defaults: {
      description: 'A sweeping hexcrawl across a realm fractured by temporal storms.',
      status: 'active',
      dmId: dm.id,
      clockState: {
        currentDay: 1,
        currentHour: 8,
        pace: '10min-per-hour',
        phase: 'daylight',
      },
      settings: {
        allowRandomEncounters: true,
        weatherSystem: 'dynamic',
      },
    },
  })

  if (campaign.dmId !== dm.id) {
    campaign.dmId = dm.id
    await campaign.save()
  }

  await CampaignMembership.findOrCreate({
    where: { campaignId: campaign.id, userId: dm.id },
    defaults: { roleInCampaign: 'dm', status: 'accepted' },
  })

  await Scenario.findOrCreate({
    where: { campaignId: campaign.id, title: 'Bazaar of Stolen Hours' },
    defaults: {
      summary: 'A bustling chronomancer market hidden in a grand city-state.',
      environmentTags: ['urban', 'market', 'temporal'],
      triggerConditions: {
        biome: 'metropolis',
        reputation: ['neutral', 'ally'],
      },
      objective: 'Negotiate with time brokers for clues about the temporal rift.',
      lootTable: {
        rare: ['Time-stitcher Loom', 'Chronal Sand'],
        common: ['Temporal Trinkets', 'Exotic Spices'],
      },
      tacticalMap: {
        hasFogOfWar: true,
        gridSize: 25,
      },
      mediaRefs: {
        artwork: ['https://example.com/assets/bazaar.jpg'],
      },
    },
  })

  await Npc.bulkCreate([], { ignoreDuplicates: true })

  const items = [
    {
      name: 'Chronal Compass',
      type: 'consumable',
      data: {
        rarity: 'rare',
        description: 'Allows the bearer to re-roll a failed navigation check once per session.',
      },
    },
    {
      name: 'Starlit Edge',
      type: 'weapon',
      data: {
        rarity: 'uncommon',
        damage: '1d8 slashing',
        effect: 'Emits dim light and reveals invisible creatures on a hit.',
      },
    },
  ]

  for (const item of items) {
    await Item.findOrCreate({
      where: { campaignId: campaign.id, name: item.name },
      defaults: {
        campaignId: campaign.id,
        ...item,
      },
    })
  }
}
