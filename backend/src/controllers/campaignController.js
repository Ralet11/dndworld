import { Campaign } from '../models/Campaign.js'
import { Npc } from '../models/Npc.js'
import { Scenario } from '../models/Scenario.js'
import { User } from '../models/User.js'

export const getCampaigns = async (_req, res, next) => {
  try {
    const campaigns = await Campaign.findAll({
      include: [
        { model: User, as: 'dm', attributes: ['id', 'username', 'displayName'] },
        { model: Scenario, as: 'scenarios', attributes: ['id', 'title'] },
        { model: Npc, as: 'npcs', attributes: ['id', 'name', 'disposition'] },
      ],
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
      include: [
        { model: User, as: 'dm', attributes: ['id', 'username', 'displayName'] },
        { model: Scenario, as: 'scenarios' },
        { model: Npc, as: 'npcs' },
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
