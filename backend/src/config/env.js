import dotenv from 'dotenv'

dotenv.config()

const requiredEnv = (key) => {
  const value = process.env[key]
  if (!value) {
    throw new Error("Missing required environment variable" )
  }
  return value
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL,
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  get isUsingUrl() {
    return Boolean(this.databaseUrl)
  },
  ensureCore() {
    if (this.isUsingUrl) {
      requiredEnv('DATABASE_URL')
      return
    }

    this.db.host ??= 'localhost'
    this.db.name ??= 'dungeonworld'
    this.db.user ??= 'postgres'
    this.db.password ??= 'postgres'
  },
}
