import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { S } from '../js/state.js';
import { EXAMPLE_FILE } from '../js/config.js';

const settle = () => new Promise((r) => setTimeout(r, 30));

test('startup outside claude.ai without the local server: browser storage and example family', async () => {
  delete window.claude;
  const fetched = [];
  globalThis.fetch = async (url) => {
    fetched.push(String(url));
    if (url === 'package.json') return { json: async () => ({ version: '9.9.9' }) };
    if (url === EXAMPLE_FILE) return { ok: true, text: async () => readFileSync(EXAMPLE_FILE, 'utf8') };
    throw new TypeError('no server');
  };
  await import('../js/main.js');
  await settle();
  assert.equal(S.mode, 'local');
  assert.ok(S.loadedP && S.loadedU);
  assert.ok(S.people.size > 0, 'the example family is shown');
  assert.equal(document.getElementById('appVersion').textContent, 'v9.9.9');
  assert.ok(fetched.includes('package.json'));
});
