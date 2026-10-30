import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { findIssues, findCycles } from '../js/model/checks.js';
import { example, loadTree, person } from './helpers.js';

const NOW = new Date(2026, 9, 30);
const codes = () => findIssues(NOW).map((x) => x.code);

describe('vérification de cohérence', () => {
  test('famille d’exemple : rien à signaler', () => {
    const ex = example();
    loadTree(ex.people, ex.unions);
    assert.deepEqual(codes(), []);
  });

  test('enfant né après le décès de sa mère, mère de 8 ans', () => {
    loadTree([
      person('m', { sex: 'F', birthDate: '1900', deathDate: '1950' }),
      person('a', { motherId: 'm', birthDate: '1908' }),
      person('b', { motherId: 'm', birthDate: '1952' }),
    ]);
    const found = findIssues(NOW);
    assert.ok(found.some((x) => x.code === 'parentTooYoung' && x.n === 8 && x.ids[0] === 'a'));
    assert.ok(found.some((x) => x.code === 'bornAfterDeath' && x.ids[0] === 'b'));
  });

  test('un père peut mourir avant la naissance, pas plus d’un an avant', () => {
    loadTree([
      person('f', { sex: 'M', birthDate: '01/01/1900', deathDate: '01/03/1930' }),
      person('a', { fatherId: 'f', birthDate: '01/10/1930' }),
      person('b', { fatherId: 'f', birthDate: '01/06/1932' }),
    ]);
    assert.deepEqual(findIssues(NOW).map((x) => [x.code, x.ids[0]]), [['bornAfterDeath', 'b']]);
  });

  test('décès à 130 ans, décès avant la naissance, date impossible, date future', () => {
    loadTree([
      person('a', { birthDate: '1700', deathDate: '1830' }),
      person('b', { birthDate: '1900', deathDate: '1850' }),
      person('c', { birthDate: '31/02/1900' }),
      person('d', { birthDate: '2932' }),
    ]);
    assert.deepEqual(codes().sort(), ['badDate', 'deathBeforeBirth', 'future', 'tooOld']);
  });

  test('dates imprécises : seul ce qui est certain est signalé', () => {
    loadTree([
      person('m', { sex: 'F', birthDate: 'vers 1900' }),
      person('a', { motherId: 'm', birthDate: 'vers 1912' }), // écart possible : 2 à 22 ans
      person('b', { birthDate: 'avant 1900', deathDate: '1880' }),
      person('c', { birthDate: 'printemps 1900', deathDate: '1800' }), // texte libre
    ]);
    assert.deepEqual(codes(), []);
  });

  test('boucle de parenté, soi-même comme parent', () => {
    loadTree([person('a', { fatherId: 'b' }), person('b', { motherId: 'c' }), person('c', { fatherId: 'a' }), person('d', { fatherId: 'd' })]);
    assert.deepEqual(findCycles().map((c) => c.slice().sort()), [['a', 'b', 'c'], ['d']]);
  });

  test('unions et événements', () => {
    loadTree([
      person('a', {
        birthDate: '1900', deathDate: '1950', events: [
          { id: 'e1', type: 'baptism', date: '1890' },
          { id: 'e2', type: 'census', date: '1960' },
          { id: 'e3', type: 'burial', date: '1940' },
          { id: 'e4', type: 'burial', date: '1951' },
        ],
      }),
      person('b', { birthDate: '1900' }),
    ], [{ a: 'a', b: 'b', date: '1955' }, { a: 'a', b: 'b', date: '1905' }]);
    const found = codes();
    for (const c of ['eventBeforeBirth', 'eventAfterDeath', 'burialBeforeDeath', 'unionAfterDeath', 'unionTooYoung']) assert.ok(found.includes(c), c);
    assert.equal(found.filter((c) => c === 'burialBeforeDeath').length, 1);
  });
});
