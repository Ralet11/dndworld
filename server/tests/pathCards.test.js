const test = require('node:test');
const assert = require('node:assert/strict');
const { expirePathCard, normalizePathCards } = require('../sockets/gameSessionSocket');

test('path cards keep only valid unique discarded cards', () => {
    assert.deepEqual(normalizePathCards({
        visible: true,
        discarded: ['life', 'life', 'unknown', 'chaos'],
        active: { cardId: 'chaos', round: 3, revealedAt: 'now' },
    }), {
        visible: true,
        discarded: ['life', 'chaos'],
        active: { cardId: 'chaos', round: 3, revealedAt: 'now' },
    });
});

test('the active passive expires when the round changes without restoring the card', () => {
    const state = { mode: 'COMBAT', pathCards: { visible: false, discarded: ['mind'], active: { cardId: 'mind', round: 2 } } };
    assert.deepEqual(expirePathCard(state, 3).pathCards, { visible: false, discarded: ['mind'], active: null });
    assert.equal(expirePathCard(state, 2), state);
});
