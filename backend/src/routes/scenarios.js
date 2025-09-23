import { Router } from 'express'
import { addScenarioImages } from '../controllers/scenarioController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.post('/:scenarioId/images', requireAuth, addScenarioImages)

export default router
