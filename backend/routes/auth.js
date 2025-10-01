const router = require("express").Router();
const ctrl = require("../controllers/authController");
const { auth, requireRole } = require("../middleware/auth");

router.post("/signup", ctrl.signup);
router.post("/login", ctrl.login);
router.get("/me", auth(true), ctrl.me);
router.post("/request-dm", auth(true), ctrl.requestDm);
router.patch("/dm-applications/:id", auth(true), requireRole("ADMIN"), ctrl.reviewDm);

module.exports = router;
