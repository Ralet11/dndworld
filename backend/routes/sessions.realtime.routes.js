const router = require('express').Router();
const { auth } = require('../middleware/auth');
const controller = require('../controllers/sessionsRealtimeController');

router.use(auth(true));

router.get('/sessions/:id/me', controller.getMe);
router.get('/sessions/:id/layers', controller.getLayers);
router.get('/sessions/:id/participants', controller.getParticipants);

router.post('/sessions/:id/change-layer', controller.changeLayer);

router.get('/sessions/:id/dm-message', controller.getDmMessage);
router.post('/sessions/:id/dm-message', controller.postDmMessage);

module.exports = router;
