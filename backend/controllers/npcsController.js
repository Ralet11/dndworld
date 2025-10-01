const { Op } = require("sequelize");
const {
  Creature,
  Npc,
  CreatureAttribute,
  CreatureResource,
  NpcSound,
  NpcQuest,
  Campaign,
  MediaAsset,
} = require("../models");

const ATTRIBUTE_KEYS = ["str", "dex", "con", "int", "wis", "cha"];
const RESOURCE_TYPES = new Set(["MANA", "ENERGY", "SPIRIT", "SOUL", "FOCUS", "RAGE"]);

function buildNpcIncludes(creatureWhere) {
  const creatureInclude = {
    model: Creature,
    include: [
      { model: CreatureAttribute },
      { model: CreatureResource },
      { model: MediaAsset, as: "portrait" },
    ],
  };
  if (creatureWhere && Object.keys(creatureWhere).length > 0) {
    creatureInclude.where = creatureWhere;
    creatureInclude.required = true;
  }
  return [
    creatureInclude,
    { model: Campaign, attributes: ["id", "name", "status"] },
  ];
}

function pickAttributes(source) {
  if (!source || typeof source !== "object") return {};
  const result = {};
  ATTRIBUTE_KEYS.forEach((key) => {
    const value = Number(source[key]);
    if (!Number.isNaN(value)) result[key] = value;
  });
  return result;
}

async function ensureAttributes(creatureId, payload) {
  if (!payload) return;
  const updates = pickAttributes(payload);
  if (Object.keys(updates).length === 0) return;
  const record = await CreatureAttribute.findByPk(creatureId);
  if (!record) return;
  Object.assign(record, updates);
  await record.save();
}

async function upsertResources(creatureId, items) {
  if (!Array.isArray(items)) return;
  const rows = await CreatureResource.findAll({ where: { creatureId } });
  const seen = new Set();
  for (const entry of items) {
    if (!entry || !RESOURCE_TYPES.has(entry.resource)) continue;
    const current = rows.find((r) => r.resource === entry.resource);
    const data = {
      current: typeof entry.current === "number" ? entry.current : current?.current ?? 0,
      max: typeof entry.max === "number" ? entry.max : current?.max ?? 0,
    };
    if (current) {
      current.current = data.current;
      current.max = data.max;
      await current.save();
    } else {
      await CreatureResource.create({
        creatureId,
        resource: entry.resource,
        current: data.current,
        max: data.max,
      });
    }
    seen.add(entry.resource);
  }
}

exports.createNpc = async (req, res, next) => {
  try {
    const {
      name,
      raceId,
      classId,
      level = 1,
      portraitAssetId = null,
      alignment = null,
      background = null,
      fears = null,
      goalsShort = null,
      goalsLong = null,
      armorClass = 10,
      maxHp = 10,
      speedValue = 6,
      tier = "COMMON",
      behaviorNotes = null,
      campaignId = null,
      attributes,
      resources,
    } = req.body || {};

    if (!name) return res.status(400).json({ error: "Nombre requerido" });

    const creature = await Creature.create({
      kind: "NPC",
      name,
      raceId: raceId || null,
      classId: classId || null,
      level,
      portraitAssetId,
      alignment,
      background,
      fears,
      goalsShort,
      goalsLong,
      armorClass,
      maxHp,
      speedValue,
      createdBy: req.user.id,
    });

    await CreatureAttribute.create({ creatureId: creature.id });
    await ensureAttributes(creature.id, attributes);
    await upsertResources(creature.id, resources);

    await Npc.create({
      id: creature.id,
      tier: tier || "COMMON",
      behaviorNotes: behaviorNotes || null,
      campaignId: campaignId || null,
    });

    const payload = await Npc.findByPk(creature.id, { include: buildNpcIncludes() });
    res.status(201).json(payload);
  } catch (e) {
    next(e);
  }
};

exports.listNpcs = async (req, res, next) => {
  try {
    const { search, alignment, raceId, classId, tier, campaignId } = req.query || {};
    const npcWhere = {};
    if (tier) npcWhere.tier = tier;
    if (campaignId === 'none') npcWhere.campaignId = null;
    else if (campaignId) npcWhere.campaignId = campaignId;

    const creatureWhere = {};
    if (alignment) creatureWhere.alignment = alignment;
    if (raceId) creatureWhere.raceId = raceId;
    if (classId) creatureWhere.classId = classId;
    if (search) creatureWhere.name = { [Op.iLike]: `%${search.trim()}%` };

    const rows = await Npc.findAll({
      where: npcWhere,
      include: buildNpcIncludes(creatureWhere),
      order: [["createdAt", "DESC"]],
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

exports.getNpc = async (req, res, next) => {
  try {
    const row = await Npc.findByPk(req.params.id, { include: buildNpcIncludes() });
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (e) {
    next(e);
  }
};

exports.patchNpc = async (req, res, next) => {
  try {
    const npc = await Npc.findByPk(req.params.id, { include: buildNpcIncludes() });
    if (!npc) return res.status(404).json({ error: "Not found" });

    if (req.body.tier) npc.tier = req.body.tier;
    if (Object.prototype.hasOwnProperty.call(req.body, 'behaviorNotes')) {
      npc.behaviorNotes = req.body.behaviorNotes;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'campaignId')) {
      npc.campaignId = req.body.campaignId || null;
    }

    const creature = npc.Creature;
    if (!creature) throw new Error('Creature missing for NPC');

    const creatureUpdates = {
      name: req.body.name,
      raceId: req.body.raceId,
      classId: req.body.classId,
      level: req.body.level,
      portraitAssetId: req.body.portraitAssetId,
      alignment: req.body.alignment,
      background: req.body.background,
      fears: req.body.fears,
      goalsShort: req.body.goalsShort,
      goalsLong: req.body.goalsLong,
      armorClass: req.body.armorClass,
      maxHp: req.body.maxHp,
      speedValue: req.body.speedValue,
    };

    let creatureDirty = false;
    Object.entries(creatureUpdates).forEach(([key, value]) => {
      if (value !== undefined) {
        creature[key] = value;
        creatureDirty = true;
      }
    });

    if (creatureDirty) await creature.save();
    await ensureAttributes(creature.id, req.body.attributes);
    await upsertResources(creature.id, req.body.resources);
    await npc.save();

    const payload = await Npc.findByPk(npc.id, { include: buildNpcIncludes() });
    res.json(payload);
  } catch (e) {
    next(e);
  }
};

exports.deleteNpc = async (req, res, next) => {
  try {
    await Npc.destroy({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
};

exports.addSound = async (req, res, next) => {
  try {
    const row = await NpcSound.create({ npcId: req.params.id, assetId: req.body.assetId, caption: req.body.caption || null });
    res.json(row);
  } catch (e) { next(e); }
};
exports.deleteSound = async (req, res, next) => {
  try { await NpcSound.destroy({ where: { id: req.params.soundId } }); res.json({ ok: true }); } catch (e) { next(e); }
};

exports.attachQuest = async (req, res, next) => {
  try {
    const row = await NpcQuest.create({ npcId: req.params.id, questId: req.body.questId });
    res.json(row);
  } catch (e) { next(e); }
};
exports.detachQuest = async (req, res, next) => {
  try { await NpcQuest.destroy({ where: { npcId: req.params.id, questId: req.params.questId } }); res.json({ ok: true }); } catch (e) { next(e); }
};




