const router = require("express").Router();
const { auth, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/npcsController");

router.use(auth(true));

router.post("/", requireRole("DM"), ctrl.createNpc);
router.get("/", ctrl.listNpcs);
router.get("/:id", ctrl.getNpc);
router.patch("/:id", requireRole("DM"), ctrl.patchNpc);
router.delete("/:id", requireRole("DM"), ctrl.deleteNpc);

router.post("/:id/sounds", requireRole("DM"), ctrl.addSound);
router.delete("/sounds/:soundId", requireRole("DM"), ctrl.deleteSound);

router.post("/:id/quests", requireRole("DM"), ctrl.attachQuest);
router.delete("/:id/quests/:questId", requireRole("DM"), ctrl.detachQuest);

module.exports = router;
