import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { S } from '../js/state.js';
import { relationship } from '../js/model/kinship.js';
import { t } from '../js/i18n.js';
import { loadTree, person } from './helpers.js';

describe('lien de parenté', () => {
  /* gp + gm -> p1, p2 ; p1 -> c1 ; p2 -> c2 ; c1 -> d1 ; c2 -> d2 */
  const family = () => loadTree([
    person('gp', { sex: 'M' }), person('gm', { sex: 'F' }),
    person('p1', { sex: 'M', fatherId: 'gp', motherId: 'gm' }), person('p2', { sex: 'F', fatherId: 'gp', motherId: 'gm' }),
    person('c1', { sex: 'M', fatherId: 'p1' }), person('c2', { sex: 'F', motherId: 'p2' }),
    person('d1', { sex: 'F', fatherId: 'c1' }), person('d2', { sex: 'M', motherId: 'c2' }),
    person('sp', { sex: 'F' }), person('x', { sex: 'M' }),
  ], [{ a: 'c1', b: 'sp' }]);
  const term = (a, b) => {
    const r = relationship(a, b);
    return t('kin.term', r.da, r.db, S.people.get(a).sex, r.half);
  };

  test('termes', () => {
    family();
    assert.equal(term('p1', 'p2'), 'frère');
    assert.equal(term('gp', 'c1'), 'grand-père');
    assert.equal(term('gm', 'd1'), 'arrière-grand-mère');
    assert.equal(term('d1', 'gp'), 'arrière-petite-fille');
    assert.equal(term('p2', 'c1'), 'tante');
    assert.equal(term('c1', 'p2'), 'neveu');
    assert.equal(term('p1', 'd2'), 'grand-oncle');
    assert.equal(term('c1', 'c2'), 'cousin germain');
    assert.equal(term('d1', 'd2'), 'cousine issue de germains');
    assert.equal(term('c1', 'd2'), 'oncle à la mode de Bretagne');
    assert.equal(term('d2', 'c1'), 'neveu à la mode de Bretagne');
  });

  test('ancêtres communs : le couple, et le chemin complet', () => {
    family();
    const r = relationship('c1', 'c2');
    assert.deepEqual(r.ancestors.slice().sort(), ['gm', 'gp']);
    assert.deepEqual(r.path, ['c1', 'p1', 'gp', 'p2', 'c2']);
  });

  test('demi-frères : un seul parent commun, l’autre connu et différent', () => {
    loadTree([
      person('f', { sex: 'M' }), person('m1', { sex: 'F' }), person('m2', { sex: 'F' }),
      person('a', { sex: 'M', fatherId: 'f', motherId: 'm1' }), person('b', { sex: 'M', fatherId: 'f', motherId: 'm2' }),
      person('c', { sex: 'M', fatherId: 'f' }),
    ]);
    assert.equal(relationship('a', 'b').half, true);
    assert.equal(relationship('a', 'c').half, false); // mère de c inconnue : on ne conclut pas
  });

  test('conjoints, alliance, aucun lien, même personne', () => {
    family();
    assert.equal(relationship('c1', 'sp').type, 'spouse');
    const alliance = relationship('sp', 'c2');
    assert.equal(alliance.type, 'alliance');
    assert.equal(alliance.via, 'c1');
    assert.deepEqual(alliance.path, ['sp', 'c1', 'p1', 'gp', 'p2', 'c2']);
    assert.equal(relationship('c2', 'sp').viaSide, 'b');
    assert.equal(relationship('x', 'gp').type, 'none');
    assert.equal(relationship('gp', 'gp').type, 'same');
  });

  test('boucle dans les données : le calcul se termine', () => {
    loadTree([person('a', { fatherId: 'b' }), person('b', { fatherId: 'a' }), person('c', { fatherId: 'a' })]);
    assert.equal(relationship('a', 'c').type, 'blood');
  });
});
