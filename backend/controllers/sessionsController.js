const {
  Session, SessionParticipant, Campaign, Creature, CreatureResource, Character, Ability, AbilityCost, Card, CharacterCard, CharacterDeck
} = require("../models");
const { createNewsEntry } = require("../services/newsService");

exports.createSession = async (req, res, next) => {
  try {
    const camp = await Campaign.findByPk(req.params.campaignId);
    if (!camp) return res.status(404).json({ error:"Campaign not found" });
    if (camp.ownerDmId !== req.user.id && !req.user.roles.includes("ADMIN")) return res.status(403).json({ error:"Forbidden" });
    const row = await Session.create({ campaignId: camp.id, startedAt: new Date() });
    res.json(row);
  } catch (e) { next(e); }
};

exports.getSession = async (req, res, next) => {
  try {
    const row = await Session.findByPk(req.params.sessionId);
    if (!row) return res.status(404).json({ error:"Not found" });
    res.json(row);
  } catch (e) { next(e); }
};

exports.endSession = async (req, res, next) => {
  try {
    const row = await Session.findByPk(req.params.sessionId);
    if (!row) return res.status(404).json({ error:"Not found" });
    row.endedAt = new Date();
    await row.save();

    let newsRow = null;
    const news = req.body?.news;
    if (news?.title && news?.summary) {
      try {
        newsRow = await createNewsEntry({
          campaignId: row.campaignId,
          kind: news.kind,
          title: news.title,
          summary: news.summary,
          body: news.body,
          images: news.images,
          characters: news.characters,
          npcs: news.npcs,
          tags: news.tags,
          extra: { sessionId: row.id },
        });
      } catch (err) {
        console.warn('Failed to create session news', err.message);
      }
    }

    const plain = row.toJSON();
    if (newsRow) plain.newsId = newsRow.id;
    res.json(plain);
  } catch (e) { next(e); }
};

exports.listParticipants = async (req, res, next) => {
  try {
    const list = await SessionParticipant.findAll({ where:{ sessionId: req.params.sessionId } });
    res.json(list);
  } catch (e) { next(e); }
};

exports.addParticipant = async (req, res, next) => {
  try {
    const row = await SessionParticipant.create({ sessionId: req.params.sessionId, creatureId: req.body.creatureId });
    res.json(row);
  } catch (e) { next(e); }
};

// Placeholder for broadcasting active layer; here we just echo.
exports.setLayer = async (req, res, next) => {
  try {
    res.json({ ok:true, scenarioId: req.body.scenarioId, layerId: req.body.layerId });
  } catch (e) { next(e); }
};

exports.changeHp = async (req, res, next) => {
  try {
    const creature = await Creature.findByPk(req.params.creatureId);
    if (!creature) return res.status(404).json({ error:"Creature not found" });
    // For demo: we don't store current HP separately; would be in a combat state table.
    res.json({ ok:true, note:"Implement current HP tracking table if needed", delta: req.body.delta });
  } catch (e) { next(e); }
};

exports.playCard = async (req, res, next) => {
  try {
    const { sessionId, characterId } = req.params;
    // Validate ownership of character
    const ch = await Character.findByPk(characterId);
    if (!ch) return res.status(404).json({ error:"Character not found" });
    if (ch.userId !== req.user.id && !req.user.roles.includes("DM") && !req.user.roles.includes("ADMIN"))
      return res.status(403).json({ error:"Forbidden" });
    const { cardId } = req.body;
    const card = await Card.findByPk(cardId, { include:[Ability] });
    if (!card) return res.status(404).json({ error:"Card not found" });
    // Fetch costs
    const costs = await AbilityCost.findAll({ where:{ abilityId: card.abilityId } });
    // find resources for this character
    const resRows = await CreatureResource.findAll({ where:{ creatureId: characterId } });
    // validate and deduct
    for (const c of costs) {
      const resRow = resRows.find(r => r.resource === c.resource);
      if (!resRow || resRow.current < c.amount) return res.status(400).json({ error:`Not enough ${c.resource}` });
    }
    for (const c of costs) {
      const resRow = resRows.find(r => r.resource === c.resource);
      resRow.current -= c.amount; await resRow.save();
    }
    // In a real engine, apply effects to targets etc.
    res.json({ ok:true, note:"Card played", ability: card.Ability.name, costs: costs.map(c=>({resource:c.resource, amount:c.amount})) });
  } catch (e) { next(e); }
};



