import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { S } from '../js/state.js';
import { buildBackup, parseBackup } from '../js/services/backup.js';
import { buildGedcom } from '../js/services/gedcom.js';
import { reindex } from '../js/model/people.js';
import { sourcesOf } from '../js/model/sources.js';

/**
 * Arbre synthétique au format 1, de 3 000 personnes : chaque couple partage son acte de mariage
 * (même cote, même image), chacun a ses actes de naissance et de décès, certains vides.
 */
function bigTree(n = 3000) {
  const people = [];
  const unions = [];
  for (let i = 0; i < n; i += 2) {
    const [a, b] = [`p${i}`, `p${i + 1}`];
    const marriage = { kind: 'marriage', title: 'Acte de mariage', place: 'Lyon', ref: `M${i}`, photo: `data:image/jpeg;base64,${btoa('m' + i)}` };
    for (const [id, k] of [[a, 0], [b, 1]]) {
      people.push({
        id, given: `Prénom${i + k}`, surname: `NOM${i % 97}`, sex: k ? 'F' : 'M',
        fatherId: i >= 4 && !k ? `p${i - 4}` : null, motherId: i >= 4 && !k ? `p${i - 3}` : null,
        sources: [
          { id: 's1', fact: 'birth', kind: 'birth', title: `Naissance ${i + k}`, ref: `N${i + k}` },
          { id: 's2', fact: `union:u${i}`, ...marriage },
          // Un acte pas encore trouvé : ni cote ni image, il reste propre à la fiche
          { id: 's3', fact: 'death', kind: 'death', title: '' },
        ],
      });
    }
    unions.push({ id: `u${i}`, a, b, date: '1900' });
  }
  return { format: 'lignee', version: 1, name: 'Grand arbre', people, unions };
}

const open = (r) => {
  S.people = new Map(r.people.map((x) => [x.id, x.data]));
  S.unions = new Map(r.unions.map((x) => [x.id, x.data]));
  S.sources = new Map(r.sources.map((x) => [x.id, x.data]));
  reindex();
};

describe('migration au format 2 : 3 000 personnes', () => {
  const v1 = bigTree();
  const text = JSON.stringify(v1);

  test('rapide, rien de perdu, actes de mariage partagés', () => {
    const t0 = performance.now();
    const r = parseBackup(text);
    const ms = performance.now() - t0;
    assert.ok(ms < 3000, `conversion en ${Math.round(ms)} ms`);
    assert.equal(r.people.length, 3000);
    // 3 000 naissances + 1 500 mariages partagés + 3 000 actes vides propres à chaque fiche
    assert.equal(r.sources.length, 7500);
    open(r);
    for (const p of v1.people) {
      const got = sourcesOf(S.people.get(p.id)).map(({ source, ...x }) => x);
      const want = p.sources.map((x) => Object.fromEntries(Object.entries(x).filter(([, v]) => v !== '')));
      assert.deepEqual(got, want, p.id);
    }
    const [a, b] = [S.people.get('p0'), S.people.get('p1')];
    assert.equal(a.citations[1].source, b.citations[1].source, 'un seul acte de mariage pour le couple');
    assert.notEqual(a.citations[2].source, b.citations[2].source, 'deux actes de décès vides restent distincts');
  });

  test('stable : convertir deux fois, relire le format 2, revenir au format 1', () => {
    const first = parseBackup(text);
    assert.deepEqual(parseBackup(text), first, 'mêmes identifiants');
    open(first);
    const v2 = buildBackup();
    const again = parseBackup(v2);
    assert.deepEqual(again.sources, first.sources);
    assert.deepEqual(again.people, first.people);
    const back = JSON.parse(buildBackup(undefined, { v1: true }));
    assert.equal(back.version, 1);
    assert.deepEqual(parseBackup(JSON.stringify(back)).sources.length, 7500);
  });

  test('export GEDCOM identique avant et après la conversion', () => {
    // Format 1 lu tel quel (sans conversion), puis converti
    S.people = new Map(v1.people.map(({ id, ...p }) => [id, p]));
    S.unions = new Map(v1.unions.map(({ id, ...u }) => [id, u]));
    S.sources = new Map();
    reindex();
    const strip = (g) => g.replace(/^1 DATE .*\r\n2 TIME .*\r\n/m, '');
    const before = strip(buildGedcom());
    open(parseBackup(text));
    assert.equal(strip(buildGedcom()), before);
  });
});
