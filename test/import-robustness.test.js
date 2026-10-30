import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { S } from '../js/state.js';
import { treeStats } from '../js/model/stats.js';
import { buildGedcom } from '../js/services/gedcom.js';
import { loadTree, person } from './helpers.js';

describe('fichiers importés mal formés', () => {
  test('une valeur piégée ne fait pas planter les calculs ni le GEDCOM', () => {
    loadTree([
      person('a', { sex: 'constructor', birthDate: '1900', deathDate: '1950', deceased: true, situation: 'x\n0 @I9@ INDI',
        events: [{ id: 'e', type: 'constructor', date: '1920' }], sources: [{ id: 's', fact: '', kind: '__proto__\n1 EVIL' }] }),
      person('b', { sex: 'F' }),
    ], [{ id: 'u', a: 'a', b: 'b', end: 'x\n0 TRLR', date: '' }]);
    S.focus = 'a';
    assert.equal(treeStats().longevity.n, 1);
    const ged = buildGedcom();
    assert.ok(!/^0 @I9@|^1 EVIL|EVIL/m.test(ged));
    assert.equal(ged.match(/^0 TRLR/gm).length, 1);
    assert.match(ged, /1 EVEN/);
  });
});
