const { CampaignNews } = require('../models');

const ALLOWED_KINDS = new Set([
  'MONSTER_SIGHTING',
  'BOSS_DEFEATED',
  'DISCOVERY',
  'QUEST_COMPLETED',
]);

function pickKind(requestedKind) {
  if (requestedKind && ALLOWED_KINDS.has(requestedKind)) return requestedKind;
  return 'DISCOVERY';
}

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value].filter(Boolean);
}

async function createNewsEntry({
  campaignId,
  kind,
  title,
  summary,
  body,
  images,
  characters,
  npcs,
  tags,
  extra,
}) {
  if (!campaignId) throw new Error('campaignId requerido');
  if (!title) throw new Error('title requerido');
  if (!summary) throw new Error('summary requerido');

  const payload = {
    body: typeof body === 'string' && body.length ? body : null,
    images: normalizeList(images),
    characters: normalizeList(characters),
    npcs: normalizeList(npcs),
    tags: normalizeList(tags),
    ...(extra || {}),
  };

  const row = await CampaignNews.create({
    campaignId,
    kind: pickKind(kind),
    title,
    summary,
    payload,
  });

  return row;
}

module.exports = {
  createNewsEntry,
};
