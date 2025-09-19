import { Sequelize } from 'sequelize'
import { env } from '../config/env.js'


env.ensureCore()

console.log(env.db.password)

const baseOptions = {
  dialect: 'postgres',
  logging: env.nodeEnv === 'development' ? console.log : false,
  define: {
    underscored: true,
    paranoid: false,
    timestamps: true,
  },
}

export const sequelize = env.isUsingUrl
  ? new Sequelize(env.databaseUrl, baseOptions)
  : new Sequelize(env.db.name, env.db.user, env.db.password, {
      ...baseOptions,
      host: env.db.host,
      port: env.db.port,
    })

export const connectToDatabase = async () => {
  try {
    await sequelize.authenticate()
    console.info('Database connection established successfully.')
  } catch (error) {
    console.error('Unable to connect to the database:', error)
    throw error
  }
}
