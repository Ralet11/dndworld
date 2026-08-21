const test = require('node:test');
const assert = require('node:assert/strict');
const {
    folderParts,
    normalizeFolderName,
    normalizeRelativePath,
    wouldCreateFolderCycle,
} = require('../services/assetLibrary');

test('normaliza rutas importadas y conserva la jerarquía útil', () => {
    assert.equal(
        normalizeRelativePath('campaign\\cities\\costa_oscura\\mercado del puerto\\imagen.png'),
        'campaign/cities/costa_oscura/mercado del puerto/imagen.png',
    );
    assert.deepEqual(folderParts('cities/costa_oscura/mercado del puerto'), [
        'cities', 'costa_oscura', 'mercado del puerto',
    ]);
});

test('descarta recorridos y separadores peligrosos en nombres de carpeta', () => {
    assert.equal(normalizeRelativePath('../campaign/./cities/../../map.png'), 'campaign/cities/map.png');
    assert.equal(normalizeFolderName('  mercado\\del/puerto  '), 'mercado del puerto');
});

test('detecta ciclos al mover carpetas', async () => {
    const parents = new Map([
        ['child', { parent_id: 'root' }],
        ['grandchild', { parent_id: 'child' }],
        ['root', { parent_id: null }],
    ]);
    const Folder = {
        findOne: async ({ where }) => parents.get(where.id) || null,
    };
    assert.equal(await wouldCreateFolderCycle(Folder, 'dm', 'root', 'grandchild'), true);
    assert.equal(await wouldCreateFolderCycle(Folder, 'dm', 'child', 'root'), false);
});
