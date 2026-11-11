import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { mergeRecords, canonical, backupRecords } from '../js/services/merge.js';

const map = (o) => new Map(Object.entries(o));
const merge = (b, m, t, prefer) => {
  const { result, conflicts } = mergeRecords(map(b), map(m), map(t), prefer);
  return { result: Object.fromEntries(result), conflicts };
};

describe('fusion à trois voies', () => {
  test('champs différents changés de chaque côté : les deux restent', () => {
    const { result, conflicts } = merge(
      { a: { given: 'Ana', surname: 'X' } },
      { a: { given: 'Ana', surname: 'X', birthPlace: 'Lyon' } },
      { a: { given: 'Ana', surname: 'Durand' } },
    );
    assert.deepEqual(result, { a: { given: 'Ana', surname: 'Durand', birthPlace: 'Lyon' } });
    assert.deepEqual(conflicts, []);
  });

  test('même champ, même valeur : pas de conflit', () => {
    const { conflicts } = merge({ a: { given: 'A' } }, { a: { given: 'B' } }, { a: { given: 'B' } });
    assert.deepEqual(conflicts, []);
  });

  test('même champ, valeurs différentes : conflit réglé par le choix', () => {
    const args = [{ a: { given: 'A' } }, { a: { given: 'Mine' } }, { a: { given: 'Theirs' } }];
    assert.deepEqual(merge(...args).conflicts, ['a']);
    assert.equal(merge(...args, 'mine').result.a.given, 'Mine');
    assert.equal(merge(...args, 'theirs').result.a.given, 'Theirs');
  });

  test('updatedAt : le plus récent, sans conflit', () => {
    const { result, conflicts } = merge({ a: { updatedAt: 1 } }, { a: { updatedAt: 3, x: 1 } }, { a: { updatedAt: 2, y: 1 } });
    assert.deepEqual(result.a, { updatedAt: 3, x: 1, y: 1 });
    assert.deepEqual(conflicts, []);
  });

  test('ajouts et suppressions', () => {
    const { result, conflicts } = merge(
      { gone: { n: 1 }, theirsGone: { n: 1 } },
      { mine: { n: 1 }, theirsGone: { n: 1 } },
      { theirs: { n: 1 }, gone: { n: 1 } },
    );
    assert.deepEqual(Object.keys(result).sort(), ['mine', 'theirs']);
    assert.deepEqual(conflicts, []);
  });

  test('supprimé d’un côté, modifié de l’autre : conflit', () => {
    const args = [{ a: { n: 1 } }, {}, { a: { n: 2 } }];
    assert.deepEqual(merge(...args).conflicts, ['a']);
    assert.deepEqual(merge(...args).result, {});
    assert.deepEqual(merge(...args, 'theirs').result, { a: { n: 2 } });
    assert.deepEqual(merge({ a: { n: 1 } }, { a: { n: 2 } }, {}, 'mine').result, { a: { n: 2 } });
  });

  test('ordre des clés indifférent', () => {
    assert.equal(canonical({ b: 1, a: [{ y: 2, x: 1 }] }), canonical({ a: [{ x: 1, y: 2 }], b: 1, c: undefined }));
  });

  test('enregistrements d’une sauvegarde', () => {
    const r = backupRecords({ people: [{ id: 'a', given: 'A' }, { given: 'sans id' }], unions: [{ id: 'u', a: 'a' }] });
    assert.deepEqual([...r.people], [['a', { given: 'A' }]]);
    assert.deepEqual([...r.unions], [['u', { a: 'a' }]]);
  });
});
