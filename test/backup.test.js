import { test, describe } from 'node:test';
import { sourcesOf } from '../js/model/sources.js';
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
    format: 'lignee',
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
  assert.equal(parseBackup(JSON.stringify({ format: 'lignee', people: [], unions: [] })).people.length, 0, 'sans version : lu');
  assert.equal(JSON.parse(buildBackup()).version, FORMAT_VERSION);
});

test('le serveur connaît la même version du format', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.equal(Number(/const FORMAT_VERSION = (\d+);/.exec(src)[1]), FORMAT_VERSION);
});

describe('format 2 : sources partagées', () => {
  // Format 1 : chaque fiche porte ses documents ; le même acte de mariage chez les deux époux
  const v1 = {
    format: 'lignee', version: 1, name: 'V1',
    people: [
      { id: 'a', given: 'Jean', sources: [
        { id: 's1', fact: 'union:u', kind: 'marriage', title: 'Mariage', place: 'Lyon', ref: 'n°12', photo: 'data:image/png;base64,AAAA' },
        { id: 's2', fact: 'birth', kind: 'birth', title: '' },
      ] },
      { id: 'b', given: 'Marie', sources: [
        { id: 's9', fact: 'union:u', kind: 'marriage', title: 'Mariage', place: 'Lyon', ref: 'n°12', photo: 'data:image/png;base64,AAAA' },
        { id: 's3', fact: 'birth', kind: 'birth', title: '' },
      ] },
    ],
    unions: [{ id: 'u', a: 'a', b: 'b' }],
  };
  const read = (o) => {
    const r = parseBackup(JSON.stringify(o));
    const sources = new Map(r.sources.map((x) => [x.id, x.data]));
    const people = new Map(r.people.map((x) => [x.id, x.data]));
    return { r, sources, people };
  };

  test('format 1 converti : le même acte devient une source partagée, les actes vides restent à part', () => {
    const { sources, people } = read(v1);
    assert.equal(people.get('a').sources, undefined);
    const [ma, na] = people.get('a').citations;
    const [mb, nb] = people.get('b').citations;
    assert.equal(ma.source, mb.source, 'acte de mariage partagé');
    assert.notEqual(na.source, nb.source, 'deux naissances sans cote ni image : deux actes distincts');
    assert.equal(sources.size, 3);
    assert.deepEqual(sources.get(ma.source), { kind: 'marriage', title: 'Mariage', place: 'Lyon', ref: 'n°12', photo: 'data:image/png;base64,AAAA' });
    assert.deepEqual(ma, { id: 's1', source: ma.source, fact: 'union:u' });
    // Les documents vus par l'application : comme en format 1
    const resolved = sourcesOf(people.get('a'), sources).map(({ source, ...x }) => x);
    assert.deepEqual(resolved, [
      { kind: 'marriage', title: 'Mariage', place: 'Lyon', ref: 'n°12', photo: 'data:image/png;base64,AAAA', id: 's1', fact: 'union:u' },
      { kind: 'birth', id: 's2', fact: 'birth' },
    ]);
  });

  test('conversion stable : relire deux fois donne les mêmes identifiants', () => {
    assert.deepEqual(read(v1).r, read(v1).r);
  });

  test('format 2 : relu à l’identique, et export compatible format 1', () => {
    const { people, sources, r } = read(v1);
    const tree = { name: 'V2', people, unions: new Map(r.unions.map((x) => [x.id, x.data])), sources };
    const v2 = JSON.parse(buildBackup(tree));
    assert.equal(v2.version, 2);
    assert.equal(v2.sources.length, 3);
    assert.deepEqual(read(v2).r, { ...r, name: 'V2' });
    const old = JSON.parse(buildBackup(tree, { v1: true }));
    assert.equal(old.version, 1);
    assert.equal(old.sources, undefined);
    assert.equal(old.people[0].citations, undefined);
    assert.deepEqual(old.people[1].sources.map((x) => [x.id, x.fact, x.ref || '']), [['s9', 'union:u', 'n°12'], ['s3', 'birth', '']]);
    // Retour en format 2 : les mêmes sources
    assert.deepEqual(read(old).sources, sources);
  });
});
