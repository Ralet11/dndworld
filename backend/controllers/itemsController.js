const { Item } = require("../models");

function normalizeMeta(meta) {
  if (!meta || typeof meta !== "object") return {};
  return { ...meta };
}

function extractPrompt(source) {
  return typeof source === "string" ? source.trim() : undefined;
}

function mergeMeta(baseMeta, promptValue) {
  const meta = normalizeMeta(baseMeta);
  if (promptValue !== undefined) {
    meta.prompt = promptValue;
  } else if (meta.prompt === undefined) {
    meta.prompt = "";
  }
  return meta;
}

exports.createItem = async (req, res, next) => {
  try {
    const prompt = extractPrompt(req.body.prompt);
    const meta = mergeMeta(req.body.meta, prompt);
    const payload = {
      name: req.body.name,
      description: req.body.description || null,
      iconAssetId: req.body.iconAssetId || null,
      meta,
    };
    res.json(await Item.create(payload));
  } catch (e) {
    next(e);
  }
};

exports.listItems = async (_req, res, next) => {
  try {
    res.json(await Item.findAll());
  } catch (e) {
    next(e);
  }
};

exports.getItem = async (req, res, next) => {
  try {
    const row = await Item.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (e) {
    next(e);
  }
};

exports.patchItem = async (req, res, next) => {
  try {
    const row = await Item.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });

    for (const key of ["name", "description", "iconAssetId"]) {
      if (key in req.body) row[key] = req.body[key];
    }

    const prompt = extractPrompt(req.body.prompt);
    const shouldUpdateMeta = "meta" in req.body || prompt !== undefined;
    if (shouldUpdateMeta) {
      const baseMeta = "meta" in req.body ? req.body.meta : row.meta;
      row.meta = mergeMeta(baseMeta, prompt);
    }

    await row.save();
    res.json(row);
  } catch (e) {
    next(e);
  }
};

exports.deleteItem = async (req, res, next) => {
  try {
    await Item.destroy({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
