import { Router } from 'express'
import { addScenarioImages, getScenario, updateScenario } from '../controllers/scenarioController.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/:scenarioId', requireAuth, getScenario)
router.put('/:scenarioId', requireAuth, updateScenario)
router.post('/:scenarioId/images', requireAuth, addScenarioImages)

export default router

