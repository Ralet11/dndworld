import { Campaign } from '../models/Campaign.js'
import { Npc } from '../models/Npc.js'
import { Scenario } from '../models/Scenario.js'
import { User } from '../models/User.js'

export const ensureSeedData = async () => {
  const campaignCount = await Campaign.count()
  if (campaignCount > 0) return

  const dm = await User.create({
    username: 'arch-dm',
    email: 'dm@example.com',
    passwordHash: 'dev-placeholder',
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

  await Npc.bulkCreate([
    {
      campaignId: campaign.id,
      scenarioId: scenario.id,
      name: 'Keeper Solenne',
      title: 'Chronomancer Guild Liaison',
      creatureType: 'Humanoid',
      disposition: 'friendly',
      statBlock: {
        ac: 15,
        hp: 44,
        abilities: {
          intel: 18,
          charisma: 16,
        },
      },
      hooks: {
        goals: ['Secure allies against rogue time bandits'],
        secrets: ['Knows of a hidden time gate beneath the bazaar'],
      },
      lootProfile: {
        guaranteed: ['Chronal Compass'],
        rareChance: 0.25,
      },
      portraitUrl: 'https://example.com/assets/solenne.png',
    },
    {
      campaignId: campaign.id,
      scenarioId: scenario.id,
      name: 'Vrax the Time-Warped',
      title: 'Temporal Smuggler',
      creatureType: 'Tiefling',
      disposition: 'neutral',
      statBlock: {
        ac: 14,
        hp: 52,
        abilities: {
          dex: 17,
          charisma: 18,
        },
      },
      hooks: {
        motivations: ['Profit from rare chrono-artifacts'],
        leverage: ['Possesses a time-shard map fragment'],
      },
      lootProfile: {
        guaranteed: ['Bag of Folded Moments'],
        rareChance: 0.35,
      },
      portraitUrl: 'https://example.com/assets/vrax.png',
    },
  ])
}
