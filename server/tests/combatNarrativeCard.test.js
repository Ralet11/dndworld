const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCombatNarrativeCard } = require('../sockets/gameSessionSocket');

test('combat narrative cards normalize the shared image without changing the combat map', () => {
    assert.deepEqual(normalizeCombatNarrativeCard({
        url: ' /api/media/production/scene.png ',
        title: '  La puerta se abre  ',
    }, '2026-09-27T18:00:00.000Z'), {
        url: '/api/media/production/scene.png',
        title: 'La puerta se abre',
        shown_at: '2026-09-27T18:00:00.000Z',
    });
});

test('combat narrative cards reject empty images and provide a default title', () => {
    assert.equal(normalizeCombatNarrativeCard({ url: '   ' }), null);
    assert.equal(normalizeCombatNarrativeCard({ url: '/scene.png', title: '   ' }, 'now').title, 'Escena narrativa');
});
