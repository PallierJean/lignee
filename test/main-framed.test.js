import assert from 'node:assert/strict';
import { test } from 'node:test';

test('shown inside another site: only a link to open the application on its own', async () => {
  window.top = {};
  globalThis.location = { href: 'https://example.org/lignee/' };
  await import('../js/main.js');
  const [p] = document.body.children;
  assert.equal(p.className, 'framed');
  const link = p.children.find((c) => c.tagName === 'A');
  assert.equal(link.href, 'https://example.org/lignee/');
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener');
});
