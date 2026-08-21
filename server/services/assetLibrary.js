const MAX_FOLDER_DEPTH = 20;

function normalizeFolderName(value) {
    return String(value || '').trim().replace(/[\\/]+/g, ' ').replace(/\s+/g, ' ').slice(0, 120);
}

function normalizeRelativePath(value) {
    const parts = String(value || '').replace(/\\/g, '/').split('/')
        .map(part => part.trim())
        .filter(part => part && part !== '.' && part !== '..');
    return parts.slice(0, MAX_FOLDER_DEPTH + 1).join('/').slice(0, 1000);
}

function folderParts(value) {
    return normalizeRelativePath(value).split('/').filter(Boolean).slice(0, MAX_FOLDER_DEPTH)
        .map(normalizeFolderName).filter(Boolean);
}

async function wouldCreateFolderCycle(Folder, ownerId, folderId, parentId) {
    let cursor = parentId;
    const seen = new Set();
    while (cursor) {
        if (String(cursor) === String(folderId)) return true;
        if (seen.has(String(cursor))) return true;
        seen.add(String(cursor));
        const parent = await Folder.findOne({ where: { id: cursor, owner_user_id: ownerId }, attributes: ['parent_id'] });
        if (!parent) return false;
        cursor = parent.parent_id;
    }
    return false;
}

module.exports = { MAX_FOLDER_DEPTH, folderParts, normalizeFolderName, normalizeRelativePath, wouldCreateFolderCycle };
