const router = require('express').Router();
const { auth } = require('../middleware/auth');
const ctrl = require('../controllers/newsController');

router.get('/', ctrl.listGlobal);
router.get('/:id', ctrl.getOne);
router.post('/', auth(true), ctrl.createStandalone);

module.exports = router;
