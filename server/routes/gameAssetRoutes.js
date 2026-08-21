const express = require('express');
const multer = require('multer');
const { verifyToken, isDm } = require('../middleware/auth');
const { GameAsset, GameAssetFolder, GameSession } = require('../models');
const { deleteObject, uploadBuffer } = require('../utils/s3Storage');
const { folderParts, normalizeFolderName, normalizeRelativePath, wouldCreateFolderCycle } = require('../services/assetLibrary');

const router = express.Router();
const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, done) => done(null, /^image\/(?:jpeg|png|webp|gif)$/.test(file.mimetype)),
});

router.use(verifyToken, isDm);

async function ownedFolder(ownerId, folderId) {
    if (!folderId) return null;
    return GameAssetFolder.findOne({ where: { id: folderId, owner_user_id: ownerId } });
}

async function ownedSession(ownerId, sessionId) {
    if (!sessionId) return null;
    return GameSession.findOne({ where: { id: sessionId, dm_user_id: ownerId } });
}

async function nextSortOrder(Model, where) {
    const maximum = await Model.max('sort_order', { where });
    return Number.isFinite(maximum) ? maximum + 1 : 0;
}

async function findSibling(ownerId, parentId, name) {
    const siblings = await GameAssetFolder.findAll({ where: { owner_user_id: ownerId, parent_id: parentId || null } });
    return siblings.find(folder => folder.name.localeCompare(name, 'es', { sensitivity: 'accent' }) === 0) || null;
}

async function ensureFolderPath(ownerId, path) {
    let parentId = null;
    for (const name of folderParts(path)) {
        let folder = await findSibling(ownerId, parentId, name);
        if (!folder) {
            folder = await GameAssetFolder.create({
                owner_user_id: ownerId,
                parent_id: parentId,
                name,
                sort_order: await nextSortOrder(GameAssetFolder, { owner_user_id: ownerId, parent_id: parentId }),
            });
        }
        parentId = folder.id;
    }
    return parentId;
}

async function adoptLegacyAssets(ownerId) {
    const sessions = await GameSession.findAll({ where: { dm_user_id: ownerId }, attributes: ['id'] });
    if (!sessions.length) return;
    await GameAsset.update(
        { owner_user_id: ownerId },
        { where: { owner_user_id: null, session_id: sessions.map(session => session.id) } },
    );
}

router.get('/', async (req, res) => {
    try {
        await adoptLegacyAssets(req.user.id);
        const [folders, assets] = await Promise.all([
            GameAssetFolder.findAll({ where: { owner_user_id: req.user.id }, order: [['sort_order', 'ASC'], ['name', 'ASC']] }),
            GameAsset.findAll({ where: { owner_user_id: req.user.id }, order: [['sort_order', 'ASC'], ['createdAt', 'ASC']] }),
        ]);
        res.json({ folders, assets });
    } catch (error) {
        console.error('Asset library load error:', error);
        res.status(500).json({ message: 'No se pudo cargar la biblioteca de assets.' });
    }
});

router.post('/folders', async (req, res) => {
    try {
        const name = normalizeFolderName(req.body.name);
        const parentId = req.body.parentId || null;
        if (!name) return res.status(400).json({ message: 'La carpeta necesita un nombre.' });
        if (parentId && !await ownedFolder(req.user.id, parentId)) return res.status(404).json({ message: 'La carpeta superior no existe.' });
        if (await findSibling(req.user.id, parentId, name)) return res.status(409).json({ message: 'Ya existe una carpeta con ese nombre en esta ubicación.' });
        const folder = await GameAssetFolder.create({
            owner_user_id: req.user.id,
            parent_id: parentId,
            name,
            sort_order: await nextSortOrder(GameAssetFolder, { owner_user_id: req.user.id, parent_id: parentId }),
        });
        res.status(201).json({ folder });
    } catch (error) {
        console.error('Asset folder create error:', error);
        res.status(500).json({ message: 'No se pudo crear la carpeta.' });
    }
});

router.patch('/folders/:id', async (req, res) => {
    try {
        const folder = await ownedFolder(req.user.id, req.params.id);
        if (!folder) return res.status(404).json({ message: 'La carpeta no existe.' });
        const name = req.body.name === undefined ? folder.name : normalizeFolderName(req.body.name);
        const parentId = req.body.parentId === undefined ? folder.parent_id : req.body.parentId || null;
        if (!name) return res.status(400).json({ message: 'La carpeta necesita un nombre.' });
        if (parentId && !await ownedFolder(req.user.id, parentId)) return res.status(404).json({ message: 'La carpeta superior no existe.' });
        if (await wouldCreateFolderCycle(GameAssetFolder, req.user.id, folder.id, parentId)) return res.status(409).json({ message: 'No puedes mover una carpeta dentro de sí misma.' });
        const duplicate = await findSibling(req.user.id, parentId, name);
        if (duplicate && String(duplicate.id) !== String(folder.id)) return res.status(409).json({ message: 'Ya existe una carpeta con ese nombre en esta ubicación.' });
        await folder.update({ name, parent_id: parentId });
        res.json({ folder });
    } catch (error) {
        console.error('Asset folder update error:', error);
        res.status(500).json({ message: 'No se pudo actualizar la carpeta.' });
    }
});

router.delete('/folders/:id', async (req, res) => {
    try {
        const folder = await ownedFolder(req.user.id, req.params.id);
        if (!folder) return res.status(404).json({ message: 'La carpeta no existe.' });
        const [childCount, assetCount] = await Promise.all([
            GameAssetFolder.count({ where: { owner_user_id: req.user.id, parent_id: folder.id } }),
            GameAsset.count({ where: { owner_user_id: req.user.id, folder_id: folder.id } }),
        ]);
        if (childCount || assetCount) return res.status(409).json({ message: 'Mueve o elimina primero el contenido de esta carpeta.' });
        await folder.destroy();
        res.sendStatus(204);
    } catch (error) {
        console.error('Asset folder delete error:', error);
        res.status(500).json({ message: 'No se pudo eliminar la carpeta.' });
    }
});

router.post('/upload', (req, res) => {
    imageUpload.single('image')(req, res, async error => {
        if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'La imagen supera el límite de 20 MB.' : error.message || 'La imagen no es válida.' });
        let stored;
        try {
            if (!req.file) return res.status(400).json({ message: 'No se recibió una imagen JPG, PNG, WEBP o GIF válida.' });
            const session = await ownedSession(req.user.id, req.body.sessionId);
            if (!session) return res.status(404).json({ message: 'La sala no existe o no te pertenece.' });
            const sourcePath = normalizeRelativePath(req.body.sourcePath);
            if (sourcePath) {
                const existing = await GameAsset.findOne({ where: { owner_user_id: req.user.id, source_path: sourcePath } });
                if (existing) return res.json({ asset: existing, skipped: true });
            }
            let folderId = req.body.folderId || null;
            if (req.body.folderPath) folderId = await ensureFolderPath(req.user.id, req.body.folderPath);
            else if (folderId && !await ownedFolder(req.user.id, folderId)) return res.status(404).json({ message: 'La carpeta de destino no existe.' });
            stored = await uploadBuffer(req.file.buffer, { folder: 'images', originalName: req.file.originalname, contentType: req.file.mimetype });
            const type = req.body.type === 'MAP' ? 'MAP' : 'IMAGE';
            const asset = await GameAsset.create({
                session_id: session.id,
                owner_user_id: req.user.id,
                folder_id: folderId,
                title: String(req.body.title || req.file.originalname.replace(/\.[^.]+$/, '') || 'Asset sin título').trim().slice(0, 160),
                url: stored.url,
                storage_key: stored.key,
                source_path: sourcePath || null,
                type,
                grid_enabled: type === 'MAP' && req.body.gridEnabled === 'true',
                sort_order: await nextSortOrder(GameAsset, { owner_user_id: req.user.id, folder_id: folderId }),
            });
            res.status(201).json({ asset, skipped: false });
        } catch (uploadError) {
            if (stored?.key) await deleteObject(stored.key).catch(() => {});
            console.error('Asset upload error:', uploadError);
            res.status(uploadError.code === 'S3_NOT_CONFIGURED' ? 503 : 500).json({ message: uploadError.message || 'No se pudo guardar el asset.' });
        }
    });
});

router.post('/assets', async (req, res) => {
    try {
        const session = await ownedSession(req.user.id, req.body.sessionId);
        if (!session) return res.status(404).json({ message: 'La sala no existe o no te pertenece.' });
        const folderId = req.body.folderId || null;
        if (folderId && !await ownedFolder(req.user.id, folderId)) return res.status(404).json({ message: 'La carpeta de destino no existe.' });
        const url = String(req.body.url || '').trim();
        if (!url) return res.status(400).json({ message: 'El asset necesita una imagen.' });
        const type = req.body.type === 'MAP' ? 'MAP' : 'IMAGE';
        const asset = await GameAsset.create({
            session_id: session.id,
            owner_user_id: req.user.id,
            folder_id: folderId,
            title: String(req.body.title || 'Asset sin título').trim().slice(0, 160),
            url,
            storage_key: req.body.storageKey || null,
            type,
            grid_enabled: type === 'MAP' && Boolean(req.body.gridEnabled),
            sort_order: await nextSortOrder(GameAsset, { owner_user_id: req.user.id, folder_id: folderId }),
        });
        res.status(201).json({ asset });
    } catch (error) {
        console.error('Asset URL create error:', error);
        res.status(500).json({ message: 'No se pudo guardar el asset.' });
    }
});

router.patch('/assets/:id', async (req, res) => {
    try {
        const asset = await GameAsset.findOne({ where: { id: req.params.id, owner_user_id: req.user.id } });
        if (!asset) return res.status(404).json({ message: 'El asset no existe.' });
        const updates = {};
        if (Object.prototype.hasOwnProperty.call(req.body, 'folderId')) {
            const folderId = req.body.folderId || null;
            if (folderId && !await ownedFolder(req.user.id, folderId)) return res.status(404).json({ message: 'La carpeta de destino no existe.' });
            updates.folder_id = folderId;
            updates.sort_order = await nextSortOrder(GameAsset, { owner_user_id: req.user.id, folder_id: folderId });
        }
        if (req.body.title !== undefined) updates.title = String(req.body.title || '').trim().slice(0, 160) || asset.title;
        await asset.update(updates);
        res.json({ asset });
    } catch (error) {
        console.error('Asset update error:', error);
        res.status(500).json({ message: 'No se pudo mover el asset.' });
    }
});

router.delete('/assets/:id', async (req, res) => {
    try {
        const asset = await GameAsset.findOne({ where: { id: req.params.id, owner_user_id: req.user.id } });
        if (!asset) return res.status(404).json({ message: 'El asset no existe.' });
        await asset.destroy();
        res.sendStatus(204);
    } catch (error) {
        console.error('Asset delete error:', error);
        res.status(500).json({ message: 'No se pudo eliminar el asset.' });
    }
});

module.exports = router;
