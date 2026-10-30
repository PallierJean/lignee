import assert from 'node:assert/strict';
import { test } from 'node:test';
import { S, services } from '../js/state.js';

const settle = () => new Promise((r) => setTimeout(r, 30));

test('démarrage dans claude.ai : base en ligne, droits, téléchargements', async () => {
  const db = { collection: () => ({ onSnapshot: (fn) => fn({ docs: [] }), doc: () => ({}) }) };
  window.claude = {
    use: async (name) => ({ db, user: { can: async () => false }, downloads: { save() {} } }[name]),
  };
  await import('../js/main.js');
  await settle();
  assert.equal(S.mode, 'db');
  assert.equal(S.canWrite, false);
  assert.equal(S.writeKnown, true);
  assert.ok(services.downloads);
});
