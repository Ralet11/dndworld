const test = require('node:test');
const assert = require('node:assert/strict');
const { assertLocalDatabase, initializeDatabase } = require('../utils/localDatabaseSafety');

test('startup only authenticates by default, without mutating the schema', async () => {
    const calls = [];
    await initializeDatabase({ authenticate: async () => calls.push('authenticate'), sync: async () => calls.push('sync') }, {});
    assert.deepEqual(calls, ['authenticate']);
});

test('local schema initialization requires explicit opt-in', async () => {
    let options;
    await initializeDatabase({ sync: async value => { options = value; } }, { DB_SYNC_MODE: 'alter', DB_HOST: '127.0.0.1' });
    assert.deepEqual(options, { alter: true });
});

test('schema changes and seeds reject production or remote databases', async () => {
    for (const env of [{ NODE_ENV: 'production' }, { DB_HOST: 'db.example.com' }]) {
        assert.throws(() => assertLocalDatabase(env), /restricted/);
        await assert.rejects(initializeDatabase({}, { ...env, DB_SYNC_MODE: 'alter' }), /restricted/);
    }
});

test('unknown schema mode fails closed', async () => {
    await assert.rejects(initializeDatabase({}, { DB_SYNC_MODE: 'force' }), /must be none or alter/);
});
