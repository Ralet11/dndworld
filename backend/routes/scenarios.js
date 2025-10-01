const router = require("express").Router();
const { auth, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/scenariosController");

router.use(auth(true));

router.post("/:campaignId", requireRole("DM"), ctrl.createScenario);
router.get("/by-campaign/:campaignId", ctrl.listScenariosByCampaign);
router.get("/:scenarioId", ctrl.getScenario);
router.delete("/:scenarioId", requireRole("DM"), ctrl.deleteScenario);

router.post("/:scenarioId/layers", requireRole("DM"), ctrl.createLayer);
router.get("/:scenarioId/layers", ctrl.listLayers);
router.patch("/layers/:layerId", requireRole("DM"), ctrl.patchLayer);
router.delete("/layers/:layerId", requireRole("DM"), ctrl.deleteLayer);

router.post("/layers/:layerId/map", requireRole("DM"), ctrl.createMap);
router.get("/maps/:mapId", ctrl.getMap);
router.patch("/maps/:mapId", requireRole("DM"), ctrl.patchMap);
router.delete("/maps/:mapId", requireRole("DM"), ctrl.deleteMap);

router.get("/maps/:mapId/tokens", ctrl.listTokens);
router.post("/maps/:mapId/tokens", requireRole("DM"), ctrl.createToken);
router.patch("/tokens/:tokenId", requireRole("DM"), ctrl.patchToken);
router.delete("/tokens/:tokenId", requireRole("DM"), ctrl.deleteToken);

module.exports = router;
