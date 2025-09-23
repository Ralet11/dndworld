import { Op } from 'sequelize'
import { Campaign } from '../models/Campaign.js'
import { CampaignMembership } from '../models/CampaignMembership.js'
import { Item } from '../models/Item.js'
import { Npc } from '../models/Npc.js'
import { Scenario } from '../models/Scenario.js'
import { ScenarioImage } from '../models/ScenarioImage.js'
import { User } from '../models/User.js'

const membershipRoles = ['dm', 'player']
const npcDispositions = ['hostile', 'neutral', 'friendly', 'unknown']
const itemTypes = ['consumable', 'weapon', 'misc']

const membershipUserInclude = {
  model: User,
  as: 'user',
  attributes: ['id', 'username', 'displayName', 'role', 'avatarUrl'],
}

const scenarioImagesInclude = {
  model: ScenarioImage,
  as: 'images',
  separate: true,
  order: [
    ['sortOrder', 'ASC'],
    ['createdAt', 'ASC'],
    ['id', 'ASC'],
  ],
}

const summarizeCampaignInclude = [
  { model: User, as: 'dm', attributes: ['id', 'username', 'displayName'] },
  { model: Scenario, as: 'scenarios', attributes: ['id', 'title'] },
  { model: Npc, as: 'npcs', attributes: ['id', 'name', 'disposition'] },
]

const fullCampaignInclude = [
  { model: User, as: 'dm', attributes: ['id', 'username', 'displayName'] },
  { model: Scenario, as: 'scenarios', include: [scenarioImagesInclude] },
  { model: Npc, as: 'npcs' },
  { model: Item, as: 'items' },
  { model: CampaignMembership, as: 'memberships', include: [membershipUserInclude] },
]

const normalizeArrayField = (value) => {
  if (!value) return null
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    const tags = value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
    return tags.length > 0 ? tags : null
  }
  return null
}

const normalizeJsonField = (value) => {
  if (!value) return null
  if (typeof value === 'object') return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return typeof parsed === 'object' && parsed !== null ? parsed : null
    } catch (error) {
      return null
    }
  }
  return null
}

const normalizeArrayInput = (value, fieldName) => {
  if (value === undefined) {
    return { skip: true }
  }

  if (value === null) {
    return { value: null }
  }

  if (Array.isArray(value)) {
    return { value }
  }

  if (typeof value === 'string') {
    return { value: normalizeArrayField(value) }
  }

  return {
    error: `${fieldName} must be an array, comma-separated string, or null`,
  }
}

const normalizeJsonInput = (value, fieldName) => {
  if (value === undefined) {
    return { skip: true }
  }

  if (value === null) {
    return { value: null }
  }

  if (typeof value === 'object') {
    return { value }
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (typeof parsed === 'object' && parsed !== null) {
        return { value: parsed }
      }
      return { error: `${fieldName} must be a valid JSON object` }
    } catch (error) {
      return { error: `${fieldName} must be valid JSON` }
    }
  }

  return {
    error: `${fieldName} must be an object or JSON string`,
  }
}

const toTrimmedOrNull = (value) => {
  if (value === undefined) return undefined
  if (value === null) return null
  const trimmed = typeof value === 'string' ? value.trim() : value
  if (typeof trimmed === 'string') {
    return trimmed.length > 0 ? trimmed : null
  }
  return trimmed
}

const loadMembership = (membership) =>
  membership.reload({
    include: [membershipUserInclude],
  })

const ensureCampaignAccess = async ({ campaignId, userId, requireAccepted = true }) => {
  const campaign = await Campaign.findByPk(campaignId)
  if (!campaign) {
    return { error: { status: 404, message: 'Campaign not found' } }
  }

  if (userId && campaign.dmId === userId) {
    return { campaign, isDm: true }
  }

  if (!userId) {
    return { error: { status: 401, message: 'Authentication required' } }
  }

  const membership = await CampaignMembership.findOne({ where: { campaignId, userId } })
  if (!membership || (requireAccepted && membership.status !== 'accepted')) {
    return { error: { status: 403, message: 'Access denied' } }
  }

  return { campaign, membership, isDm: false }
}

export const getCampaigns = async (_req, res, next) => {
  try {
    const campaigns = await Campaign.findAll({
      include: summarizeCampaignInclude,
      order: [
        ['createdAt', 'DESC'],
        [{ model: Scenario, as: 'scenarios' }, 'createdAt', 'ASC'],
      ],
    })

    res.json({ campaigns })
  } catch (error) {
    next(error)
  }
}

export const getCampaignById = async (req, res, next) => {
  try {
    const { campaignId } = req.params
    const campaign = await Campaign.findByPk(campaignId, {
      include: fullCampaignInclude,
      order: [
        [{ model: Scenario, as: 'scenarios' }, 'createdAt', 'ASC'],
        [{ model: Npc, as: 'npcs' }, 'createdAt', 'ASC'],
        [{ model: Item, as: 'items' }, 'createdAt', 'ASC'],
        [{ model: CampaignMembership, as: 'memberships' }, 'createdAt', 'ASC'],
      ],
    })

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' })
    }

    res.json({ campaign })
  } catch (error) {
    next(error)
  }
}

export const createCampaign = async (req, res, next) => {
  try {
    const { name, description, status, dmId, clockState, settings } = req.body ?? {}

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Campaign name is required' })
    }

    let ownerId = dmId
    if (!ownerId) {
      const defaultDm = await User.findOne({
        where: { role: 'dm' },
        order: [['createdAt', 'ASC']],
      })

      if (!defaultDm) {
        return res.status(400).json({
          message: 'No dungeon masters available. Provide dmId when creating a campaign.',
        })
      }

      ownerId = defaultDm.id
    }

    const payload = {
      name: name.trim(),
      dmId: ownerId,
      description: description?.trim() || null,
    }

    if (status && ['draft', 'active', 'archived'].includes(status)) {
      payload.status = status
    }

    if (clockState !== undefined) {
      payload.clockState = normalizeJsonField(clockState)
    }

    if (settings !== undefined) {
      payload.settings = normalizeJsonField(settings)
    }

    const campaign = await Campaign.create(payload)

    await CampaignMembership.findOrCreate({
      where: { campaignId: campaign.id, userId: ownerId },
      defaults: {
        roleInCampaign: 'dm',
        status: 'accepted',
      },
    })

    const fullCampaign = await Campaign.findByPk(campaign.id, {
      include: fullCampaignInclude,
    })

    res.status(201).json({ campaign: fullCampaign })
  } catch (error) {
    next(error)
  }
}

export const createScenario = async (req, res, next) => {
  try {
    const { campaignId } = req.params
    const {
      title,
      summary,
      environmentTags,
      triggerConditions,
      objective,
      lootTable,
      tacticalMap,
      mediaRefs,
    } = req.body ?? {}

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Scenario title is required' })
    }

    const campaign = await Campaign.findByPk(campaignId)
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' })
    }

    const scenario = await Scenario.create({
      campaignId,
      title: title.trim(),
      summary: summary?.trim() || null,
      environmentTags: normalizeArrayField(environmentTags),
      triggerConditions: normalizeJsonField(triggerConditions),
      objective: objective?.trim() || null,
      lootTable: normalizeJsonField(lootTable),
      tacticalMap: normalizeJsonField(tacticalMap),
      mediaRefs: normalizeJsonField(mediaRefs),
    })

    res.status(201).json({ scenario })
  } catch (error) {
    next(error)
  }
}

export const createNpc = async (req, res, next) => {
  try {
    const { campaignId } = req.params
    const {
      name,
      title,
      creatureType,
      disposition,
      scenarioId,
      statBlock,
      hooks,
      lootProfile,
      portraitUrl,
    } = req.body ?? {}

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'NPC name is required' })
    }

    const campaign = await Campaign.findByPk(campaignId)
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' })
    }

    let scenarioReference = null
    if (scenarioId) {
      const scenario = await Scenario.findOne({
        where: { id: scenarioId, campaignId },
      })

      if (!scenario) {
        return res.status(400).json({ message: 'Scenario does not belong to this campaign' })
      }

      scenarioReference = scenarioId
    }

    const npc = await Npc.create({
      campaignId,
      scenarioId: scenarioReference,
      name: name.trim(),
      title: title?.trim() || null,
      creatureType: creatureType?.trim() || null,
      disposition: npcDispositions.includes(disposition) ? disposition : 'unknown',
      statBlock: normalizeJsonField(statBlock),
      hooks: normalizeJsonField(hooks),
      lootProfile: normalizeJsonField(lootProfile),
      portraitUrl: portraitUrl?.trim() || null,
    })

    res.status(201).json({ npc })
  } catch (error) {
    next(error)
  }
}

export const getCampaignNpcs = async (req, res, next) => {
  try {
    const { campaignId } = req.params
    const { search } = req.query ?? {}

    const access = await ensureCampaignAccess({ campaignId, userId: req.user?.id })
    if (access.error) {
      return res.status(access.error.status).json({ message: access.error.message })
    }

    const where = { campaignId }
    if (search && typeof search === 'string' && search.trim()) {
      where.name = { [Op.iLike]: `%${search.trim()}%` }
    }

    const npcs = await Npc.findAll({
      where,
      order: [
        ['name', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    })

    res.json({ npcs })
  } catch (error) {
    next(error)
  }
}

export const getCampaignItems = async (req, res, next) => {
  try {
    const { campaignId } = req.params
    const { search, type } = req.query ?? {}

    const access = await ensureCampaignAccess({ campaignId, userId: req.user?.id })
    if (access.error) {
      return res.status(access.error.status).json({ message: access.error.message })
    }

    const where = { campaignId }
    if (type && itemTypes.includes(type)) {
      where.type = type
    }

    if (search && typeof search === 'string' && search.trim()) {
      where.name = { [Op.iLike]: `%${search.trim()}%` }
    }

    const items = await Item.findAll({
      where,
      order: [
        ['name', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    })

    res.json({ items })
  } catch (error) {
    next(error)
  }
}

export const createItem = async (req, res, next) => {
  try {
    const { campaignId } = req.params
    const { name, type = 'misc', data } = req.body ?? {}

    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' })
    }

    const campaign = await Campaign.findByPk(campaignId)
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' })
    }

    if (campaign.dmId !== req.user.id) {
      return res.status(403).json({ message: 'Only the campaign DM can create items' })
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Item name is required' })
    }

    const itemType = itemTypes.includes(type) ? type : 'misc'

    const item = await Item.create({
      campaignId,
      name: name.trim(),
      type: itemType,
      data: normalizeJsonField(data),
    })

    res.status(201).json({ item })
  } catch (error) {
    next(error)
  }
}

export const updateCampaign = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' })
    }

    const { campaignId } = req.params
    const { name, description, status, dmId, clockState, settings } = req.body ?? {}

    const access = await ensureCampaignAccess({
      campaignId,
      userId: req.user.id,
      requireAccepted: false,
    })

    if (access.error) {
      return res.status(access.error.status).json({ message: access.error.message })
    }

    if (!access.isDm) {
      return res.status(403).json({ message: 'Only the campaign DM can update the campaign' })
    }

    const updates = {}

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Campaign name cannot be empty' })
      }
      updates.name = name.trim()
    }

    if (description !== undefined) {
      updates.description = toTrimmedOrNull(description)
    }

    if (status !== undefined) {
      if (!['draft', 'active', 'archived'].includes(status)) {
        return res.status(400).json({ message: 'Invalid campaign status' })
      }
      updates.status = status
    }

    if (dmId !== undefined && dmId !== access.campaign.dmId) {
      const nextDm = await User.findByPk(dmId)
      if (!nextDm) {
        return res.status(404).json({ message: 'Dungeon master not found' })
      }
      if (nextDm.role !== 'dm') {
        return res.status(400).json({ message: 'Assigned user must have the dm role' })
      }
      updates.dmId = dmId
    }

    if (clockState !== undefined) {
      const normalized = normalizeJsonInput(clockState, 'clockState')
      if (normalized.error) {
        return res.status(400).json({ message: normalized.error })
      }
      updates.clockState = normalized.value
    }

    if (settings !== undefined) {
      const normalized = normalizeJsonInput(settings, 'settings')
      if (normalized.error) {
        return res.status(400).json({ message: normalized.error })
      }
      updates.settings = normalized.value
    }

    if (!Object.keys(updates).length) {
      await access.campaign.reload({ include: fullCampaignInclude })
      return res.json({ campaign: access.campaign })
    }

    await access.campaign.update(updates)

    const updatedCampaign = await Campaign.findByPk(campaignId, {
      include: fullCampaignInclude,
      order: [
        [{ model: Scenario, as: 'scenarios' }, 'createdAt', 'ASC'],
        [{ model: Npc, as: 'npcs' }, 'createdAt', 'ASC'],
        [{ model: Item, as: 'items' }, 'createdAt', 'ASC'],
        [{ model: CampaignMembership, as: 'memberships' }, 'createdAt', 'ASC'],
      ],
    })

    res.json({ campaign: updatedCampaign })
  } catch (error) {
    next(error)
  }
}

export const updateScenario = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' })
    }

    const { campaignId, scenarioId } = req.params
    const {
      campaignId: nextCampaignId,
      title,
      summary,
      environmentTags,
      triggerConditions,
      objective,
      lootTable,
      tacticalMap,
      mediaRefs,
    } = req.body ?? {}

    const access = await ensureCampaignAccess({
      campaignId,
      userId: req.user.id,
      requireAccepted: false,
    })

    if (access.error) {
      return res.status(access.error.status).json({ message: access.error.message })
    }

    if (!access.isDm) {
      return res.status(403).json({ message: 'Only the campaign DM can update scenarios' })
    }

    const scenario = await Scenario.findOne({
      where: { id: scenarioId, campaignId },
    })

    if (!scenario) {
      return res.status(404).json({ message: 'Scenario not found' })
    }

    let targetCampaignId = campaignId
    if (nextCampaignId !== undefined && nextCampaignId !== campaignId) {
      const targetCampaign = await Campaign.findByPk(nextCampaignId)
      if (!targetCampaign) {
        return res.status(404).json({ message: 'Target campaign not found' })
      }
      if (targetCampaign.dmId !== req.user.id) {
        return res
          .status(403)
          .json({ message: 'You must be the DM of the target campaign to reassign scenarios' })
      }
      targetCampaignId = targetCampaign.id
    }

    const updates = {}

    if (title !== undefined) {
      if (!title || !title.trim()) {
        return res.status(400).json({ message: 'Scenario title cannot be empty' })
      }
      updates.title = title.trim()
    }

    if (summary !== undefined) {
      updates.summary = toTrimmedOrNull(summary)
    }

    if (objective !== undefined) {
      updates.objective = toTrimmedOrNull(objective)
    }

    const normalizedTags = normalizeArrayInput(environmentTags, 'environmentTags')
    if (normalizedTags.error) {
      return res.status(400).json({ message: normalizedTags.error })
    }
    if (!normalizedTags.skip) {
      updates.environmentTags = normalizedTags.value
    }

    const normalizedTrigger = normalizeJsonInput(triggerConditions, 'triggerConditions')
    if (normalizedTrigger.error) {
      return res.status(400).json({ message: normalizedTrigger.error })
    }
    if (!normalizedTrigger.skip) {
      updates.triggerConditions = normalizedTrigger.value
    }

    const normalizedLoot = normalizeJsonInput(lootTable, 'lootTable')
    if (normalizedLoot.error) {
      return res.status(400).json({ message: normalizedLoot.error })
    }
    if (!normalizedLoot.skip) {
      updates.lootTable = normalizedLoot.value
    }

    const normalizedTactical = normalizeJsonInput(tacticalMap, 'tacticalMap')
    if (normalizedTactical.error) {
      return res.status(400).json({ message: normalizedTactical.error })
    }
    if (!normalizedTactical.skip) {
      updates.tacticalMap = normalizedTactical.value
    }

    const normalizedMedia = normalizeJsonInput(mediaRefs, 'mediaRefs')
    if (normalizedMedia.error) {
      return res.status(400).json({ message: normalizedMedia.error })
    }
    if (!normalizedMedia.skip) {
      updates.mediaRefs = normalizedMedia.value
    }

    if (targetCampaignId !== scenario.campaignId || nextCampaignId !== undefined) {
      updates.campaignId = targetCampaignId
    }

    if (!Object.keys(updates).length) {
      const reloaded = await Scenario.findByPk(scenario.id, { include: [scenarioImagesInclude] })
      return res.json({ scenario: reloaded })
    }

    await scenario.update(updates)

    const updatedScenario = await Scenario.findByPk(scenario.id, {
      include: [scenarioImagesInclude],
    })

    res.json({ scenario: updatedScenario })
  } catch (error) {
    next(error)
  }
}

export const updateNpc = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' })
    }

    const { campaignId, npcId } = req.params
    const {
      campaignId: nextCampaignId,
      name,
      title,
      creatureType,
      disposition,
      scenarioId,
      statBlock,
      hooks,
      lootProfile,
      portraitUrl,
    } = req.body ?? {}

    const access = await ensureCampaignAccess({
      campaignId,
      userId: req.user.id,
      requireAccepted: false,
    })

    if (access.error) {
      return res.status(access.error.status).json({ message: access.error.message })
    }

    if (!access.isDm) {
      return res.status(403).json({ message: 'Only the campaign DM can update NPCs' })
    }

    const npc = await Npc.findOne({
      where: { id: npcId, campaignId },
    })

    if (!npc) {
      return res.status(404).json({ message: 'NPC not found' })
    }

    let targetCampaignId = campaignId
    if (nextCampaignId !== undefined && nextCampaignId !== campaignId) {
      const targetCampaign = await Campaign.findByPk(nextCampaignId)
      if (!targetCampaign) {
        return res.status(404).json({ message: 'Target campaign not found' })
      }
      if (targetCampaign.dmId !== req.user.id) {
        return res
          .status(403)
          .json({ message: 'You must be the DM of the target campaign to reassign NPCs' })
      }
      targetCampaignId = targetCampaign.id
    }

    const updates = {}

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'NPC name cannot be empty' })
      }
      updates.name = name.trim()
    }

    if (title !== undefined) {
      updates.title = toTrimmedOrNull(title)
    }

    if (creatureType !== undefined) {
      updates.creatureType = toTrimmedOrNull(creatureType)
    }

    if (disposition !== undefined) {
      if (!npcDispositions.includes(disposition)) {
        return res.status(400).json({ message: 'Invalid disposition value' })
      }
      updates.disposition = disposition
    }

    let scenarioReference = npc.scenarioId
    if (scenarioId !== undefined) {
      if (!scenarioId) {
        scenarioReference = null
      } else {
        const scenario = await Scenario.findOne({
          where: { id: scenarioId, campaignId: targetCampaignId },
        })
        if (!scenario) {
          return res.status(400).json({ message: 'Scenario does not belong to the target campaign' })
        }
        scenarioReference = scenario.id
      }
      updates.scenarioId = scenarioReference
    }

    const normalizedStatBlock = normalizeJsonInput(statBlock, 'statBlock')
    if (normalizedStatBlock.error) {
      return res.status(400).json({ message: normalizedStatBlock.error })
    }
    if (!normalizedStatBlock.skip) {
      updates.statBlock = normalizedStatBlock.value
    }

    const normalizedHooks = normalizeJsonInput(hooks, 'hooks')
    if (normalizedHooks.error) {
      return res.status(400).json({ message: normalizedHooks.error })
    }
    if (!normalizedHooks.skip) {
      updates.hooks = normalizedHooks.value
    }

    const normalizedLootProfile = normalizeJsonInput(lootProfile, 'lootProfile')
    if (normalizedLootProfile.error) {
      return res.status(400).json({ message: normalizedLootProfile.error })
    }
    if (!normalizedLootProfile.skip) {
      updates.lootProfile = normalizedLootProfile.value
    }

    if (portraitUrl !== undefined) {
      updates.portraitUrl = toTrimmedOrNull(portraitUrl)
    }

    if (targetCampaignId !== npc.campaignId || nextCampaignId !== undefined) {
      updates.campaignId = targetCampaignId
    }

    if (!Object.keys(updates).length) {
      return res.json({ npc })
    }

    await npc.update(updates)

    const updatedNpc = await Npc.findByPk(npc.id)

    res.json({ npc: updatedNpc })
  } catch (error) {
    next(error)
  }
}

export const updateItem = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' })
    }

    const { campaignId, itemId } = req.params
    const { campaignId: nextCampaignId, name, type, data, scenarioId } = req.body ?? {}

    const access = await ensureCampaignAccess({
      campaignId,
      userId: req.user.id,
      requireAccepted: false,
    })

    if (access.error) {
      return res.status(access.error.status).json({ message: access.error.message })
    }

    if (!access.isDm) {
      return res.status(403).json({ message: 'Only the campaign DM can update items' })
    }

    const item = await Item.findOne({ where: { id: itemId, campaignId } })
    if (!item) {
      return res.status(404).json({ message: 'Item not found' })
    }

    let targetCampaignId = campaignId
    if (nextCampaignId !== undefined && nextCampaignId !== campaignId) {
      const targetCampaign = await Campaign.findByPk(nextCampaignId)
      if (!targetCampaign) {
        return res.status(404).json({ message: 'Target campaign not found' })
      }
      if (targetCampaign.dmId !== req.user.id) {
        return res
          .status(403)
          .json({ message: 'You must be the DM of the target campaign to reassign items' })
      }
      targetCampaignId = targetCampaign.id
    }

    const updates = {}

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Item name cannot be empty' })
      }
      updates.name = name.trim()
    }

    if (type !== undefined) {
      if (!itemTypes.includes(type)) {
        return res.status(400).json({ message: 'Invalid item type' })
      }
      updates.type = type
    }

    const normalizedData = normalizeJsonInput(data, 'data')
    if (normalizedData.error) {
      return res.status(400).json({ message: normalizedData.error })
    }
    if (!normalizedData.skip) {
      updates.data = normalizedData.value
    }

    if (scenarioId !== undefined) {
      if (!scenarioId) {
        updates.scenarioId = null
      } else {
        const scenario = await Scenario.findOne({
          where: { id: scenarioId, campaignId: targetCampaignId },
        })
        if (!scenario) {
          return res.status(400).json({ message: 'Scenario does not belong to the target campaign' })
        }
        updates.scenarioId = scenario.id
      }
    }

    if (targetCampaignId !== item.campaignId || nextCampaignId !== undefined) {
      updates.campaignId = targetCampaignId
    }

    if (!Object.keys(updates).length) {
      return res.json({ item })
    }

    await item.update(updates)

    const updatedItem = await Item.findByPk(item.id)

    res.json({ item: updatedItem })
  } catch (error) {
    next(error)
  }
}

export const getCampaignMembers = async (req, res, next) => {
  try {
    const { campaignId } = req.params

    const campaign = await Campaign.findByPk(campaignId)
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' })
    }

    const isDm = campaign.dmId === req.user.id
    if (!isDm) {
      const membership = await CampaignMembership.findOne({
        where: { campaignId, userId: req.user.id },
      })

      if (!membership || membership.status !== 'accepted') {
        return res.status(403).json({ message: 'Access denied' })
      }
    }

    const memberships = await CampaignMembership.findAll({
      where: { campaignId },
      include: [membershipUserInclude],
      order: [
        ['status', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    })

    res.json({ memberships })
  } catch (error) {
    next(error)
  }
}

export const inviteCampaignMember = async (req, res, next) => {
  try {
    const { campaignId } = req.params
    const { userId, roleInCampaign } = req.body ?? {}

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' })
    }

    const campaign = await Campaign.findByPk(campaignId)
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' })
    }

    if (campaign.dmId !== req.user.id) {
      return res.status(403).json({ message: 'Only the campaign DM can invite members' })
    }

    const user = await User.findByPk(userId)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    const membershipRole = membershipRoles.includes(roleInCampaign) ? roleInCampaign : 'player'

    let membership = await CampaignMembership.findOne({
      where: { campaignId, userId },
    })

    let statusCode = 201

    if (membership) {
      if (membership.status === 'accepted') {
        return res.status(409).json({ message: 'User is already a campaign member' })
      }

      membership.roleInCampaign = membershipRole
      membership.status = 'invited'
      await membership.save()
      statusCode = 200
    } else {
      membership = await CampaignMembership.create({
        campaignId,
        userId,
        roleInCampaign: membershipRole,
        status: 'invited',
      })
    }

    await loadMembership(membership)

    res.status(statusCode).json({ membership })
  } catch (error) {
    next(error)
  }
}

export const acceptCampaignInvite = async (req, res, next) => {
  try {
    const { campaignId, userId } = req.params

    if (req.user.id !== userId) {
      return res.status(403).json({ message: 'You can only accept your own invitations' })
    }

    const membership = await CampaignMembership.findOne({
      where: { campaignId, userId },
    })

    if (!membership) {
      return res.status(404).json({ message: 'Invitation not found' })
    }

    if (membership.status === 'accepted') {
      await loadMembership(membership)
      return res.json({ membership })
    }

    if (membership.status !== 'invited') {
      return res.status(400).json({ message: 'Invitation cannot be accepted' })
    }

    membership.status = 'accepted'
    await membership.save()
    await loadMembership(membership)

    res.json({ membership })
  } catch (error) {
    next(error)
  }
}
