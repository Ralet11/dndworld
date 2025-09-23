import { Campaign } from '../models/Campaign.js'
import { Scenario } from '../models/Scenario.js'
import { ScenarioImage } from '../models/ScenarioImage.js'

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
