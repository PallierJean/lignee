import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, parseBackup } from '../js/services/backup.js';
import { example } from './helpers.js';

test('sauvegarde puis relecture à l’identique', () => {
  const ex = example();
  const strip = ({ id, ...rest }) => [id, rest];
  const text = buildBackup({
    name: 'Bertrand', createdAt: 42,
    people: new Map(ex.people.map(strip)),
    unions: new Map(ex.unions.map(strip)),
  });
  const o = JSON.parse(text);
  assert.equal(o.format, 'lignee');
  assert.equal(o.version, 1);
  assert.equal(o.createdAt, 42);
  const back = parseBackup(text);
  assert.equal(back.name, 'Bertrand');
  assert.deepEqual(back.people.map((x) => ({ id: x.id, ...x.data })), ex.people);
  assert.deepEqual(back.unions.map((x) => ({ id: x.id, ...x.data })), ex.unions);
});

test('refuse ce qui n’est pas une sauvegarde Lignée', () => {
  assert.throws(() => parseBackup('{"people":[]}'));
  assert.throws(() => parseBackup('pas du JSON'));
});

test('identifiants dangereux écartés, nom raccourci', () => {
  const back = parseBackup(JSON.stringify({
    format: 'lignee',
    name: '  ' + 'n'.repeat(100),
    people: [{ id: 'ok_1' }, { id: '..' }, { id: '__proto__/x' }, { id: 7 }, null],
    unions: 'pas une liste',
  }));
  assert.deepEqual(back.people.map((x) => x.id), ['ok_1']);
  assert.deepEqual(back.unions, []);
  assert.equal(back.name.length, 80);
});
