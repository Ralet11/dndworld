const { Op } = require("sequelize");
const {
  Creature, CreatureAttribute, CreatureResource, Character,
  Race, Class: Klass, Wallet, CharacterTalent, Talent,
  Ability, AbilityCost, ClassAbility, RaceAbility, Card,
  CharacterDeck, CharacterCard, Item, CharacterInventory, MediaAsset
} = require("../models");
const { pickRandom } = require("../utils/pickRandom");
const { enqueuePortraitRefresh } = require("../workers/equipPortrait");

function ensureOwner(req, character) {
  if (req.user.roles.includes("ADMIN")) return true;
  if (character.userId !== req.user.id) throw Object.assign(new Error("Forbidden"), { status:403 });
}

const CHARACTER_LIMIT = 3;

async function hasReachedCharacterLimit(userId) {
  const total = await Character.count({ where: { userId } });
  return total >= CHARACTER_LIMIT;
}

exports.__test__ = { hasReachedCharacterLimit, CHARACTER_LIMIT };

exports.createCharacter = async (req, res, next) => {
  try {
    const { name, raceId, classId, alignment, portraitAssetId, background, fears, goalsShort, goalsLong } = req.body;
    if (!name || !raceId || !classId) return res.status(400).json({ error:"Missing fields" });
    if (await hasReachedCharacterLimit(req.user.id)) {
      return res.status(400).json({ error: "Ya alcanzaste el máximo de 3 personajes." });
    }
    const cr = await Creature.create({
      kind:"CHARACTER", name, raceId, classId, alignment: alignment || null,
      portraitAssetId: portraitAssetId || null,
      background: background || null, fears: fears || null,
      goalsShort: goalsShort || null, goalsLong: goalsLong || null,
      createdBy: req.user.id
    });
    await CreatureAttribute.create({ creatureId: cr.id });
    // Default resources per class (simple demo rules)
    const resDefs = [
      { resource:"MANA", classes:["Mago","Mage"] },
      { resource:"ENERGY", classes:["Guerrero","Warrior"] },
      { resource:"SPIRIT", classes:["Druida","Druid"] },
      { resource:"SOUL", classes:["Brujo","Warlock"] }
    ];
    const klass = await Klass.findByPk(classId);
    let resType = "ENERGY";
    for (const r of resDefs) if (klass && r.classes.some(n=>klass.name.includes(n))) resType = r.resource;
    await CreatureResource.create({ creatureId: cr.id, resource: resType, current: 10, max: 10 });
    const ch = await Character.create({ id: cr.id, userId: req.user.id });
    await Wallet.create({ ownerCreatureId: cr.id, gold: 0 });
    // create default deck
    const deck = await CharacterDeck.create({ characterId: ch.id, name: "Main" });
    res.json({ characterId: ch.id, deckId: deck.id });
  } catch (e) { next(e); }
};

exports.listMine = async (req, res, next) => {
  try {
    const list = await Character.findAll({
      where:{ userId: req.user.id },
      include:[{
        model: Creature,
        include: [{ model: MediaAsset, as: "portrait" }]
      }]
    });
    res.json(list);
  } catch (e) { next(e); }
};

exports.getCharacter = async (req, res, next) => {
  try {
    const ch = await Character.findByPk(req.params.id, {
      include:[{
        model: Creature,
        include: [{ model: MediaAsset, as: "portrait" }]
      }]
    });
    if (!ch) return res.status(404).json({ error:"Not found" });
    ensureOwner(req, ch);
    res.json(ch);
  } catch (e) { next(e); }
};

exports.updateCharacter = async (req, res, next) => {
  try {
    const ch = await Character.findByPk(req.params.id, { include:[Creature] });
    if (!ch) return res.status(404).json({ error:"Not found" });
    ensureOwner(req, ch);
    const allowed = ["portraitAssetId","background","fears","goalsShort","goalsLong"];
    for (const k of allowed) if (k in req.body) ch.Creature[k] = req.body[k];
    await ch.Creature.save();
    res.json(ch);
  } catch (e) { next(e); }
};

exports.setAttributes = async (req, res, next) => {
  try {
    const ch = await Character.findByPk(req.params.id);
    if (!ch) return res.status(404).json({ error:"Not found" });
    ensureOwner(req, ch);
    const row = await CreatureAttribute.findByPk(ch.id);
    Object.assign(row, req.body);
    await row.save();
    res.json(row);
  } catch (e) { next(e); }
};

exports.getResources = async (req, res, next) => {
  try {
    const ch = await Character.findByPk(req.params.id);
    if (!ch) return res.status(404).json({ error:"Not found" });
    ensureOwner(req, ch);
    const rows = await CreatureResource.findAll({ where:{ creatureId: ch.id } });
    res.json(rows);
  } catch (e) { next(e); }
};

exports.patchResources = async (req, res, next) => {
  try {
    const ch = await Character.findByPk(req.params.id);
    if (!ch) return res.status(404).json({ error:"Not found" });
    ensureOwner(req, ch);
    const arr = req.body || [];
    for (const r of arr) {
      const row = await CreatureResource.findOne({ where:{ creatureId: ch.id, resource: r.resource } });
      if (!row) continue;
      if (typeof r.current === "number") row.current = r.current;
      if (typeof r.max === "number") row.max = r.max;
      await row.save();
    }
    res.json({ ok:true });
  } catch (e) { next(e); }
};

exports.getWallet = async (req, res, next) => {
  try {
    const ch = await Character.findByPk(req.params.id);
    if (!ch) return res.status(404).json({ error:"Not found" });
    ensureOwner(req, ch);
    const w = await Wallet.findOne({ where:{ ownerCreatureId: ch.id } });
    res.json(w);
  } catch (e) { next(e); }
};

exports.patchWallet = async (req, res, next) => {
  try {
    const ch = await Character.findByPk(req.params.id);
    if (!ch) return res.status(404).json({ error:"Not found" });
    ensureOwner(req, ch);
    const w = await Wallet.findOne({ where:{ ownerCreatureId: ch.id } });
    const delta = Number(req.body?.deltaGold || 0);
    w.gold += delta; if (w.gold < 0) w.gold = 0;
    await w.save();
    res.json(w);
  } catch (e) { next(e); }
};

exports.respec = async (req, res, next) => {
  try {
    const ch = await Character.findByPk(req.params.id);
    if (!ch) return res.status(404).json({ error:"Not found" });
    ensureOwner(req, ch);
    const w = await Wallet.findOne({ where:{ ownerCreatureId: ch.id } });
    if (w.gold < 100) return res.status(400).json({ error: "Not enough gold" });
    w.gold -= 100; await w.save();
    await CharacterTalent.destroy({ where:{ characterId: ch.id } });
    const decks = await CharacterDeck.findAll({ where:{ characterId: ch.id } });
    const deckIds = decks.map(d=>d.id);
    await CharacterCard.destroy({ where:{ deckId: { [Op.in]: deckIds } } });
    res.json({ ok: true, gold: w.gold });
  } catch (e) { next(e); }
};

exports.getTalents = async (req, res, next) => {
  try {
    const rows = await CharacterTalent.findAll({ where:{ characterId: req.params.id }, include:[Talent] });
    res.json(rows);
  } catch (e) { next(e); }
};

exports.assignTalent = async (req, res, next) => {
  try {
    const { talentId, points = 1 } = req.body;
    const ch = await Character.findByPk(req.params.id);
    if (!ch) return res.status(404).json({ error:"Not found" });
    ensureOwner(req, ch);
    const [row, created] = await CharacterTalent.findOrCreate({ where:{ characterId: ch.id, talentId }, defaults:{ characterId: ch.id, talentId, points } });
    if (!created) { row.points += points; await row.save(); }
    res.json(row);
  } catch (e) { next(e); }
};

async function getPools(characterId) {
  const creature = await Creature.findByPk(characterId);
  const classPool = await ClassAbility.findAll({ where:{ classId: creature.classId }, include:[Ability] });
  const racePool = await RaceAbility.findAll({ where:{ raceId: creature.raceId }, include:[Ability] });
  const abilities = [...classPool.map(p=>p.Ability), ...racePool.map(p=>p.Ability)];
  // unique by id
  const uniq = new Map(abilities.map(a=>[a.id, a]));
  return Array.from(uniq.values());
}

exports.getPool = async (req, res, next) => {
  try {
    const ch = await Character.findByPk(req.params.id);
    if (!ch) return res.status(404).json({ error:"Not found" });
    ensureOwner(req, ch);
    const abilities = await getPools(ch.id);
    res.json({ total: abilities.length, abilities });
  } catch (e) { next(e); }
};

// In-memory offers (demo) - in prod use a table
const offers = new Map(); // key: offerId -> { characterId, optionIds, expiresAt }
function makeId() { return Math.random().toString(36).slice(2); }

exports.createChoice = async (req, res, next) => {
  try {
    const ch = await Character.findByPk(req.params.id);
    if (!ch) return res.status(404).json({ error:"Not found" });
    ensureOwner(req, ch);
    const abilities = await getPools(ch.id);
    const opts = pickRandom(abilities, Math.min(3, abilities.length));
    const offerId = makeId();
    const expiresAt = new Date(Date.now() + 15*60*1000).toISOString();
    offers.set(offerId, { characterId: ch.id, optionIds: opts.map(o=>o.id), expiresAt });
    res.json({ offerId, options: opts, expiresAt });
  } catch (e) { next(e); }
};

exports.selectChoice = async (req, res, next) => {
  try {
    const { offerId } = req.params;
    const { abilityId } = req.body;
    const offer = offers.get(offerId);
    if (!offer) return res.status(400).json({ error: "Offer expired" });
    if (!offer.optionIds.includes(abilityId)) return res.status(400).json({ error: "Ability not in offer" });
    const ch = await Character.findByPk(req.params.id);
    if (!ch || ch.id !== offer.characterId) return res.status(400).json({ error: "Invalid offer" });
    ensureOwner(req, ch);
    // create/find card
    const ab = await Ability.findByPk(abilityId);
    let card = await Card.findOne({ where:{ abilityId: ab.id } });
    if (!card) card = await Card.create({ abilityId: ab.id, source: "CLASS", levelRequired: 1, meta: {} });
    // ensure main deck
    let deck = await CharacterDeck.findOne({ where:{ characterId: ch.id, name: "Main" } });
    if (!deck) deck = await CharacterDeck.create({ characterId: ch.id, name: "Main" });
    const [cc, created] = await CharacterCard.findOrCreate({ where:{ deckId: deck.id, cardId: card.id }, defaults:{ deckId: deck.id, cardId: card.id, copies: ab.baseCopies || 4 } });
    if (!created) { cc.copies += ab.baseCopies || 4; await cc.save(); }
    offers.delete(offerId);
    res.json({ ok: true, deckCard: cc });
  } catch (e) { next(e); }
};

exports.listDecks = async (req, res, next) => {
  try {
    res.json(await CharacterDeck.findAll({ where:{ characterId: req.params.id } }));
  } catch (e) { next(e); }
};

exports.createDeck = async (req, res, next) => {
  try {
    const d = await CharacterDeck.create({ characterId: req.params.id, name: req.body?.name || "New" });
    res.json(d);
  } catch (e) { next(e); }
};

exports.listDeckCards = async (req, res, next) => {
  try {
    const list = await CharacterCard.findAll({ where:{ deckId: req.params.deckId }, include:[{ model: require("../models").Card }] });
    res.json(list);
  } catch (e) { next(e); }
};

exports.addDeckCard = async (req, res, next) => {
  try {
    const { cardId, copies = 1 } = req.body;
    const [cc, created] = await CharacterCard.findOrCreate({ where:{ deckId: req.params.deckId, cardId }, defaults:{ deckId: req.params.deckId, cardId, copies } });
    if (!created) { cc.copies += copies; await cc.save(); }
    res.json(cc);
  } catch (e) { next(e); }
};

exports.patchDeckCard = async (req, res, next) => {
  try {
    const cc = await CharacterCard.findByPk(req.params.deckCardId);
    if (!cc) return res.status(404).json({ error:"Not found" });
    if (typeof req.body.copies === "number") cc.copies = req.body.copies;
    await cc.save();
    res.json(cc);
  } catch (e) { next(e); }
};

exports.deleteDeckCard = async (req, res, next) => {
  try {
    await CharacterCard.destroy({ where:{ id: req.params.deckCardId } });
    res.json({ ok: true });
  } catch (e) { next(e); }
};

exports.listInventory = async (req, res, next) => {
  try {
    const list = await CharacterInventory.findAll({ where:{ characterId: req.params.id }, include:[Item] });
    res.json(list);
  } catch (e) { next(e); }
};
exports.addInventoryItem = async (req, res, next) => {
  try {
    const { itemId, qty = 1 } = req.body;
    const [row, created] = await CharacterInventory.findOrCreate({ where:{ characterId: req.params.id, itemId }, defaults:{ characterId: req.params.id, itemId, qty } });
    if (!created) { row.qty += qty; await row.save(); }
    res.json(row);
  } catch (e) { next(e); }
};
exports.patchInventoryItem = async (req, res, next) => {
  try {
    const row = await CharacterInventory.findByPk(req.params.invId);
    if (!row) return res.status(404).json({ error:"Not found" });
    const prevEquipped = row.equipped;
    if (typeof req.body.qty === "number") row.qty = req.body.qty;
    if (typeof req.body.equipped === "boolean") row.equipped = req.body.equipped;
    await row.save();
    if (typeof req.body.equipped === "boolean" && prevEquipped !== row.equipped) {
      enqueuePortraitRefresh(row.characterId).catch((err) => {
        console.error("Failed to enqueue portrait refresh", err);
      });
    }
    res.json(row);
  } catch (e) { next(e); }
};
exports.deleteInventoryItem = async (req, res, next) => {
  try {
    await CharacterInventory.destroy({ where:{ id: req.params.invId } });
    res.json({ ok: true });
  } catch (e) { next(e); }
};
