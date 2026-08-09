require('dotenv').config();

const sequelize = require('../config/database');
const { loadSession } = require('../sockets/gameSessionSocket');

function megabytes(bytes) {
    return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

async function run() {
    const sessionId = process.argv[2];
    if (!sessionId) throw new Error('Debes indicar el ID de la sesión.');
    if (global.gc) global.gc();
    const before = process.memoryUsage();
    const startedAt = Date.now();
    const session = await loadSession(sessionId);
    if (!session) throw new Error('Sesión no encontrada.');
    const payload = session.toJSON();
    const jsonBytes = Buffer.byteLength(JSON.stringify(payload));
    if (global.gc) global.gc();
    const after = process.memoryUsage();
    console.log(JSON.stringify({
        elapsedMs: Date.now() - startedAt,
        jsonMegabytes: megabytes(jsonBytes),
        heapBeforeMegabytes: megabytes(before.heapUsed),
        heapAfterMegabytes: megabytes(after.heapUsed),
        heapDeltaMegabytes: megabytes(after.heapUsed - before.heapUsed),
        counts: {
            participants: payload.participants?.length || 0,
            tokens: payload.tokens?.length || 0,
            assets: payload.assets?.length || 0,
            rolls: payload.rolls?.length || 0,
            annotations: payload.stage_annotations?.length || 0,
        },
    }, null, 2));
}

run()
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => sequelize.close());
