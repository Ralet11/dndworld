import { env } from '../config/env.js'
import { connectToDatabase } from '../database/sequelize.js'
import { syncDatabase } from '../models/index.js'

const run = async () => {
  try {
    await connectToDatabase()
    await syncDatabase({ alter: env.nodeEnv === 'development' })
    console.info('Database sync completed successfully')
    process.exit(0)
  } catch (error) {
    console.error('Database sync failed', error)
    process.exit(1)
  }
}

run()
