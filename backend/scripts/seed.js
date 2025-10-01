require("dotenv").config();
const db = require("../models");
(async () => {
  try {
    await db.ensureSchema();
    await db.sequelize.authenticate();
    // Example seeds minimal
    const [raceHuman] = await db.Race.findOrCreate({ where:{ name:"Humano" }, defaults:{ description:"Versátil" } });
    const [classWarrior] = await db.Class.findOrCreate({ where:{ name:"Guerrero" }, defaults:{ description:"Lucha cuerpo a cuerpo" } });
    const [abilityStrike] = await db.Ability.findOrCreate({ where:{ name:"Golpe Preciso" }, defaults:{ description:"Inflige daño físico", speed:"ACTION", baseCopies:4 } });
    await db.AbilityCost.findOrCreate({ where:{ abilityId: abilityStrike.id, resource:"ENERGY" }, defaults:{ amount: 2 } });
    await db.ClassAbility.findOrCreate({ where:{ classId: classWarrior.id, abilityId: abilityStrike.id }, defaults:{ levelAvailable:1 } });
    console.log("Seed OK");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
