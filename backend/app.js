require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const morgan = require("morgan");
const db = require("./models");
const { init: initRealtime } = require("./realtime/io");

const authRoutes = require("./routes/auth");
const characterRoutes = require("./routes/characters");
const catalogRoutes = require("./routes/catalog");
const campaignRoutes = require("./routes/campaigns");
const scenarioRoutes = require("./routes/scenarios");
const sessionRoutes = require("./routes/sessions");
const npcRoutes = require("./routes/npcs");
const itemRoutes = require("./routes/items");
const questRoutes = require("./routes/quests");
const mediaRoutes = require("./routes/media");
const newsRoutes = require("./routes/news");
const sessionsRealtimeRoutes = require("./routes/sessions.realtime.routes");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/characters", characterRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/scenarios", scenarioRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/npcs", npcRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/quests", questRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/news", newsRoutes);
app.use("/api", sessionsRealtimeRoutes);

// error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("ERR:", err);
  res.status(err.status || 500).json({ error: err.message || "Internal Error" });
});

let server;

async function start() {
  try {
    await db.ensureSchema();
    await db.sequelize.authenticate();
    const port = process.env.PORT || 3001;
    server = http.createServer(app);
    initRealtime(server);
    server.listen(port, () => console.log(`API running http://localhost:${port}`));
  } catch (e) {
    console.error("Startup error:", e);
    process.exit(1);
  }
}

if (require.main === module) start();

module.exports = app;


