import { Router } from 'express'
import {
  acceptCampaignInvite,
  createCampaign,
  createItem,
  createNpc,
  createScenario,
  getCampaignById,
  getCampaignItems,
  getCampaignMembers,
  getCampaignNpcs,
  getCampaigns,
  inviteCampaignMember,
} from '../controllers/campaignController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/', getCampaigns)
router.post('/', createCampaign)
router.get('/:campaignId', getCampaignById)
router.get('/:campaignId/members', requireAuth, getCampaignMembers)
router.post('/:campaignId/invite', requireAuth, inviteCampaignMember)
router.post('/:campaignId/members/:userId/accept', requireAuth, acceptCampaignInvite)
router.get('/:campaignId/npcs', requireAuth, getCampaignNpcs)
router.post('/:campaignId/scenarios', requireAuth, createScenario)
router.post('/:campaignId/npcs', createNpc)
router.get('/:campaignId/items', requireAuth, getCampaignItems)
router.post('/:campaignId/items', requireAuth, createItem)

export default router

