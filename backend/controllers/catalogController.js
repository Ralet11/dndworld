const { Race, Class, Talent, Ability, Card } = require("../models");

exports.listRaces = async (_req, res, next) => {
  try { res.json(await Race.findAll({ order:[["name","ASC"]] })); } catch (e) { next(e); }
};
exports.getRace = async (req, res, next) => {
  try {
    const r = await Race.findByPk(req.params.id);
    if (!r) return res.status(404).json({ error:"Not found" });
    res.json(r);
  } catch (e) { next(e); }
};

exports.listClasses = async (_req, res, next) => {
  try { res.json(await Class.findAll({ order:[["name","ASC"]] })); } catch (e) { next(e); }
};
exports.getClass = async (req, res, next) => {
  try {
    const c = await Class.findByPk(req.params.id);
    if (!c) return res.status(404).json({ error:"Not found" });
    res.json(c);
  } catch (e) { next(e); }
};
exports.getClassTalents = async (req, res, next) => {
  try {
    const list = await Talent.findAll({ where:{ classId:req.params.id } });
    res.json(list);
  } catch (e) { next(e); }
};

exports.listAbilities = async (req, res, next) => {
  try {
    res.json(await Ability.findAll({ order:[["name","ASC"]] }));
  } catch (e) { next(e); }
};

exports.getCard = async (req, res, next) => {
  try {
    const c = await Card.findByPk(req.params.id);
    if (!c) return res.status(404).json({ error:"Not found" });
    res.json(c);
  } catch (e) { next(e); }
};
