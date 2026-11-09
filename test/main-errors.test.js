import assert from 'node:assert/strict';
import { test } from 'node:test';
import { S, services } from '../js/state.js';

const settle = () => new Promise((r) => setTimeout(r, 30));

test('startup in claude.ai when permissions and downloads cannot be read', async () => {
  globalThis.fetch = async () => { throw new TypeError('offline'); };
  const db = { collection: () => ({ onSnapshot: (fn) => fn({ docs: [] }), doc: () => ({}) }) };
  window.claude = {
    use: async (name) => {
      if (name === 'db') return db;
      if (name === 'user') return { can: async () => { throw new Error('unknown'); } };
      throw new Error('no downloads');
    },
  };
  await import('../js/main.js');
  await settle();
  assert.equal(S.mode, 'db');
  assert.equal(S.canWrite, true, 'the save decides when the permission is unknown');
  assert.equal(S.writeKnown, false);
  assert.equal(services.downloads, null);
  assert.equal(document.getElementById('appVersion').textContent, '', 'no version without package.json');
});
