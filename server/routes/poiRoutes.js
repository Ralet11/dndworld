const express = require('express');
const router = express.Router();
const poiController = require('../controllers/poiController');
const { verifyToken, isDm } = require('../middleware/auth');

// GET all points of interest
router.get('/', verifyToken, poiController.getAllPointsOfInterest);

// POST a new point of interest
router.post('/', verifyToken, isDm, poiController.createPointOfInterest);

// PUT update an existing point of interest
router.put('/:id', verifyToken, isDm, poiController.updatePointOfInterest);

// Lore specific endpoints
// Fetch all lore data for a POI for the logged-in user
router.get('/:id/lore', verifyToken, poiController.getPoiLore);

// Update global lore (dmDescription, partyKnowledge)
router.put('/:id/global-lore', verifyToken, isDm, poiController.updateGlobalLore);

// Update current player's personal notes 
router.put('/:id/user-notes', verifyToken, poiController.updateUserNotes);

module.exports = router;

