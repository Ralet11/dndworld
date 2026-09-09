const { Campaign, CampaignMember, GameSession, User, Character, Scene, Quest, PointOfInterest, TimelineEvent, AssistantConversation } = require('../models');

const isSuperAdmin = user => user?.role === 'ADMIN';

async function membershipFor(userId, campaignId) {
    return CampaignMember.findOne({ where: { user_id: userId, campaign_id: campaignId } });
}

async function canManageCampaign(user, campaignId) {
    if (isSuperAdmin(user)) return Boolean(await Campaign.findByPk(campaignId));
    const membership = await membershipFor(user?.id, campaignId);
    return membership?.role === 'DM';
}

async function canAccessCampaign(user, campaignId) {
    if (isSuperAdmin(user)) return Boolean(await Campaign.findByPk(campaignId));
    return Boolean(await membershipFor(user?.id, campaignId));
}

async function ensureLegacyCampaign() {
    let campaign = await Campaign.findOne({ order: [['createdAt', 'ASC']] });
    if (!campaign) {
        const owner = await User.findOne({ where: { role: 'ADMIN' } }) || await User.findOne({ where: { role: 'DM' } });
        if (!owner) return null;
        campaign = await Campaign.create({ name: 'Campaña actual', description: 'Campaña migrada desde la mesa original.', owner_user_id: owner.id });
        await CampaignMember.create({ campaign_id: campaign.id, user_id: owner.id, role: 'DM' });
    }
    await Promise.all([
        GameSession.update({ campaign_id: campaign.id }, { where: { campaign_id: null } }),
        Character.update({ campaign_id: campaign.id }, { where: { campaign_id: null } }),
        Scene.update({ campaign_id: campaign.id }, { where: { campaign_id: null } }),
        Quest.update({ campaign_id: campaign.id }, { where: { campaign_id: null } }),
        PointOfInterest.update({ campaign_id: campaign.id }, { where: { campaign_id: null } }),
        TimelineEvent.update({ campaign_id: campaign.id }, { where: { campaign_id: null } }),
        AssistantConversation.update({ campaign_id: campaign.id }, { where: { campaign_id: null } }),
    ]);
    return campaign;
}

module.exports = { isSuperAdmin, membershipFor, canManageCampaign, canAccessCampaign, ensureLegacyCampaign };
