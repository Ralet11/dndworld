const { Campaign } = require('../models');
const { canAccessCampaign, canManageCampaign, isSuperAdmin, membershipFor } = require('../services/campaignAccess');

async function requireCampaign(req, res, next) {
    try {
        const campaignId = req.headers['x-campaign-id'];
        if (!campaignId || !await canAccessCampaign(req.user, campaignId)) return res.status(403).json({ message: 'Selecciona una campaña autorizada.' });
        req.campaignId = campaignId;
        req.campaignRole = isSuperAdmin(req.user) ? 'SUPER_ADMIN' : (await membershipFor(req.user.id, campaignId))?.role || null;
        next();
    } catch (_) { res.status(500).json({ message: 'No se pudo validar la campaña.' }); }
}

async function requireCampaignDm(req, res, next) {
    if (!req.campaignId || !await canManageCampaign(req.user, req.campaignId)) return res.status(403).json({ message: 'No administras esta campaña.' });
    next();
}

module.exports = { requireCampaign, requireCampaignDm };
