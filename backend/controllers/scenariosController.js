const {
  Scenario, ScenarioLayer, Map, MapToken
} = require("../models");
const { io } = require("../realtime/io");

exports.createScenario = async (req, res, next) => {
  try {
    const row = await Scenario.create({ campaignId: req.params.campaignId, name: req.body.name, shortDescription: req.body.shortDescription || null });
    res.json(row);
  } catch (e) { next(e); }
};

exports.listScenariosByCampaign = async (req, res, next) => {
  try {
    const list = await Scenario.findAll({ where:{ campaignId: req.params.campaignId }, order:[["createdAt","DESC"]] });
    res.json(list);
  } catch (e) { next(e); }
};

exports.getScenario = async (req, res, next) => {
  try {
    const row = await Scenario.findByPk(req.params.scenarioId);
    if (!row) return res.status(404).json({ error:"Not found" });
    res.json(row);
  } catch (e) { next(e); }
};

exports.deleteScenario = async (req, res, next) => {
  try { await Scenario.destroy({ where:{ id: req.params.scenarioId } }); res.json({ ok:true }); } catch (e) { next(e); }
};

exports.createLayer = async (req, res, next) => {
  try {
    const row = await ScenarioLayer.create({
      scenarioId: req.params.scenarioId,
      sortOrder: req.body.sortOrder || 0,
      layerType: req.body.layerType,
      imageAssetId: req.body.imageAssetId || null,
      audioAssetId: req.body.audioAssetId || null,
      notes: req.body.notes || null
    });
    res.json(row);
  } catch (e) { next(e); }
};

exports.listLayers = async (req, res, next) => {
  try { res.json(await ScenarioLayer.findAll({ where:{ scenarioId: req.params.scenarioId }, order:[["sortOrder","ASC"]] })); }
  catch (e) { next(e); }
};

exports.patchLayer = async (req, res, next) => {
  try {
    const row = await ScenarioLayer.findByPk(req.params.layerId);
    if (!row) return res.status(404).json({ error:"Not found" });
    for (const k of ["sortOrder","layerType","imageAssetId","audioAssetId","notes"]) if (k in req.body) row[k]=req.body[k];
    await row.save(); res.json(row);
  } catch (e) { next(e); }
};

exports.deleteLayer = async (req, res, next) => {
  try { await ScenarioLayer.destroy({ where:{ id: req.params.layerId } }); res.json({ ok:true }); } catch (e) { next(e); }
};

exports.createMap = async (req, res, next) => {
  try {
    const row = await Map.create({
      layerId: req.params.layerId,
      gridSize: req.body.gridSize || 50,
      widthCells: req.body.widthCells || 30,
      heightCells: req.body.heightCells || 20,
      backgroundAssetId: req.body.backgroundAssetId || null
    });
    res.json(row);
  } catch (e) { next(e); }
};

exports.getMap = async (req, res, next) => {
  try {
    const row = await Map.findByPk(req.params.mapId);
    if (!row) return res.status(404).json({ error:"Not found" });
    res.json(row);
  } catch (e) { next(e); }
};

exports.patchMap = async (req, res, next) => {
  try {
    const row = await Map.findByPk(req.params.mapId);
    if (!row) return res.status(404).json({ error:"Not found" });
    for (const k of ["gridSize","widthCells","heightCells","backgroundAssetId"]) if (k in req.body) row[k]=req.body[k];
    await row.save(); res.json(row);
  } catch (e) { next(e); }
};

exports.deleteMap = async (req, res, next) => {
  try { await Map.destroy({ where:{ id: req.params.mapId } }); res.json({ ok:true }); } catch (e) { next(e); }
};

exports.listTokens = async (req, res, next) => {
  try { res.json(await MapToken.findAll({ where:{ mapId: req.params.mapId } })); } catch (e) { next(e); }
};
exports.createToken = async (req, res, next) => {
  try {
    const row = await MapToken.create({ mapId: req.params.mapId, tokenType: req.body.tokenType, creatureId: req.body.creatureId || null, label: req.body.label || null, x: req.body.x || 0, y: req.body.y || 0, meta: req.body.meta || {} });
    res.json(row);
  } catch (e) { next(e); }
};
exports.patchToken = async (req, res, next) => {
  try {
    const row = await MapToken.findByPk(req.params.tokenId);
    if (!row) return res.status(404).json({ error:"Not found" });
    for (const k of ["x","y","label","meta"]) if (k in req.body) row[k]=req.body[k];
    await row.save();

    const payload = { tokenId: row.id, x: row.x, y: row.y };
    try {
      const sessionId = req.body.sessionId || null;
      if (sessionId) io().to(`session:${sessionId}`).emit('token:moved', payload);
      else io().emit('token:moved', payload);
    } catch (err) {
      console.warn('socket emit failed', err.message);
    }

    res.json(row);
  } catch (e) { next(e); }
};
exports.deleteToken = async (req, res, next) => {
  try { await MapToken.destroy({ where:{ id: req.params.tokenId } }); res.json({ ok:true }); } catch (e) { next(e); }
};
