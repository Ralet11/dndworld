const router = require("express").Router();
const ctrl = require("../controllers/catalogController");
const { auth } = require("../middleware/auth");

router.get("/races", auth(false), ctrl.listRaces);
router.get("/races/:id", auth(false), ctrl.getRace);
router.get("/classes", auth(false), ctrl.listClasses);
router.get("/classes/:id", auth(false), ctrl.getClass);
router.get("/classes/:id/talents", auth(false), ctrl.getClassTalents);
router.get("/abilities", auth(false), ctrl.listAbilities);
router.get("/cards/:id", auth(false), ctrl.getCard);

module.exports = router;
