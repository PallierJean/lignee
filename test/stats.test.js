import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { S } from '../js/state.js';
import { treeStats } from '../js/model/stats.js';
import { loadTree, person } from './helpers.js';

describe('statistiques', () => {
  test('noms, lieux, longévité, générations, complétude', () => {
    loadTree([
      person('gp', { surname: 'Martin', sex: 'M', birthDate: '01/06/1900', deathDate: '01/05/1980', birthPlace: 'Lyon' }),
      person('gm', { surname: 'Martin', maidenName: 'Roux', sex: 'F', birthDate: '1902', deathDate: '1992', birthPlace: 'lyon' }),
      person('p', { surname: 'Martin', sex: 'M', fatherId: 'gp', motherId: 'gm', birthDate: '1930', deathDate: 'avant 1990' }),
      person('c', { surname: 'Martin', sex: 'F', fatherId: 'p' }),
    ]);
    S.focus = 'c';
    const st = treeStats();
    assert.deepEqual(st.surnames, [{ name: 'MARTIN', n: 3 }, { name: 'ROUX', n: 1 }]);
    assert.deepEqual(st.places, [{ name: 'Lyon', n: 2 }]);
    assert.equal(st.longevity.n, 2);
    assert.equal(st.longevity.all, (79 + 90) / 2);
    assert.deepEqual(st.longevity.oldest, { id: 'gm', age: 90 });
    assert.deepEqual(st.generations.map((g) => [g.gen, g.people]), [[1, 2], [2, 1], [3, 1]]);
    assert.deepEqual(st.completeness.map((r) => [r.gen, r.found, r.expected]), [[1, 1, 2], [2, 2, 4]]);
  });

  test('un arbre à boucle ne bloque pas le calcul', () => {
    loadTree([person('a', { fatherId: 'b', motherId: 'b2' }), person('b', { fatherId: 'a' }), person('b2', { motherId: 'a' })]);
    S.focus = 'a';
    assert.ok(treeStats().completeness.length <= 30);
  });
});
