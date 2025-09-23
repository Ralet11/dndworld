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
  updateCampaign,
  updateItem,
  updateNpc,
  updateScenario,
} from '../controllers/campaignController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/', getCampaigns)
router.post('/', createCampaign)
router.get('/:campaignId', getCampaignById)
router.patch('/:campaignId', requireAuth, updateCampaign)
router.get('/:campaignId/members', requireAuth, getCampaignMembers)
router.post('/:campaignId/invite', requireAuth, inviteCampaignMember)
router.post('/:campaignId/members/:userId/accept', requireAuth, acceptCampaignInvite)
router.get('/:campaignId/npcs', requireAuth, getCampaignNpcs)
router.post('/:campaignId/scenarios', createScenario)
router.patch('/:campaignId/scenarios/:scenarioId', requireAuth, updateScenario)
router.post('/:campaignId/npcs', createNpc)
router.patch('/:campaignId/npcs/:npcId', requireAuth, updateNpc)
router.get('/:campaignId/items', requireAuth, getCampaignItems)
router.post('/:campaignId/items', requireAuth, createItem)
router.patch('/:campaignId/items/:itemId', requireAuth, updateItem)

export default router
