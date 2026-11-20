import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('un champ fichier caché reste dans son bouton : la page ne s’allonge pas', () => {
  // Placé contre la page, bas dans un long formulaire défilant, il donnait un ascenseur géant
  assert.match(read('../css/base.css'), /label:has\(> input\.sr\) \{\s*position: relative;/);
  const sources = [read('../index.html'), ...readdirSync(new URL('../js/ui/', import.meta.url))
    .filter((f) => f.endsWith('.js')).map((f) => read(`../js/ui/${f}`))];
  for (const src of sources) {
    for (const m of src.matchAll(/<input [^>]*class="sr"[^>]*>/g)) {
      const before = src.slice(Math.max(0, m.index - 200), m.index);
      assert.match(before, /<label [^>]*>\s*$/, `dans un label : ${m[0]}`);
    }
  }
});
