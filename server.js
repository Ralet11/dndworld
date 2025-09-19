import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { connectToDatabase } from './database/sequelize.js'
import { ensureSeedData } from './database/seed.js'
import apiRouter from './routes/index.js'
import { syncDatabase } from './models/index.js'

const app = express()

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'],
  }),
)
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  })
})

app.use('/api', apiRouter)

app.use((err, _req, res, _next) => {
  console.error(err)
  const status = err.status || 500
  res.status(status).json({
    message: err.message || 'Internal server error',
  })
})

const startServer = async () => {
  try {
    await connectToDatabase()
    await syncDatabase()

    if (env.nodeEnv === 'development') {
      await ensureSeedData()
    }

    app.listen(env.port, () => {
      console.info(Backend server listening on port )
    })
  } catch (error) {
    console.error('Unable to start server', error)
    process.exit(1)
  }
}

startServer()

export default app
