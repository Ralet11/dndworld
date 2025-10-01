const router = require("express").Router();
const { auth, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/campaignsController");

router.get("/:id/news", auth(false), ctrl.listNews);

router.use(auth(true));

router.post("/", requireRole("DM"), ctrl.createCampaign);
router.get("/", ctrl.listCampaigns);
router.get("/:id", ctrl.getCampaign);
router.patch("/:id", requireRole("DM"), ctrl.patchCampaign);

router.post("/:id/invites", requireRole("DM"), ctrl.createInvite);
router.post("/:id/requests", ctrl.requestJoin);

router.post("/:id/members", requireRole("DM"), ctrl.addMember);
router.patch("/:id/members/:memberId", requireRole("DM"), ctrl.patchMember);
router.delete("/:id/members/:memberId", requireRole("DM"), ctrl.deleteMember);

router.post("/:id/news", requireRole("DM"), ctrl.createNews);

module.exports = router;
