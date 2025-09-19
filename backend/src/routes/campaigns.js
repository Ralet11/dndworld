import { Router } from 'express'
import { getCampaignById, getCampaigns } from '../controllers/campaignController.js'

const router = Router()

router.get('/', getCampaigns)
router.get('/:campaignId', getCampaignById)

export default router
