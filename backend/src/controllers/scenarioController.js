import { Op } from 'sequelize'
import { sequelize } from '../database/sequelize.js'
import { Campaign } from '../models/Campaign.js'
import { Scenario } from '../models/Scenario.js'
import { ScenarioImage } from '../models/ScenarioImage.js'
import { Npc } from '../models/Npc.js'

const toArray = (payload) => {
  if (Array.isArray(payload)) return payload
  if (payload && Array.isArray(payload.images)) return payload.images
  if (payload) return [payload]
  return []
}

const parseSortOrder = (value) => {
  if (value === undefined || value === null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

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

const scenarioDetailInclude = [scenarioImagesInclude, { model: Npc, as: 'npcs' }]

const scenarioDetailOrder = [[{ model: Npc, as: 'npcs' }, 'createdAt', 'ASC']]

export const addScenarioImages = async (req, res, next) => {
  try {
    const { scenarioId } = req.params
    const { campaignId } = req.body ?? {}

    const scenario = await Scenario.findByPk(scenarioId, {
      include: [{ model: Campaign, as: 'campaign', attributes: ['id', 'dmId'] }],
    })

    if (!scenario) {
      return res.status(404).json({ message: 'Scenario not found' })
    }

    if (campaignId && campaignId !== scenario.campaignId) {
      return res.status(400).json({ message: 'Scenario does not belong to the provided campaign' })
    }

    if (!req.user || scenario.campaign.dmId !== req.user.id) {
      return res.status(403).json({ message: 'Only the campaign DM can manage scenario images' })
    }

    const input = toArray(req.body)

    if (input.length === 0) {
      return res.status(400).json({ message: 'At least one image is required' })
    }

    const existingCount = await ScenarioImage.count({ where: { scenarioId } })
    let nextSortOrder = existingCount

    const records = []

    for (const entry of input) {
      if (!entry) continue
      const url = typeof entry.url === 'string' ? entry.url.trim() : ''
      if (!url) {
        return res.status(400).json({ message: 'Each image must include a url' })
      }

      const label = typeof entry.label === 'string' ? entry.label.trim() : null
      const sortOrder = parseSortOrder(entry.sortOrder)

      records.push({
        scenarioId,
        url,
        label,
        sortOrder: sortOrder ?? nextSortOrder,
      })

      if (sortOrder === null) {
        nextSortOrder += 1
      }
    }

    if (records.length === 0) {
      return res.status(400).json({ message: 'No valid images received' })
    }

    await ScenarioImage.bulkCreate(records)

    const images = await ScenarioImage.findAll({
      where: { scenarioId },
      order: [
        ['sortOrder', 'ASC'],
        ['createdAt', 'ASC'],
        ['id', 'ASC'],
      ],
    })

    res.status(201).json({ images })
  } catch (error) {
    next(error)
  }
}

export const getScenario = async (req, res, next) => {
  try {
    const { scenarioId } = req.params

    const scenario = await Scenario.findByPk(scenarioId, {
      include: [{ model: Campaign, as: 'campaign', attributes: ['id', 'dmId'] }],
    })

    if (!scenario) {
      return res.status(404).json({ message: 'Scenario not found' })
    }

    if (!req.user || scenario.campaign.dmId !== req.user.id) {
      return res.status(403).json({ message: 'Only the campaign DM can view this scenario' })
    }

    const detailedScenario = await Scenario.findByPk(scenarioId, {
      include: scenarioDetailInclude,
      order: scenarioDetailOrder,
    })

    res.json({ scenario: detailedScenario })
  } catch (error) {
    next(error)
  }
}

export const updateScenario = async (req, res, next) => {
  try {
    const { scenarioId } = req.params
    const {
      title,
      summary,
      environmentTags,
      triggerConditions,
      objective,
      lootTable,
      tacticalMap,
      mediaRefs,
      assignedNpcIds,
    } = req.body ?? {}

    const scenario = await Scenario.findByPk(scenarioId, {
      include: [{ model: Campaign, as: 'campaign', attributes: ['id', 'dmId'] }],
    })

    if (!scenario) {
      return res.status(404).json({ message: 'Scenario not found' })
    }

    if (!req.user || scenario.campaign.dmId !== req.user.id) {
      return res.status(403).json({ message: 'Only the campaign DM can update this scenario' })
    }

    const updates = {}

    if (title !== undefined) {
      const cleanTitle = typeof title === 'string' ? title.trim() : ''
      if (!cleanTitle) {
        return res.status(400).json({ message: 'Scenario title cannot be empty' })
      }
      updates.title = cleanTitle
    }

    if (summary !== undefined) {
      updates.summary = typeof summary === 'string' && summary.trim() ? summary.trim() : null
    }

    if (objective !== undefined) {
      updates.objective = typeof objective === 'string' && objective.trim() ? objective.trim() : null
    }

    if (environmentTags !== undefined) {
      updates.environmentTags = normalizeArrayField(environmentTags)
    }

    if (triggerConditions !== undefined) {
      updates.triggerConditions = normalizeJsonField(triggerConditions)
    }

    if (lootTable !== undefined) {
      updates.lootTable = normalizeJsonField(lootTable)
    }

    if (tacticalMap !== undefined) {
      updates.tacticalMap = normalizeJsonField(tacticalMap)
    }

    if (mediaRefs !== undefined) {
      updates.mediaRefs = normalizeJsonField(mediaRefs)
    }

    await sequelize.transaction(async (transaction) => {
      if (Object.keys(updates).length > 0) {
        await scenario.update(updates, { transaction })
      }

      if (Array.isArray(assignedNpcIds)) {
        const npcIds = Array.from(
          new Set(
            assignedNpcIds
              .filter((id) => typeof id === 'string' && id.trim())
              .map((id) => id.trim()),
          ),
        )

        const clearWhere = { campaignId: scenario.campaignId, scenarioId: scenario.id }
        if (npcIds.length > 0) {
          clearWhere.id = { [Op.notIn]: npcIds }
        }

        await Npc.update(
          { scenarioId: null },
          {
            where: clearWhere,
            transaction,
          },
        )

        if (npcIds.length > 0) {
          await Npc.update(
            { scenarioId: scenario.id },
            {
              where: { campaignId: scenario.campaignId, id: { [Op.in]: npcIds } },
              transaction,
            },
          )
        }
      }
    })

    const updatedScenario = await Scenario.findByPk(scenarioId, {
      include: scenarioDetailInclude,
      order: scenarioDetailOrder,
    })

    res.json({ scenario: updatedScenario })
  } catch (error) {
    next(error)
  }
}
