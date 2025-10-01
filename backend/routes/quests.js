const router = require("express").Router();
const { auth, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/questsController");

router.use(auth(true));

router.post("/", requireRole("DM"), ctrl.createQuest);
router.get("/", ctrl.listQuests);
router.get("/:id", ctrl.getQuest);
router.patch("/:id", requireRole("DM"), ctrl.patchQuest);
router.delete("/:id", requireRole("DM"), ctrl.deleteQuest);

router.post("/:id/steps", requireRole("DM"), ctrl.addStep);
router.post("/:id/rewards", requireRole("DM"), ctrl.addReward);
router.delete("/steps/:stepId", requireRole("DM"), ctrl.deleteStep);
router.delete("/rewards/:rewardId", requireRole("DM"), ctrl.deleteReward);

router.post("/complete/:sessionId/:questId", requireRole("DM"), ctrl.completeQuestInSession);

module.exports = router;
