const test = require('node:test');
const assert = require('node:assert/strict');
const { visibleTableMessages } = require('../sockets/gameSessionSocket');

const messages = [
    { id: 'legacy', text: 'mensaje público anterior' },
    { id: 'player-a', player_user_id: 'a', text: 'canal A' },
    { id: 'player-b', player_user_id: 'b', text: 'canal B' },
];

test('players only receive their private conversation with the DM', () => {
    assert.deepEqual(
        visibleTableMessages(messages, { user: { id: 'a', role: 'PLAYER' } }).map(message => message.id),
        ['player-a'],
    );
});

test('the DM receives every direct player channel but not the legacy public chat', () => {
    assert.deepEqual(
        visibleTableMessages(messages, { user: { id: 'dm', role: 'DM' } }).map(message => message.id),
        ['player-a', 'player-b'],
    );
});
