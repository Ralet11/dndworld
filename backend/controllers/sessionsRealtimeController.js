const {
  Session,
  SessionParticipant,
  ScenarioLayer,
  Map,
  Campaign,
  DmMessage,
} = require('../models');
const { io } = require('../realtime/io');

async function getMe(req, res, next) {
  try {
    const sessionId = req.params.id;
    const userId = req.user.id;

    const participant = await SessionParticipant.findOne({ where: { sessionId, userId } });
    if (!participant) return res.status(403).json({ error: 'No estás en esta sesión' });

    const session = await Session.findByPk(sessionId);
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });

    const payload = {
      roleInSession: participant.role,
      campaignId: session.campaignId,
      activeLayerId: session.activeLayerId || null,
      activeMapId: session.activeMapId || null,
    };

    if (participant.role === 'PLAYER') payload.characterId = participant.characterId || null;

    return res.json(payload);
  } catch (error) {
    next(error);
  }
}

async function getLayers(req, res, next) {
  try {
    const session = await Session.findByPk(req.params.id);
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (!session.scenarioId) return res.json([]);

    const layers = await ScenarioLayer.findAll({
      where: { scenarioId: session.scenarioId },
      order: [['sortOrder', 'ASC']],
    });

    return res.json(layers);
  } catch (error) {
    next(error);
  }
}

async function getParticipants(req, res, next) {
  try {
    const sessionId = req.params.id;
    const participants = await SessionParticipant.findAll({
      where: { sessionId },
      order: [['createdAt', 'ASC']],
    });

    return res.json(
      participants.map((p) => ({
        id: p.id,
        userId: p.userId,
        userName: p.userName || null,
        role: p.role,
        characterId: p.characterId || null,
        status: p.status || 'online',
      })),
    );
  } catch (error) {
    next(error);
  }
}

async function ensureDmAccess(sessionId, user) {
  const participant = await SessionParticipant.findOne({ where: { sessionId, userId: user.id, role: 'DM' } });
  if (participant) return true;

  if (user.roles?.includes('ADMIN')) return true;

  const session = await Session.findByPk(sessionId);
  if (!session) return false;
  const campaign = await Campaign.findByPk(session.campaignId);
  if (campaign?.ownerDmId === user.id) return true;

  return false;
}

async function changeLayer(req, res, next) {
  try {
    const sessionId = req.params.id;
    const { layerId } = req.body;
    if (!layerId) return res.status(400).json({ error: 'layerId requerido' });

    const hasAccess = await ensureDmAccess(sessionId, req.user);
    if (!hasAccess) return res.status(403).json({ error: 'Solo el DM puede cambiar de capa' });

    const session = await Session.findByPk(sessionId);
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });

    const layer = await ScenarioLayer.findByPk(layerId);
    if (!layer) return res.status(404).json({ error: 'Capa no encontrada' });

    if (session.scenarioId && layer.scenarioId !== session.scenarioId) {
      return res.status(400).json({ error: 'La capa no pertenece a la sesión' });
    }

    session.activeLayerId = layer.id;

    if (layer.layerType === 'TACTICAL') {
      const map = await Map.findOne({ where: { layerId: layer.id } });
      session.activeMapId = map ? map.id : null;
    } else {
      session.activeMapId = null;
    }

    await session.save();

    try {
      io().to(`session:${sessionId}`).emit('session:layer-changed', { mapId: session.activeMapId });
    } catch (err) {
      console.warn('socket emit failed', err.message);
    }

    return res.json({ ok: true, activeLayerId: session.activeLayerId, activeMapId: session.activeMapId });
  } catch (error) {
    next(error);
  }
}

async function getDmMessage(req, res, next) {
  try {
    const sessionId = req.params.id;
    const message = await DmMessage.findOne({ where: { sessionId } });
    return res.json(message || { text: '' });
  } catch (error) {
    next(error);
  }
}

async function postDmMessage(req, res, next) {
  try {
    const sessionId = req.params.id;
    const { text } = req.body || {};

    const hasAccess = await ensureDmAccess(sessionId, req.user);
    if (!hasAccess) return res.status(403).json({ error: 'Solo DM' });

    const [message] = await DmMessage.findOrCreate({
      where: { sessionId },
      defaults: { text: text || '' },
    });

    message.text = text || '';
    await message.save();

    try {
      io().to(`session:${sessionId}`).emit('dm:message', { text: message.text });
    } catch (err) {
      console.warn('socket emit failed', err.message);
    }

    return res.json({ ok: true, text: message.text });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMe,
  getLayers,
  getParticipants,
  changeLayer,
  getDmMessage,
  postDmMessage,
};
