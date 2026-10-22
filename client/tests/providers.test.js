import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement, useEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function loadProviders(t) {
  const directory = await mkdtemp(path.resolve('node_modules/.provider-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const outfile = path.join(directory, 'providers.mjs');
  await build({
    stdin: {
      contents: `export { AuthProvider } from './src/context/AuthContext.jsx';
        export { useAuth } from './src/context/auth.js';
        export { CampaignProvider } from './src/context/CampaignContext.jsx';
        export { useCampaign } from './src/context/campaign.js';`,
      resolveDir: process.cwd(), loader: 'jsx',
    },
    outfile, bundle: true, format: 'esm', platform: 'node', packages: 'external', jsx: 'automatic',
    define: { 'import.meta.env.PROD': 'false', 'import.meta.env.VITE_API_URL': '""' },
    plugins: [{ name: 'isolated-socket', setup(builder) {
      builder.onResolve({ filter: /SocketContext$/ }, () => ({ path: 'socket', namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export function useSocket() { return { socket: null, connected: false }; }' }));
    } }],
  });
  return import(pathToFileURL(outfile).href);
}

function storageFixture(t, initial = {}) {
  const original = globalThis.localStorage;
  const entries = new Map(Object.entries(initial));
  globalThis.localStorage = {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: key => entries.delete(key),
  };
  t.after(() => { globalThis.localStorage = original; });
}

test('auth starts without a loading flash or fetch when no token is stored', async t => {
  storageFixture(t);
  const { AuthProvider, useAuth } = await loadProviders(t);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Unexpected request'); };
  t.after(() => { globalThis.fetch = originalFetch; });
  let value, root;
  function Probe() { const auth = useAuth(); useEffect(() => { value = auth; }); return null; }
  await act(() => { root = create(createElement(AuthProvider, null, createElement(Probe))); });
  assert.equal(value.isLoading, false);
  assert.equal(value.user, null);
  await act(() => root.unmount());
});

test('auth resolves a stored session and clears a rejected token', async t => {
  storageFixture(t, { dnd_token: 'local-test-only' });
  const { AuthProvider, useAuth } = await loadProviders(t);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false });
  t.after(() => { globalThis.fetch = originalFetch; });
  let value, root;
  function Probe() { const auth = useAuth(); useEffect(() => { value = auth; }); return null; }
  await act(() => { root = create(createElement(AuthProvider, null, createElement(Probe))); });
  assert.equal(value.isLoading, false);
  assert.equal(value.user, null);
  assert.equal(localStorage.getItem('dnd_token'), null);
  await act(() => root.unmount());
});

test('authorized campaign remains ready without a socket and clears when access disappears', async t => {
  storageFixture(t, { dnd_campaign_id: 'one' });
  const { CampaignProvider, useCampaign } = await loadProviders(t);
  const originalFetch = globalThis.fetch;
  let campaigns = [{ id: 'one', name: 'Local fixture' }];
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ campaigns }) });
  t.after(() => { globalThis.fetch = originalFetch; });
  let value, root;
  function Probe() { const context = useCampaign(); useEffect(() => { value = context; }); return null; }
  await act(() => { root = create(createElement(CampaignProvider, null, createElement(Probe))); });
  assert.equal(value.loading, false);
  assert.equal(value.campaign.id, 'one');
  assert.equal(value.campaignReady, true);
  campaigns = [];
  await act(() => value.refresh());
  assert.equal(value.campaign, null);
  assert.equal(value.campaignReady, false);
  await act(() => root.unmount());
});
