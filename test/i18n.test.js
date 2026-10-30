import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DICT } from '../js/i18n.js';

const root = new URL('../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), 'utf8');
const jsFiles = readdirSync(new URL('js/', root), { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f);

test('mêmes clés en français et en anglais', () => {
  const fr = Object.keys(DICT.fr);
  const en = Object.keys(DICT.en);
  assert.deepEqual(fr.filter((k) => !(k in DICT.en)), [], 'clés sans traduction anglaise');
  assert.deepEqual(en.filter((k) => !(k in DICT.fr)), [], 'clés anglaises inconnues en français');
});

test('même forme dans les deux langues (texte ou fonction, même nombre de formes)', () => {
  for (const k of Object.keys(DICT.fr)) {
    const a = DICT.fr[k];
    const b = DICT.en[k];
    assert.equal(typeof a, typeof b, k);
    if (Array.isArray(a)) assert.equal(a.length, b.length, k);
  }
});

test('les clés citées dans index.html existent', () => {
  const html = read('index.html');
  const keys = [
    ...[...html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/data-i18n-attr="([^"]+)"/g)].flatMap((m) => m[1].split(';').map((p) => p.split(':')[1].trim())),
  ];
  assert.ok(keys.length > 0);
  assert.deepEqual(keys.filter((k) => !(k in DICT.fr)), []);
});

test('les clés t(\'…\') du code existent', () => {
  const missing = [];
  for (const f of jsFiles) {
    // Clés écrites en entier ; les clés construites (« t('situ.' + code) ») sont vérifiées ailleurs
    for (const m of read(f).matchAll(/\bt\('([a-zA-Z][\w.]*)'(?!\s*\+)/g)) {
      if (!(m[1] in DICT.fr)) missing.push(f + ' : ' + m[1]);
    }
  }
  assert.deepEqual(missing, []);
});

test('clés construites : situations familiales et qualificatifs de date', async () => {
  const { SITUATIONS, EVENT_TYPES, SOURCE_KINDS, UNION_TYPES } = await import('../js/model/people.js');
  const keys = [
    ...SITUATIONS.map(([c]) => 'situ.' + c),
    ...EVENT_TYPES.map((c) => 'ev.' + c),
    ...UNION_TYPES.map((c) => 'ut.' + c),
    ...['death', 'divorce', 'separation'].map((c) => 'ue.' + c),
    'chk.unionEndBeforeStart',
    ...SOURCE_KINDS.map((c) => 'src.' + c),
    ...['cycle', 'badDate', 'future', 'deathBeforeBirth', 'tooOld', 'parentYounger', 'parentTooYoung', 'parentTooOld',
      'bornAfterDeath', 'eventBeforeBirth', 'eventAfterDeath', 'burialBeforeDeath', 'unionBeforeBirth', 'unionTooYoung',
      'unionAfterDeath'].map((c) => 'chk.' + c),
    ...['given', 'birth', 'death', 'place', 'parents', 'partner'].map((c) => 'dup.' + c),
    ...['abt', 'bef', 'aft'].flatMap((q) => ['date.' + q, 'date.' + q + 'Short']),
  ];
  for (const lang of ['fr', 'en']) assert.deepEqual(keys.filter((k) => !(k in DICT[lang])), [], lang);
});
