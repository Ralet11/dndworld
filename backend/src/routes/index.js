import { Router } from 'express'
import campaignsRouter from './campaigns.js'

const router = Router()

router.use('/campaigns', campaignsRouter)

export default router
