import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { timelineOf } from '../js/model/timeline.js';
import { loadTree, person } from './helpers.js';

describe('frise', () => {
  test('vie de la personne et repères de son époque, dans l’ordre', () => {
    loadTree([
      person('a', { given: 'Jean', birthDate: '1910', deathDate: '1950', events: [{ id: 'e', type: 'census', date: '1936' }] }),
      person('b', { given: 'Anne', birthDate: '1912' }),
    ], [{ id: 'u', a: 'a', b: 'b', date: '1935' }]);
    const rows = timelineOf('a', false);
    assert.deepEqual(rows.map((r) => r.year), rows.map((r) => r.year).slice().sort((x, y) => x - y));
    assert.ok(rows.some((r) => r.kind === 'history' && r.year === 1914));
    assert.ok(!rows.some((r) => r.year < 1910 || r.year > 1950));
    assert.ok(rows.some((r) => r.kind === 'event' && r.year === 1936));
    assert.equal(rows.filter((r) => r.kind === 'union').length, 1);
    assert.ok(timelineOf('a', true).some((r) => r.kind === 'birth' && r.id === 'b'));
  });

  test('personne vivante : jusqu’à aujourd’hui ; sans date : vide', () => {
    loadTree([person('a', { birthDate: '2000' }), person('b')]);
    assert.ok(timelineOf('a', false, new Date(2026, 0, 1)).some((r) => r.year === 2020));
    assert.deepEqual(timelineOf('b', false), []);
  });

  test('à la naissance, une femme porte son nom de jeune fille', () => {
    loadTree([
      person('j', { given: 'Jacques', surname: 'Martin', sex: 'M', birthDate: '1930' }),
      person('e', { given: 'Élise', surname: 'Martin', maidenName: 'Laborde', sex: 'F', birthDate: '1937' }),
      person('p', { given: 'Pierre', surname: 'Roux', sex: 'M', birthDate: '1905' }),
      // Sans nom de jeune fille saisi : celui de son père
      person('m', { given: 'Marie', surname: 'Martin', sex: 'F', birthDate: '1932', fatherId: 'p' }),
      person('c', { given: 'Véro', surname: 'Martin', sex: 'F', birthDate: '1961', fatherId: 'j', motherId: 'e' }),
    ], [{ id: 'u', a: 'j', b: 'e', date: '1960' }]);
    const births = timelineOf('j', true).filter((r) => r.kind === 'birth').map((r) => r.label);
    assert.ok(births.includes('Naissance · Élise LABORDE'));
    assert.ok(births.includes('Naissance · Véro MARTIN'));
    assert.ok(births.includes('Naissance · Jacques MARTIN'));
    assert.ok(timelineOf('m', true).some((r) => r.label === 'Naissance · Marie ROUX'));
  });
});
