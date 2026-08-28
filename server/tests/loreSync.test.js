const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
    applyLoreSync,
    buildLoreSyncPlan,
    isSelectedText,
} = require('../services/loreSync');

function write(root, relative, content = '') {
    const absolute = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content);
    return absolute;
}

function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dndworld-lore-'));
    const sourceRoot = path.join(root, 'ecos_de_la_guerra');
    const serverRoot = path.join(root, 'server');
    write(sourceRoot, 'campaign/maestro.md', '# Maestro\nEstado actual.\n');
    write(sourceRoot, 'campaign/chronology.txt', 'Cronologia');
    write(sourceRoot, 'campaign/sessions/session8.md', 'Imagen: ![Mapa](../cities/costa/mapa.png)');
    write(sourceRoot, 'campaign/characters/paleas.txt', 'Paleas');
    write(sourceRoot, 'campaign/cities/costa/dossier.md', 'Costa');
    write(sourceRoot, 'campaign/cities/costa/mapa.png', Buffer.from([1, 2, 3]));
    write(sourceRoot, 'campaign/cities/costa/no-usada.png', Buffer.from([4, 5, 6]));
    write(sourceRoot, 'campaign/archive.zip', 'no');
    write(sourceRoot, 'Lore/legacy.txt', 'no');
    return { root, sourceRoot, serverRoot };
}

test('selecciona solo las familias de lore autorizadas', () => {
    assert.equal(isSelectedText('campaign/maestro.md'), true);
    assert.equal(isSelectedText('campaign/cities/costa/dossier.md'), true);
    assert.equal(isSelectedText('campaign/sessions/session8.md'), true);
    assert.equal(isSelectedText('campaign/archive.zip'), false);
    assert.equal(isSelectedText('Lore/legacy.txt'), false);
});

test('dry-run no escribe y solo incluye medios referenciados', (t) => {
    const data = fixture();
    t.after(() => fs.rmSync(data.root, { recursive: true, force: true }));
    const plan = buildLoreSyncPlan(data);
    const selected = plan.files.map((file) => file.relative);
    assert.ok(selected.includes('campaign/cities/costa/mapa.png'));
    assert.ok(!selected.includes('campaign/cities/costa/no-usada.png'));
    assert.equal(fs.existsSync(path.join(data.serverRoot, 'data/lore/ecos')), false);
    assert.equal(plan.hasChanges, true);
});

test('apply genera espejo, contexto de Oracle y manifiesto determinista', (t) => {
    const data = fixture();
    t.after(() => fs.rmSync(data.root, { recursive: true, force: true }));
    const first = buildLoreSyncPlan(data);
    applyLoreSync(first, { allowDirty: true });
    const oracle = fs.readFileSync(path.join(data.serverRoot, 'data/lore/campaign-context.md'), 'utf8');
    assert.match(oracle, /ARCHIVO GENERADO/);
    assert.match(oracle, /# Maestro/);
    assert.ok(fs.existsSync(path.join(data.serverRoot, 'data/lore/ecos/campaign/characters/paleas.txt')));
    const second = buildLoreSyncPlan(data);
    assert.equal(second.hasChanges, false);
    assert.ok(second.files.every((file) => file.status === 'unchanged'));
});

test('apply elimina del espejo archivos antes administrados que ya no corresponden', (t) => {
    const data = fixture();
    t.after(() => fs.rmSync(data.root, { recursive: true, force: true }));
    applyLoreSync(buildLoreSyncPlan(data), { allowDirty: true });
    fs.rmSync(path.join(data.sourceRoot, 'campaign/characters/paleas.txt'));
    const plan = buildLoreSyncPlan(data);
    assert.equal(plan.removed.length, 1);
    applyLoreSync(plan, { allowDirty: true });
    assert.equal(fs.existsSync(path.join(data.serverRoot, 'data/lore/ecos/campaign/characters/paleas.txt')), false);
});
