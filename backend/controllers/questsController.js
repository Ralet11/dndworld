const { Quest, QuestStep, QuestReward, Session } = require("../models");
const { createNewsEntry } = require("../services/newsService");

exports.createQuest = async (req, res, next) => {
  try { res.json(await Quest.create({ name: req.body.name, description: req.body.description || null, recommendedLevel: req.body.recommendedLevel || null, createdBy: req.user.id })); }
  catch (e) { next(e); }
};
exports.listQuests = async (_req, res, next) => { try { res.json(await Quest.findAll()); } catch (e) { next(e); } };
exports.getQuest = async (req, res, next) => { try {
  const row = await Quest.findByPk(req.params.id, { include:[QuestStep, QuestReward] });
  if (!row) return res.status(404).json({ error:"Not found" }); res.json(row);
} catch (e) { next(e); } };
exports.patchQuest = async (req, res, next) => { try {
  const row = await Quest.findByPk(req.params.id); if (!row) return res.status(404).json({ error:"Not found" });
  for (const k of ["name","description","recommendedLevel"]) if (k in req.body) row[k]=req.body[k];
  await row.save(); res.json(row);
} catch (e) { next(e); } };
exports.deleteQuest = async (req, res, next) => { try { await Quest.destroy({ where:{ id: req.params.id } }); res.json({ ok:true }); } catch (e) { next(e); } };

exports.addStep = async (req, res, next) => { try { res.json(await QuestStep.create({ questId: req.params.id, stepOrder: req.body.stepOrder || 1, text: req.body.text })); } catch (e) { next(e); } };
exports.addReward = async (req, res, next) => { try { res.json(await QuestReward.create({ questId: req.params.id, rewardType: req.body.rewardType, payload: req.body.payload || {} })); } catch (e) { next(e); } };
exports.deleteStep = async (req, res, next) => { try { await QuestStep.destroy({ where:{ id: req.params.stepId } }); res.json({ ok:true }); } catch (e) { next(e); } };
exports.deleteReward = async (req, res, next) => { try { await QuestReward.destroy({ where:{ id: req.params.rewardId } }); res.json({ ok:true }); } catch (e) { next(e); } };

exports.completeQuestInSession = async (req, res, next) => {
  try {
    const { sessionId, questId } = req.params;
    const session = await Session.findByPk(sessionId);
    if (!session) return res.status(404).json({ error:"Session not found" });

    let newsRow = null;
    const news = req.body?.news;
    if (news?.title && news?.summary) {
      try {
        newsRow = await createNewsEntry({
          campaignId: session.campaignId,
          kind: news.kind || 'QUEST_COMPLETED',
          title: news.title,
          summary: news.summary,
          body: news.body,
          images: news.images,
          characters: news.characters,
          npcs: news.npcs,
          tags: news.tags,
          extra: {
            sessionId,
            questId,
          },
        });
      } catch (err) {
        console.warn('Failed to create quest news', err.message);
      }
    }

    res.json({
      ok: true,
      note: "Grant rewards to session participants here",
      sessionId,
      questId,
      newsId: newsRow ? newsRow.id : null,
    });
  } catch (e) { next(e); }
};

