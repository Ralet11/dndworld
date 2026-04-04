const express = require('express');
const router = express.Router();
const poiController = require('../controllers/poiController');
const { verifyToken } = require('../middleware/auth');

// GET all points of interest
router.get('/', poiController.getAllPointsOfInterest);

// POST a new point of interest
router.post('/', poiController.createPointOfInterest);

// PUT update an existing point of interest
router.put('/:id', poiController.updatePointOfInterest);

// Lore specific endpoints
// Fetch all lore data for a POI for the logged-in user
router.get('/:id/lore', verifyToken, poiController.getPoiLore);

// Update global lore (dmDescription, partyKnowledge)
router.put('/:id/global-lore', verifyToken, poiController.updateGlobalLore);

// Update current player's personal notes 
router.put('/:id/user-notes', verifyToken, poiController.updateUserNotes);

module.exports = router;

