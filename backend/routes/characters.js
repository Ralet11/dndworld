const router = require("express").Router();
const { auth } = require("../middleware/auth");
const ctrl = require("../controllers/charactersController");

router.use(auth(true));

router.post("/", ctrl.createCharacter);
router.get("/mine", ctrl.listMine);
router.get("/:id", ctrl.getCharacter);
router.patch("/:id", ctrl.updateCharacter);

router.post("/:id/attributes", ctrl.setAttributes);
router.get("/:id/resources", ctrl.getResources);
router.patch("/:id/resources", ctrl.patchResources);

router.get("/:id/wallet", ctrl.getWallet);
router.patch("/:id/wallet", ctrl.patchWallet);
router.post("/:id/respec", ctrl.respec);

router.get("/:id/talents", ctrl.getTalents);
router.post("/:id/talents/assign", ctrl.assignTalent);

router.get("/:id/pool", ctrl.getPool);
router.post("/:id/choices", ctrl.createChoice);
router.post("/:id/choices/:offerId/select", ctrl.selectChoice);

router.get("/:id/decks", ctrl.listDecks);
router.post("/:id/decks", ctrl.createDeck);
router.get("/decks/:deckId/cards", ctrl.listDeckCards);
router.post("/decks/:deckId/cards", ctrl.addDeckCard);
router.patch("/decks/:deckId/cards/:deckCardId", ctrl.patchDeckCard);
router.delete("/decks/:deckId/cards/:deckCardId", ctrl.deleteDeckCard);

router.get("/:id/inventory", ctrl.listInventory);
router.post("/:id/inventory", ctrl.addInventoryItem);
router.patch("/inventory/:invId", ctrl.patchInventoryItem);
router.delete("/inventory/:invId", ctrl.deleteInventoryItem);

module.exports = router;
