import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { findDuplicates, mergedData } from '../js/model/duplicates.js';
import { example, loadTree, person } from './helpers.js';

describe('doublons', () => {
  test('un arbre réimporté : chaque fiche est retrouvée', () => {
    const ex = example();
    const copy = ex.people.map((p) => ({ ...p, id: p.id + '_b', fatherId: p.fatherId && p.fatherId + '_b', motherId: p.motherId && p.motherId + '_b' }));
    loadTree([...ex.people, ...copy], ex.unions);
    const pairs = findDuplicates();
    assert.equal(pairs.length, ex.people.length);
    assert.ok(pairs.every((x) => x.a + '_b' === x.b));
  });

  test('dates ou sexe contradictoires, parent et enfant : écartés', () => {
    loadTree([
      person('a', { given: 'Jean', surname: 'Martin', sex: 'M', birthDate: '1900', birthPlace: 'Lyon' }),
      person('b', { given: 'Jean', surname: 'Martin', sex: 'M', birthDate: '1950', birthPlace: 'Lyon' }),
      person('c', { given: 'Jean', surname: 'Martin', sex: 'F', birthDate: '1900', birthPlace: 'Lyon' }),
      person('d', { given: 'Jean', surname: 'Martin', sex: 'M', birthDate: '1901', birthPlace: 'Lyon', fatherId: 'a' }),
    ]);
    assert.deepEqual(findDuplicates(), []);
  });

  test('prénom usuel seul, nom de jeune fille, paire ignorée', () => {
    loadTree([
      person('a', { given: 'Marie Louise', surname: 'Dupont', maidenName: 'Faure', sex: 'F', birthDate: '12/03/1900' }),
      person('b', { given: 'Marie', surname: 'Faure', sex: 'F', birthDate: '12/03/1900' }),
    ]);
    const [pair] = findDuplicates();
    assert.equal(pair.key, 'a|b');
    assert.ok(pair.reasons.includes('dup.birth'));
    assert.deepEqual(findDuplicates(new Set(['a|b'])), []);
  });

  test('fusion : champs complétés, listes réunies, faits reliés aux éléments conservés', () => {
    const keep = {
      given: 'Jean', surname: 'Martin', birthDate: '1900', birthPlace: '', notes: 'A', deceased: false,
      events: [{ id: 'e1', type: 'baptism', date: '1900', place: 'Lyon' }], sources: [{ id: 's1', fact: 'birth' }],
    };
    const drop = {
      given: 'Autre', birthPlace: 'Lyon', notes: 'B', deceased: true, createdAt: 1,
      events: [{ id: 'e2', type: 'baptism', date: '1900', place: 'lyon' }, { id: 'e3', type: 'census', date: '1906', place: '' }],
      sources: [{ id: 's2', fact: 'e2' }, { id: 's3', fact: 'union:old' }], media: [{ id: 'm1' }],
    };
    const out = mergedData(keep, drop, new Map([['old', 'new']]));
    assert.equal(out.given, 'Jean');
    assert.equal(out.birthPlace, 'Lyon');
    assert.equal(out.notes, 'A\n\nB');
    assert.equal(out.deceased, true);
    assert.deepEqual(out.events.map((e) => e.id), ['e1', 'e3']);
    assert.deepEqual(out.sources.map((s) => s.fact), ['birth', 'e1', 'union:new']);
    assert.equal(out.media.length, 1);
    assert.equal(out.createdAt, undefined);
  });
});
