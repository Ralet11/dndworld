const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function assertLocalDatabase(env, operation = 'Schema change') {
    if (env.NODE_ENV === 'production' || !LOCAL_HOSTS.has(env.DB_HOST || 'localhost')) {
        throw new Error(`${operation} is restricted to a local development database. Use a reviewed migration for deployed databases.`);
    }
}

async function initializeDatabase(sequelize, env) {
    const mode = env.DB_SYNC_MODE || 'none';
    if (!['none', 'alter'].includes(mode)) {
        throw new Error('DB_SYNC_MODE must be none or alter.');
    }
    if (mode === 'alter') {
        assertLocalDatabase(env);
        return sequelize.sync({ alter: true });
    }
    return sequelize.authenticate();
}

module.exports = { assertLocalDatabase, initializeDatabase };
