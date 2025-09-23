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

const itemScenarioInclude = {
  model: Scenario,
  as: 'scenario',
  attributes: ['id', 'title'],
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
  { model: Item, as: 'items', include: [itemScenarioInclude] },
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

const normalizeScenarioId = (value) => {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }
  return value
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
      include: [itemScenarioInclude],
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
    const { name, type = 'misc', data, scenarioId } = req.body ?? {}

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
    const normalizedScenarioId = normalizeScenarioId(scenarioId)

    let scenarioReference = null
    if (normalizedScenarioId) {
      const scenario = await Scenario.findOne({
        where: { id: normalizedScenarioId, campaignId },
      })

      if (!scenario) {
        return res.status(400).json({ message: 'Scenario does not belong to this campaign' })
      }

      scenarioReference = scenario.id
    }

    const item = await Item.create({
      campaignId,
      scenarioId: scenarioReference,
      name: name.trim(),
      type: itemType,
      data: normalizeJsonField(data),
    })

    await item.reload({ include: [itemScenarioInclude] })

    res.status(201).json({ item })
  } catch (error) {
    next(error)
  }
}

export const updateItem = async (req, res, next) => {
  try {
    const { campaignId, itemId } = req.params
    const { name, type, data, scenarioId } = req.body ?? {}

    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' })
    }

    const campaign = await Campaign.findByPk(campaignId)
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' })
    }

    if (campaign.dmId !== req.user.id) {
      return res.status(403).json({ message: 'Only the campaign DM can update items' })
    }

    const item = await Item.findOne({ where: { id: itemId, campaignId } })
    if (!item) {
      return res.status(404).json({ message: 'Item not found' })
    }

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Item name is required' })
      }
      item.name = name.trim()
    }

    if (type !== undefined) {
      item.type = itemTypes.includes(type) ? type : 'misc'
    }

    if (data !== undefined) {
      item.data = normalizeJsonField(data)
    }

    const normalizedScenarioId = normalizeScenarioId(scenarioId)
    if (normalizedScenarioId !== undefined) {
      if (normalizedScenarioId) {
        const scenario = await Scenario.findOne({
          where: { id: normalizedScenarioId, campaignId },
        })

        if (!scenario) {
          return res.status(400).json({ message: 'Scenario does not belong to this campaign' })
        }

        item.scenarioId = scenario.id
      } else {
        item.scenarioId = null
      }
    }

    await item.save()
    await item.reload({ include: [itemScenarioInclude] })

    res.json({ item })
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
