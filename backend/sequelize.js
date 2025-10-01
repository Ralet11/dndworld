const { Sequelize } = require("sequelize");

const {
  DATABASE_URL,
  DB_HOST = "localhost",
  DB_PORT = "5432",
  DB_USER = "postgres",
  DB_PASS = "postgres",
  DB_NAME = "dungeonworld",
  DB_SSL = "false",
} = process.env;

const useUrl = !!(DATABASE_URL && DATABASE_URL.length);
const sequelize = new Sequelize(
  useUrl ? DATABASE_URL : DB_NAME,
  useUrl ? undefined : DB_USER,
  useUrl ? undefined : DB_PASS,
  {
    dialect: "postgres",
    host: useUrl ? undefined : DB_HOST,
    port: useUrl ? undefined : Number(DB_PORT),
logging: console.log,
    dialectOptions: {
      ssl: DB_SSL === "true" ? { require: true, rejectUnauthorized: false } : undefined
    },
    define: { schema: "dwd", freezeTableName: true, timestamps: true }
  }
);

async function ensureSchema() {
  await sequelize.query('CREATE SCHEMA IF NOT EXISTS "dwd";');
}

module.exports = { sequelize, ensureSchema };
