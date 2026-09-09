const express = require('express');
const { Op } = require('sequelize');
const { Campaign, CampaignMember, User } = require('../models');
const { verifyToken } = require('../middleware/auth');
const { isSuperAdmin, canAccessCampaign, canManageCampaign, ensureLegacyCampaign } = require('../services/campaignAccess');

const router = express.Router();
router.use(verifyToken);

function summary(campaign, membership) {
    return { ...campaign.toJSON(), membershipRole: isSuperAdmin(membership) ? 'SUPER_ADMIN' : membership?.role || null };
}

router.get('/', async (req, res) => {
    try {
        await ensureLegacyCampaign();
        const campaigns = isSuperAdmin(req.user)
            ? await Campaign.findAll({ where: { is_archived: false }, order: [['updatedAt', 'DESC']] })
            : await Campaign.findAll({
                where: { is_archived: false },
                include: [{ model: CampaignMember, as: 'members', where: { user_id: req.user.id }, attributes: ['role'], required: true }],
                order: [['updatedAt', 'DESC']],
            });
        res.json({ campaigns: campaigns.map(campaign => summary(campaign, isSuperAdmin(req.user) ? req.user : campaign.members?.[0])) });
    } catch (error) { res.status(500).json({ message: 'No se pudieron cargar las campañas.' }); }
});

router.post('/', async (req, res) => {
    try {
        if (!isSuperAdmin(req.user)) return res.status(403).json({ message: 'Sólo el Super Admin puede crear campañas.' });
        const name = String(req.body.name || '').trim().slice(0, 120);
        if (!name) return res.status(400).json({ message: 'La campaña necesita un nombre.' });
        const campaign = await Campaign.create({ name, description: String(req.body.description || '').trim().slice(0, 2000), owner_user_id: req.user.id });
        await CampaignMember.create({ campaign_id: campaign.id, user_id: req.user.id, role: 'DM' });
        res.status(201).json({ campaign: summary(campaign, req.user) });
    } catch (error) { res.status(500).json({ message: 'No se pudo crear la campaña.' }); }
});

router.get('/users', async (req, res) => {
    if (!isSuperAdmin(req.user)) return res.status(403).json({ message: 'Sólo el Super Admin puede administrar usuarios.' });
    const users = await User.findAll({ attributes: ['id', 'username', 'email', 'role'], order: [['username', 'ASC']] });
    res.json({ users });
});

router.put('/users/:userId/role', async (req, res) => {
    try {
        if (!isSuperAdmin(req.user)) return res.status(403).json({ message: 'Sólo el Super Admin puede asignar DMs.' });
        const role = req.body.role === 'DM' ? 'DM' : 'PLAYER';
        const user = await User.findByPk(req.params.userId);
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
        if (user.role === 'ADMIN') return res.status(409).json({ message: 'No se puede degradar a otro Super Admin.' });
        await user.update({ role });
        res.json({ user: { id: user.id, username: user.username, email: user.email, role: user.role } });
    } catch (error) { res.status(500).json({ message: 'No se pudo actualizar el rol.' }); }
});

router.get('/:campaignId/members', async (req, res) => {
    if (!await canManageCampaign(req.user, req.params.campaignId)) return res.status(403).json({ message: 'No puedes administrar esta campaña.' });
    const members = await CampaignMember.findAll({ where: { campaign_id: req.params.campaignId }, include: [{ model: User, as: 'user', attributes: ['id', 'username', 'email', 'role'] }] });
    res.json({ members });
});

router.put('/:campaignId/members/:userId', async (req, res) => {
    try {
        if (!isSuperAdmin(req.user)) return res.status(403).json({ message: 'Sólo el Super Admin asigna DMs y jugadores.' });
        const campaign = await Campaign.findByPk(req.params.campaignId);
        const user = await User.findByPk(req.params.userId);
        if (!campaign || !user) return res.status(404).json({ message: 'Campaña o usuario no encontrado.' });
        const role = req.body.role === 'DM' ? 'DM' : 'PLAYER';
        if (role === 'DM' && user.role !== 'DM' && user.role !== 'ADMIN') return res.status(409).json({ message: 'Primero habilita a este usuario como DM.' });
        const [member] = await CampaignMember.findOrCreate({ where: { campaign_id: campaign.id, user_id: user.id }, defaults: { role } });
        if (member.role !== role) await member.update({ role });
        res.json({ member });
    } catch (error) { res.status(500).json({ message: 'No se pudo asignar el usuario.' }); }
});

router.delete('/:campaignId/members/:userId', async (req, res) => {
    if (!isSuperAdmin(req.user)) return res.status(403).json({ message: 'Sólo el Super Admin puede retirar miembros.' });
    const campaign = await Campaign.findByPk(req.params.campaignId);
    if (!campaign) return res.status(404).json({ message: 'Campaña no encontrada.' });
    if (String(campaign.owner_user_id) === String(req.params.userId)) return res.status(409).json({ message: 'El propietario no puede retirarse.' });
    await CampaignMember.destroy({ where: { campaign_id: campaign.id, user_id: req.params.userId } });
    res.sendStatus(204);
});

router.get('/:campaignId', async (req, res) => {
    if (!await canAccessCampaign(req.user, req.params.campaignId)) return res.status(403).json({ message: 'No tienes acceso a esta campaña.' });
    const campaign = await Campaign.findByPk(req.params.campaignId);
    res.json({ campaign: summary(campaign, req.user) });
});

module.exports = router;
