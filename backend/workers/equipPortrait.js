const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");
const { renderCharacterPortrait } = require("../services/portraitRenderer");

const queueName = "equip-portrait";
const redisUrl = process.env.REDIS_URL;
let connection = null;

function getConnection() {
  if (!redisUrl) {
    console.warn("REDIS_URL is not configured. Equip portrait queue is disabled.");
    return null;
  }
  if (!connection) {
    connection = new IORedis(redisUrl);
  }
  return connection;
}

let equipQueue = null;
if (redisUrl) {
  const conn = getConnection();
  if (conn) {
    equipQueue = new Queue(queueName, { connection: conn });
  }
}

async function enqueuePortraitRefresh(characterId) {
  if (!characterId) return null;
  const queue = equipQueue;
  if (!queue) return null;
  return queue.add("refresh", { characterId }, {
    jobId: `equip:${characterId}`,
    removeOnComplete: true,
    attempts: 1,
  });
}

async function startEquipWorker() {
  const conn = getConnection();
  if (!conn) {
    console.warn("Equip worker not started because REDIS_URL is missing.");
    return null;
  }
  const worker = new Worker(queueName, async (job) => {
    const { characterId } = job.data || {};
    if (!characterId) return null;
    return renderCharacterPortrait(characterId);
  }, { connection: conn });

  worker.on("failed", (job, err) => {
    console.error(`equip-portrait job ${job?.id || "unknown"} failed`, err);
  });

  return worker;
}

module.exports = {
  equipQueue,
  enqueuePortraitRefresh,
  startEquipWorker,
};

if (require.main === module) {
  startEquipWorker()
    .then(() => {
      console.log("Equip portrait worker started");
    })
    .catch((err) => {
      console.error("Failed to start equip portrait worker", err);
      process.exit(1);
    });
}
