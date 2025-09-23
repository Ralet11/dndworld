import bcrypt from 'bcrypt'
import { Campaign } from '../models/Campaign.js'
import { CampaignMembership } from '../models/CampaignMembership.js'
import { Item } from '../models/Item.js'
import { Npc } from '../models/Npc.js'
import { Scenario } from '../models/Scenario.js'
import { User } from '../models/User.js'

const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12)

export const ensureSeedData = async () => {
  const campaignCount = await Campaign.count()
  if (campaignCount > 0) return

  const passwordHash = await bcrypt.hash('dev-placeholder', saltRounds)

  const dm = await User.create({
    username: 'arch-dm',
    email: 'dm@example.com',
    passwordHash,
    displayName: 'Arch DM',
    role: 'dm',
  })

  const campaign = await Campaign.create({
    name: 'Shadows of Aetherfall',
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
  })

  await CampaignMembership.create({
    campaignId: campaign.id,
    userId: dm.id,
    roleInCampaign: 'dm',
    status: 'accepted',
  })

  const scenario = await Scenario.create({
    campaignId: campaign.id,
    title: 'Bazaar of Stolen Hours',
    summary: 'A bustling chronomancer market hidden in a grand city-state.',
    environmentTags: ['urban', 'market', 'temporal'],
    triggerConditions: {
      biome: 'metropolis',
      reputation: ['neutral', 'ally'],
    },
    objective: 'Negotiate with time brokers for clues about the temporal rift.',
    lootTable: {
      rare: ['Time-stitcher Loom', "Chronal Sand"],
      common: ['Temporal Trinkets', 'Exotic Spices'],
    },
    tacticalMap: {
      hasFogOfWar: true,
      gridSize: 25,
    },
    mediaRefs: {
      artwork: ['https://example.com/assets/bazaar.jpg'],
    },
  })

  await Npc.bulkCreate([])

  await Item.bulkCreate([
    {
      campaignId: campaign.id,
      name: 'Chronal Compass',
      type: 'consumable',
      data: {
        rarity: 'rare',
        description: 'Allows the bearer to re-roll a failed navigation check once per session.'
      },
    },
    {
      campaignId: campaign.id,
      name: 'Starlit Edge',
      type: 'weapon',
      data: {
        rarity: 'uncommon',
        damage: '1d8 slashing',
        effect: 'Emits dim light and reveals invisible creatures on a hit.'
      },
    },
  ])
}

