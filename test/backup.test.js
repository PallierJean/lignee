import { test, describe } from 'node:test';
import { sourcesOf } from '../js/model/sources.js';
import { sourcesOfPerson } from '../js/model/sources.js';
import assert from 'node:assert/strict';
import { buildBackup, parseBackup, FORMAT_VERSION } from '../js/services/backup.js';
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
  assert.equal(o.version, FORMAT_VERSION);
  assert.deepEqual(o.sources, []);
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
    format: 'lignee', version: 3,
    name: '  ' + 'n'.repeat(100),
    people: [{ id: 'ok_1' }, { id: '..' }, { id: '__proto__/x' }, { id: 7 }, null],
    unions: 'pas une liste',
  }));
  assert.deepEqual(back.people.map((x) => x.id), ['ok_1']);
  assert.deepEqual(back.unions, []);
  assert.equal(back.name.length, 80);
});

test('format plus récent : refusé clairement, sans rien lire', () => {
  const v = (version) => JSON.stringify({ format: 'lignee', version, people: [{ id: 'a', given: 'A' }], unions: [] });
  assert.throws(() => parseBackup(v(FORMAT_VERSION + 1)), { code: 'newer', message: /version plus récente/ });
  assert.equal(parseBackup(v(FORMAT_VERSION)).people.length, 1);
  assert.equal(JSON.parse(buildBackup()).version, FORMAT_VERSION);
});

test('le serveur connaît la même version du format', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.equal(Number(/const FORMAT_VERSION = (\d+);/.exec(src)[1]), FORMAT_VERSION);
});

test('formats 1 et 2 (avant Lignée 4.0) : refusés clairement, jamais lus à moitié', () => {
  const v1 = JSON.stringify({ format: 'lignee', version: 1, people: [{ id: 'a', given: 'A', sources: [{ id: 's', title: 'Acte' }] }], unions: [] });
  assert.throws(() => parseBackup(v1), { code: 'old', message: /avant Lignée 4\.0/ });
  const v2 = JSON.stringify({ format: 'lignee', version: 2, people: [{ id: 'a', given: 'A', media: [{ id: 'm', photo: 'photos/x.jpg' }] }], unions: [] });
  assert.throws(() => parseBackup(v2), { code: 'old', message: /Lignée 4\.1/ });
  assert.throws(() => parseBackup(JSON.stringify({ format: 'lignee', people: [], unions: [] })), { code: 'old' }, 'sans version : format 1');
});
