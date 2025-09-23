import { Router } from 'express'
import authRouter from './auth.js'
import campaignsRouter from './campaigns.js'
import scenariosRouter from './scenarios.js'

const router = Router()

router.use('/auth', authRouter)
router.use('/campaigns', campaignsRouter)
router.use('/scenarios', scenariosRouter)

export default router
