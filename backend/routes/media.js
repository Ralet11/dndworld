const router = require("express").Router();
const multer = require("multer");
const { auth } = require("../middleware/auth");
const ctrl = require("../controllers/mediaController");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(auth(true));

router.post("/", upload.single("file"), ctrl.createMedia);
router.get("/:id", ctrl.getMedia);

module.exports = router;
