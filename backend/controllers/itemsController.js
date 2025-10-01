const { Item } = require("../models");

exports.createItem = async (req, res, next) => {
  try { res.json(await Item.create({ name: req.body.name, description: req.body.description || null, iconAssetId: req.body.iconAssetId || null, meta: req.body.meta || {} })); }
  catch (e) { next(e); }
};
exports.listItems = async (_req, res, next) => { try { res.json(await Item.findAll()); } catch (e) { next(e); } };
exports.getItem = async (req, res, next) => { try {
  const row = await Item.findByPk(req.params.id); if (!row) return res.status(404).json({ error:"Not found" }); res.json(row);
} catch (e) { next(e); } };
exports.patchItem = async (req, res, next) => { try {
  const row = await Item.findByPk(req.params.id); if (!row) return res.status(404).json({ error:"Not found" });
  for (const k of ["name","description","iconAssetId","meta"]) if (k in req.body) row[k]=req.body[k];
  await row.save(); res.json(row);
} catch (e) { next(e); } };
exports.deleteItem = async (req, res, next) => { try { await Item.destroy({ where:{ id: req.params.id } }); res.json({ ok:true }); } catch (e) { next(e); } };
