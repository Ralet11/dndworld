const { Op } = require("sequelize");
const {
  Campaign, CampaignMembership, CampaignInvite, CampaignNews,
  Character, User
} = require("../models");
const { serializeNews } = require("../services/newsFormatter");
const { createNewsEntry } = require("../services/newsService");

exports.createCampaign = async (req, res, next) => {
  try {
    const row = await Campaign.create({ name: req.body.name, description: req.body.description || null, ownerDmId: req.user.id, status:"DRAFT", notesAssetId: req.body.notesAssetId || null });
    res.json(row);
  } catch (e) { next(e); }
};

exports.listCampaigns = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.role === "DM") where.ownerDmId = req.user.id;
    const list = await Campaign.findAll({ where, order:[["createdAt","DESC"]] });
    res.json(list);
  } catch (e) { next(e); }
};

exports.getCampaign = async (req, res, next) => {
  try {
    const row = await Campaign.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error:"Not found" });
    res.json(row);
  } catch (e) { next(e); }
};

exports.patchCampaign = async (req, res, next) => {
  try {
    const row = await Campaign.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error:"Not found" });
    if (row.ownerDmId !== req.user.id && !req.user.roles.includes("ADMIN")) return res.status(403).json({ error:"Forbidden" });
    if (req.body.status) row.status = req.body.status;
    if (req.body.description !== undefined) row.description = req.body.description;
    await row.save(); res.json(row);
  } catch (e) { next(e); }
};

exports.createInvite = async (req, res, next) => {
  try {
    const token = Math.random().toString(36).slice(2);
    const inv = await CampaignInvite.create({ campaignId: req.params.id, email: req.body.email, invitedBy: req.user.id, token, accepted:false });
    res.json(inv);
  } catch (e) { next(e); }
};

exports.requestJoin = async (req, res, next) => {
  try {
    // For simplicity: create a membership with status "PENDING"
    const mem = await CampaignMembership.create({ campaignId: req.params.id, userId: req.user.id, role:"PLAYER", status:"PENDING" });
    res.json(mem);
  } catch (e) { next(e); }
};

exports.addMember = async (req, res, next) => {
  try {
    const { userId, role = "PLAYER", characterId = null } = req.body;
    const mem = await CampaignMembership.create({ campaignId: req.params.id, userId, role, characterId, status:"ACTIVE" });
    res.json(mem);
  } catch (e) { next(e); }
};

exports.patchMember = async (req, res, next) => {
  try {
    const row = await CampaignMembership.findByPk(req.params.memberId);
    if (!row) return res.status(404).json({ error:"Not found" });
    if (req.body.characterId !== undefined) row.characterId = req.body.characterId;
    if (req.body.status !== undefined) row.status = req.body.status;
    await row.save(); res.json(row);
  } catch (e) { next(e); }
};

exports.deleteMember = async (req, res, next) => {
  try { await CampaignMembership.destroy({ where:{ id: req.params.memberId } }); res.json({ ok: true }); } catch (e) { next(e); }
};

exports.listNews = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const list = await CampaignNews.findAll({
      where: { campaignId: req.params.id },
      include: [{ model: Campaign, attributes: ['id', 'name', 'status'] }],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
    const serialized = await serializeNews(list);
    res.json(serialized);
  } catch (e) { next(e); }
};

exports.createNews = async (req, res, next) => {
  try {
    const payload = (req.body && typeof req.body.payload === 'object') ? req.body.payload : {};
    const row = await createNewsEntry({
      campaignId: req.params.id,
      kind: req.body.kind,
      title: req.body.title,
      summary: req.body.summary,
      body: req.body.body ?? payload.body,
      images: req.body.images ?? payload.images,
      characters: req.body.characters ?? payload.characters,
      npcs: req.body.npcs ?? payload.npcs,
      tags: req.body.tags ?? payload.tags,
      extra: {
        sessionId: req.body.sessionId ?? payload.sessionId ?? null,
        questId: req.body.questId ?? payload.questId ?? null,
      },
    });
    const fresh = await CampaignNews.findByPk(row.id, {
      include: [{ model: Campaign, attributes: ['id', 'name', 'status'] }],
    });
    const serialized = await serializeNews(fresh);
    res.status(201).json(serialized);
  } catch (e) {
    if (!e.status) e.status = 400;
    next(e);
  }
};




