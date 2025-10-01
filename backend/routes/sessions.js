const router = require("express").Router();
const { auth, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/sessionsController");

router.use(auth(true));

router.post("/:campaignId", requireRole("DM"), ctrl.createSession);
router.get("/:sessionId", ctrl.getSession);
router.post("/:sessionId/end", requireRole("DM"), ctrl.endSession);

router.get("/:sessionId/participants", ctrl.listParticipants);
router.post("/:sessionId/participants", requireRole("DM"), ctrl.addParticipant);

router.post("/:sessionId/layer", requireRole("DM"), ctrl.setLayer);

router.post("/:sessionId/creatures/:creatureId/hp", requireRole("DM"), ctrl.changeHp);
router.post("/:sessionId/characters/:characterId/play-card", ctrl.playCard);

module.exports = router;
