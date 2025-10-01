require("dotenv").config();
const db = require("../models");
(async () => {
  try {
    await db.ensureSchema();
    await db.sequelize.sync({ alter: true });
    console.log("Synced successfully");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
