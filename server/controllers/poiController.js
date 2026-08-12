const PointOfInterest = require('../models/PointOfInterest');
const UserPoiData = require('../models/UserPoiData');

exports.getAllPointsOfInterest = async (req, res) => {
    try {
        // Filtro por nivel: ?parent_id=null (mundo) | ?parent_id=<id> (hijos de
        // una ciudad). Sin parámetro → todos (retrocompat).
        const { parent_id } = req.query;
        const where = {};
        if (parent_id === 'null' || parent_id === '') where.parent_id = null;
        else if (parent_id !== undefined) where.parent_id = parent_id;

        const attributes = { exclude: [] };
        if (req.user.role !== 'DM' && req.user.role !== 'ADMIN') attributes.exclude.push('dmDescription');
        const pois = await PointOfInterest.findAll({ where, attributes });
        res.status(200).json(pois);
    } catch (error) {
        console.error("Error fetching Points of Interest:", error);
        res.status(500).json({ error: 'Failed to fetch points of interest' });
    }
};

exports.createPointOfInterest = async (req, res) => {
    try {
        const { title, top, left, color, type, image, description, parent_id, map_image, level } = req.body;
        const newPoi = await PointOfInterest.create({ title, top, left, color, type, image, description, parent_id: parent_id || null, map_image, level });
        res.status(201).json(newPoi);
    } catch (error) {
        console.error("Error creating Point of Interest:", error);
        res.status(500).json({ error: 'Failed to create point of interest' });
    }
};

exports.updatePointOfInterest = async (req, res) => {
    try {
        const { id } = req.params;
        const { top, left, title, image, description, type, color, map_image, level } = req.body;

        const poi = await PointOfInterest.findByPk(id);
        if (!poi) {
            return res.status(404).json({ error: 'Point of Interest not found' });
        }

        // Update fields if provided
        if (top !== undefined) poi.top = top;
        if (left !== undefined) poi.left = left;
        if (title !== undefined) poi.title = title;
        if (image !== undefined) poi.image = image;
        if (description !== undefined) poi.description = description;
        if (type !== undefined) poi.type = type;
        if (color !== undefined) poi.color = color;
        if (map_image !== undefined) poi.map_image = map_image;
        if (level !== undefined) poi.level = level;

        await poi.save();

        res.status(200).json(poi);
    } catch (error) {
        console.error("Error updating Point of Interest:", error);
        res.status(500).json({ error: 'Failed to update point of interest' });
    }
};

exports.getPoiLore = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id; // From auth middleware

        // 1. Fetch global POI state
        const attributes = ['id', 'description', 'partyKnowledge'];
        if (req.user.role === 'DM' || req.user.role === 'ADMIN') attributes.push('dmDescription');
        const poi = await PointOfInterest.findByPk(id, { attributes });

        if (!poi) {
            return res.status(404).json({ error: 'Point of Interest not found' });
        }

        // 2. Fetch specific user data
        const userData = await UserPoiData.findOne({
            where: { poiId: id, userId: userId }
        });

        // 3. Combine and return
        res.status(200).json({
            global: poi,
            personal: userData || { specializedKnowledge: null, userNotes: '' } // default empty if none exists
        });

    } catch (error) {
        console.error("Error fetching POI lore:", error);
        res.status(500).json({ error: 'Failed to fetch POI lore' });
    }
};

exports.updateGlobalLore = async (req, res) => {
    try {
        const { id } = req.params;
        const { dmDescription, partyKnowledge } = req.body;
        const poi = await PointOfInterest.findByPk(id);
        if (!poi) return res.status(404).json({ error: 'POI not found' });

        if (dmDescription !== undefined) poi.dmDescription = dmDescription;
        if (partyKnowledge !== undefined) poi.partyKnowledge = partyKnowledge;

        await poi.save();
        res.status(200).json(poi);
    } catch (error) {
        console.error("Error updating global lore:", error);
        res.status(500).json({ error: 'Failed to update global lore' });
    }
};

exports.updateUserNotes = async (req, res) => {
    try {
        const { id } = req.params;
        const { userNotes, specializedKnowledge, targetUserId } = req.body;
        const requestingUser = req.user;

        const isDm = requestingUser.role === 'DM' || requestingUser.role === 'ADMIN';
        if (targetUserId && !isDm) {
            return res.status(403).json({ error: 'Sólo el DM puede editar datos de otro jugador.' });
        }
        if (specializedKnowledge !== undefined && !isDm) {
            return res.status(403).json({ error: 'Sólo el DM puede editar conocimiento especializado.' });
        }

        // If targetUserId is provided, a DM is editing specialized knowledge.
        // Otherwise, a player is saving their own notes.
        const targetId = targetUserId || requestingUser.id;

        const [userData, created] = await UserPoiData.findOrCreate({
            where: { poiId: id, userId: targetId },
            defaults: {
                poiId: id,
                userId: targetId,
                userNotes: userNotes || '',
                specializedKnowledge: specializedKnowledge || null
            }
        });

        // Update fields if provided
        if (userNotes !== undefined && targetId === requestingUser.id) {
            userData.userNotes = userNotes;
        }

        if (specializedKnowledge !== undefined) {
            userData.specializedKnowledge = specializedKnowledge;
        }

        await userData.save();
        res.status(200).json(userData);
    } catch (error) {
        console.error("Error updating user notes:", error);
        res.status(500).json({ error: 'Failed to update user notes' });
    }
};
