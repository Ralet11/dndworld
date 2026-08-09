const npcImageMap = require('../data/npc-image-map.json');

function normalizeNpcName(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

const npcImageByName = new Map(
    npcImageMap.map(entry => [normalizeNpcName(entry.name), entry.file]),
);

function resolveCharacterImage(character) {
    if (!character) return null;
    if (character.rendered_url) return character.rendered_url;
    if (character.image_url) return character.image_url;
    if (character.base_body_url) return character.base_body_url;

    const localImage = npcImageByName.get(normalizeNpcName(character.name));
    return localImage ? `/npc-images/${encodeURIComponent(localImage)}` : null;
}

module.exports = { resolveCharacterImage };
