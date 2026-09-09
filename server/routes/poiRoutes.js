const express = require('express');
const router = express.Router();
const poiController = require('../controllers/poiController');
const { verifyToken } = require('../middleware/auth');
const { requireCampaign, requireCampaignDm } = require('../middleware/campaignContext');

router.use(verifyToken, requireCampaign);

// GET all points of interest
router.get('/', poiController.getAllPointsOfInterest);

// POST a new point of interest
router.post('/', requireCampaignDm, poiController.createPointOfInterest);

// PUT update an existing point of interest
router.put('/:id', requireCampaignDm, poiController.updatePointOfInterest);

// Lore specific endpoints
// Fetch all lore data for a POI for the logged-in user
router.get('/:id/lore', poiController.getPoiLore);

// Update global lore (dmDescription, partyKnowledge)
router.put('/:id/global-lore', requireCampaignDm, poiController.updateGlobalLore);

// Update current player's personal notes 
router.put('/:id/user-notes', poiController.updateUserNotes);

module.exports = router;

