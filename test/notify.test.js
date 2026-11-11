import assert from 'node:assert/strict';
import { test } from 'node:test';
import { on, emit, say, failure } from '../js/services/notify.js';

test('notify: services talk to the interface without importing it', () => {
  const got = [];
  on('test-event', (...args) => got.push(args));
  emit('test-event', 1, 2);
  emit('nobody-listens');
  assert.deepEqual(got, [[1, 2]]);

  // ui/connect.js (wired by test/setup.js) shows the messages
  say('st.renameFailed', true);
  assert.match(document.getElementById('toast').textContent, /changement de nom a échoué/);
  const e = new Error('x');
  assert.equal(failure('st.deleteFailed', e), e);
  assert.equal(e.reported, true);
  assert.match(document.getElementById('toast').textContent, /suppression a échoué/);
});
