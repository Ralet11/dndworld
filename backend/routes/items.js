const router = require("express").Router();
const { auth, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/itemsController");

router.use(auth(true));

router.post("/", requireRole("DM"), ctrl.createItem);
router.get("/", ctrl.listItems);
router.get("/:id", ctrl.getItem);
router.patch("/:id", requireRole("DM"), ctrl.patchItem);
router.delete("/:id", requireRole("DM"), ctrl.deleteItem);

module.exports = router;
