const { CampaignNews, Campaign } = require('../models');
const { serializeNews } = require('../services/newsFormatter');
const { createNewsEntry } = require('../services/newsService');

exports.listGlobal = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const rows = await CampaignNews.findAll({
      include: [{ model: Campaign, attributes: ['id', 'name', 'status'] }],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
    const serialized = await serializeNews(rows);
    res.json(serialized);
  } catch (error) {
    next(error);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const row = await CampaignNews.findByPk(req.params.id, {
      include: [{ model: Campaign, attributes: ['id', 'name', 'status'] }],
    });
    if (!row) return res.status(404).json({ error: 'Not found' });
    const serialized = await serializeNews(row);
    res.json(serialized);
  } catch (error) {
    next(error);
  }
};

exports.createStandalone = async (req, res, next) => {
  try {
    if (!req.user || !req.user.roles?.includes('DM')) {
      return res.status(403).json({ error: 'Solo DMs pueden publicar noticias globales.' });
    }
    const row = await createNewsEntry({
      campaignId: req.body.campaignId,
      kind: req.body.kind,
      title: req.body.title,
      summary: req.body.summary,
      body: req.body.body,
      images: req.body.images,
      characters: req.body.characters,
      npcs: req.body.npcs,
      tags: req.body.tags,
      extra: {
        sessionId: req.body.sessionId || null,
        questId: req.body.questId || null,
      },
    });
    const fresh = await CampaignNews.findByPk(row.id, {
      include: [{ model: Campaign, attributes: ['id', 'name', 'status'] }],
    });
    const serialized = await serializeNews(fresh);
    res.status(201).json(serialized);
  } catch (error) {
    next(error);
  }
};
