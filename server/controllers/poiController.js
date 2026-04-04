const PointOfInterest = require('../models/PointOfInterest');
const UserPoiData = require('../models/UserPoiData');

exports.getAllPointsOfInterest = async (req, res) => {
    try {
        const pois = await PointOfInterest.findAll();
        res.status(200).json(pois);
    } catch (error) {
        console.error("Error fetching Points of Interest:", error);
        res.status(500).json({ error: 'Failed to fetch points of interest' });
    }
};

exports.createPointOfInterest = async (req, res) => {
    try {
        const { title, top, left, color, type, image, description } = req.body;
        const newPoi = await PointOfInterest.create({ title, top, left, color, type, image, description });
        res.status(201).json(newPoi);
    } catch (error) {
        console.error("Error creating Point of Interest:", error);
        res.status(500).json({ error: 'Failed to create point of interest' });
    }
};

exports.updatePointOfInterest = async (req, res) => {
    try {
        const { id } = req.params;
        const { top, left, title, image, description, type, color } = req.body;

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
        const poi = await PointOfInterest.findByPk(id, {
            attributes: ['id', 'description', 'dmDescription', 'partyKnowledge']
        });

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
        // In a real app we would strictly enforce `req.user.role === 'DM'` here

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

        // If targetUserId is provided, a DM is trying to update another user's specialized knowledge
        // Otherwise, the user is saving their own notes
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

        // Only DM hypothetically should do this, but for testing we leave it open
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
