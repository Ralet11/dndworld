import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { usePropDraft } from '../src/hooks/usePropDraft.js';
import { useClassSpells } from '../src/hooks/useClassSpells.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function socketFixture() {
  const listeners = new Set();
  const requests = [];
  return {
    listeners, requests,
    on: (_event, handler) => listeners.add(handler),
    off: (_event, handler) => listeners.delete(handler),
    emit: (event, payload) => requests.push({ event, payload }),
    reply: spells => { for (const handler of listeners) handler(spells); },
  };
}

test('draft edits persist until authoritative input changes, including switching back', async () => {
  let value, setValue;
  function Probe({ source }) {
    const result = usePropDraft(source);
    useEffect(() => { [value, setValue] = result; });
    return null;
  }
  let root;
  await act(() => { root = create(createElement(Probe, { source: 'first' })); });
  await act(() => setValue('local edit'));
  assert.equal(value, 'local edit');
  await act(() => root.update(createElement(Probe, { source: 'first' })));
  assert.equal(value, 'local edit');
  await act(() => root.update(createElement(Probe, { source: 'second' })));
  assert.equal(value, 'second');
  await act(() => root.update(createElement(Probe, { source: 'first' })));
  assert.equal(value, 'first');
  await act(() => setValue(previous => `${previous}!`));
  assert.equal(value, 'first!');
  await act(() => root.unmount());
});

test('spells register before requesting, sort without mutation, reset on class change and clean up', async () => {
  const socket = socketFixture();
  let value, root;
  function Probe({ names }) {
    const result = useClassSpells(socket, names);
    useEffect(() => { value = result; });
    return null;
  }
  await act(() => { root = create(createElement(Probe, { names: ['wizard'] })); });
  assert.equal(value.loading, true);
  assert.equal(socket.listeners.size, 1);
  assert.deepEqual(socket.requests[0], { event: 'get-class-spells', payload: { class_names: ['wizard'] } });
  const spells = [{ level: 2, name: 'B' }, { level: 1, name: 'A' }];
  await act(() => socket.reply(spells));
  assert.equal(value.loading, false);
  assert.deepEqual(value.spells.map(s => s.name), ['A', 'B']);
  assert.equal(spells[0].name, 'B');
  await act(() => root.update(createElement(Probe, { names: ['wizard'] })));
  assert.equal(socket.requests.length, 1, 'equal class list must not re-request');
  await act(() => root.update(createElement(Probe, { names: ['cleric'] })));
  assert.equal(value.loading, true);
  assert.deepEqual(value.spells, []);
  assert.equal(socket.listeners.size, 1);
  await act(() => root.update(createElement(Probe, { names: [] })));
  assert.equal(value.loading, false);
  assert.deepEqual(value.spells, []);
  assert.equal(socket.listeners.size, 0);
  await act(() => root.unmount());
});

test('spell state does not leak across socket changes or keep unmounted listeners', async () => {
  const first = socketFixture(), second = socketFixture();
  let value, root;
  function Probe({ socket }) {
    const result = useClassSpells(socket, ['wizard']);
    useEffect(() => { value = result; });
    return null;
  }
  await act(() => { root = create(createElement(Probe, { socket: first })); });
  const lateHandler = [...first.listeners][0];
  await act(() => first.reply([{ level: 1, name: 'First' }]));
  await act(() => root.update(createElement(Probe, { socket: second })));
  assert.equal(first.listeners.size, 0);
  assert.equal(value.loading, true);
  await act(() => lateHandler([{ level: 1, name: 'Stale' }]));
  assert.deepEqual(value.spells, []);
  await act(() => second.reply([{ level: 1, name: 'Second' }]));
  assert.equal(value.spells[0].name, 'Second');
  await act(() => root.unmount());
  assert.equal(second.listeners.size, 0);
});
