const { Sequelize, DataTypes } = require("sequelize");

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
  const qi = sequelize.getQueryInterface();
  try {
    const columns = await qi.describeTable('character_inventory', { schema: 'dwd' });
    if (!columns || !columns.equipped) {
      await qi.addColumn({ tableName: 'character_inventory', schema: 'dwd' }, 'equipped', {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false
      });
      await sequelize.query('UPDATE "dwd"."character_inventory" SET "equipped" = false WHERE "equipped" IS NULL;');
      await qi.changeColumn({ tableName: 'character_inventory', schema: 'dwd' }, 'equipped', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
  } catch (error) {
    const code = error?.original?.code || error?.parent?.code || error?.code;
    const message = String(error?.message || '');
    if (code !== '42P01' && !/does not exist/i.test(message)) {
      throw error;
    }
  }
}

module.exports = { sequelize, ensureSchema };
