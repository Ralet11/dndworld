const { Op } = require('sequelize');
const {
  Campaign,
  CampaignNews,
  Character,
  Creature,
  Npc,
  MediaAsset,
} = require('../models');

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value].filter(Boolean);
}

function baseInfoFromCampaign(row) {
  if (!row?.Campaign && !row?.dataValues?.Campaign) return null;
  const campaign = row.Campaign || row.dataValues.Campaign;
  if (!campaign) return null;
  return {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status || null,
  };
}

function toCharacterSnapshot(ch) {
  const creature = ch.Creature || ch.dataValues?.Creature || {};
  return {
    id: ch.id,
    name: creature.name || null,
    portraitAssetId: creature.portraitAssetId || null,
  };
}

function toNpcSnapshot(npc) {
  const creature = npc.Creature || npc.dataValues?.Creature || {};
  return {
    id: npc.id,
    name: creature.name || null,
    portraitAssetId: creature.portraitAssetId || null,
  };
}

function toMediaSnapshot(asset) {
  return {
    id: asset.id,
    kind: asset.kind,
    url: asset.url,
    meta: asset.meta || {},
  };
}

async function buildLookups(rows) {
  const characterIds = new Set();
  const npcIds = new Set();
  const mediaIds = new Set();

  rows.forEach((row) => {
    const payload = row.payload || {};
    normalizeArray(payload.characters).forEach((id) => characterIds.add(id));
    normalizeArray(payload.npcs).forEach((id) => npcIds.add(id));
    normalizeArray(payload.images).forEach((id) => mediaIds.add(id));
  });

  const [characters, npcs, mediaAssets] = await Promise.all([
    characterIds.size
      ? Character.findAll({
          where: { id: { [Op.in]: Array.from(characterIds) } },
          include: [{ model: Creature, attributes: ['id', 'name', 'portraitAssetId'] }],
        })
      : Promise.resolve([]),
    npcIds.size
      ? Npc.findAll({
          where: { id: { [Op.in]: Array.from(npcIds) } },
          include: [{ model: Creature, attributes: ['id', 'name', 'portraitAssetId'] }],
        })
      : Promise.resolve([]),
    mediaIds.size
      ? MediaAsset.findAll({ where: { id: { [Op.in]: Array.from(mediaIds) } } })
      : Promise.resolve([]),
  ]);

  return {
    characters: new Map(characters.map((ch) => [ch.id, toCharacterSnapshot(ch)])),
    npcs: new Map(npcs.map((npc) => [npc.id, toNpcSnapshot(npc)])),
    media: new Map(mediaAssets.map((asset) => [asset.id, toMediaSnapshot(asset)])),
  };
}

function mapNewsRow(row, lookups) {
  const payload = row.payload || {};
  const characters = normalizeArray(payload.characters)
    .map((id) => lookups.characters.get(id))
    .filter(Boolean);
  const npcs = normalizeArray(payload.npcs)
    .map((id) => lookups.npcs.get(id))
    .filter(Boolean);
  const images = normalizeArray(payload.images)
    .map((id) => lookups.media.get(id))
    .filter(Boolean);

  return {
    id: row.id,
    campaign: baseInfoFromCampaign(row),
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    body: typeof payload.body === 'string' ? payload.body : null,
    tags: normalizeArray(payload.tags),
    images,
    characters,
    npcs,
    spotlightSessionId: payload.sessionId || null,
    spotlightQuestId: payload.questId || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function serializeNews(input) {
  const rows = Array.isArray(input) ? input : [input];
  const filtered = rows.filter(Boolean);
  if (filtered.length === 0) return Array.isArray(input) ? [] : null;

  const needsCampaign = filtered.some((row) => !row.Campaign);
  if (needsCampaign) {
    const ids = filtered.filter((row) => !row.Campaign).map((row) => row.id);
    if (ids.length) {
      const withCampaign = await CampaignNews.findAll({
        where: { id: { [Op.in]: ids } },
        include: [{ model: Campaign, attributes: ['id', 'name', 'status'] }],
      });
      const map = new Map(withCampaign.map((row) => [row.id, row.Campaign]));
      filtered.forEach((row) => {
        if (!row.Campaign && map.has(row.id)) {
          row.Campaign = map.get(row.id);
        }
      });
    }
  }

  const lookups = await buildLookups(filtered);
  const serialized = filtered.map((row) => mapNewsRow(row, lookups));
  return Array.isArray(input) ? serialized : serialized[0];
}

module.exports = {
  serializeNews,
};
