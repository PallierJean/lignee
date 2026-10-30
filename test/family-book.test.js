import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { S } from '../js/state.js';
import { familyBook, familyBookName, extract } from '../js/model/family-book.js';
import { parentsName } from '../js/model/people.js';
import { loadTree, person } from './helpers.js';

describe('livret d’une personne', () => {
  const family = () => loadTree([
    person('a', { given: 'Jean', surname: 'Martin', sex: 'M', birthDate: '12/03/1932', birthPlace: 'Lyon', occupation: 'Maçon', fatherId: 'f' }),
    person('f', { given: 'Paul', surname: 'Martin', sex: 'M' }),
    person('e1', { given: 'Anne', surname: 'Roux', sex: 'F' }),
    person('e2', { given: 'Rose', surname: 'Blanc', sex: 'F' }),
    person('k1', { given: 'Léa', fatherId: 'a', motherId: 'e1' }),
    person('k2', { given: 'Luc', fatherId: 'a', motherId: 'e2' }),
    person('k3', { given: 'Max', fatherId: 'a' }),
  ], [{ id: 'u1', a: 'a', b: 'e1', type: 'married', date: '1956', place: 'Lyon' }, { id: 'u2', a: 'a', b: 'e2', date: '1970' }]);

  test('chaque enfant sous la bonne union, les autres à part', () => {
    family();
    const book = familyBook('a');
    assert.deepEqual(book.unions.map((u) => [u.title, u.when, u.children.map((c) => c.id)]),
      [['Mariage', '1956, Lyon', ['k1']], ['Union (type non précisé)', '1970', ['k2']]]);
    assert.deepEqual(book.others.map((c) => c.id), ['k3']);
  });

  test('extrait : seulement ce qui est connu', () => {
    family();
    const rows = Object.fromEntries(extract('a').rows);
    assert.equal(rows.Naissance, '12 Mars 1932, Lyon');
    assert.equal(rows['Père'], 'Paul MARTIN');
    assert.equal(rows.Profession, 'Maçon');
    assert.equal(rows['Mère'], undefined);
    assert.equal(rows['Décès'], undefined);
    assert.ok(extract('a').rows.some(([k, v]) => k === 'Union' && v === 'Mariage avec Anne ROUX, 1956, Lyon'));
  });

  test('nom du livret : le père puis la mère, nom de naissance', () => {
    loadTree([
      person('f', { surname: 'Durand', sex: 'M' }),
      person('m', { surname: 'Durand', maidenName: 'Roche', sex: 'F' }),
      person('c', { fatherId: 'f', motherId: 'm' }), person('d', { motherId: 'm' }), person('e', { fatherId: 'f' }), person('g'),
    ]);
    assert.equal(parentsName('c'), 'DURAND – ROCHE');
    assert.equal(parentsName('d'), 'ROCHE');
    assert.equal(parentsName('e'), 'DURAND');
    assert.equal(parentsName('g'), '');
    assert.equal(familyBookName('m'), 'DURAND – ROCHE');
    assert.equal(familyBookName('f'), 'DURAND – ROCHE');
  });

  test('deux parents au même nom : une seule fois ; plusieurs unions : celle qui a le plus d’enfants', () => {
    family();
    assert.equal(familyBookName('a'), 'MARTIN – ROUX');
    S.people.get('k3').motherId = 'e2';
    assert.equal(familyBookName('a'), 'MARTIN – BLANC');
    loadTree([person('f', { surname: 'Roux', sex: 'M' }), person('m', { surname: 'Roux', sex: 'F' }), person('c', { fatherId: 'f', motherId: 'm' })]);
    assert.equal(parentsName('c'), 'ROUX');
  });

  test('type déduit de la situation, seulement pour la dernière union', () => {
    loadTree([
      person('a', { situation: 'married' }), person('b', { situation: 'married' }), person('c'),
      person('x', { situation: 'cohabiting' }), person('y'),
    ], [
      { id: 'u1', a: 'a', b: 'c', date: '1950', place: '' },
      { id: 'u2', a: 'a', b: 'b', date: '1970', place: '' },
      { id: 'u3', a: 'x', b: 'y', date: '', place: '' },
    ]);
    const book = familyBook('a');
    assert.deepEqual(book.unions.map((u) => u.title), ['Union (type non précisé)', 'Mariage']);
    assert.equal(familyBook('y').unions[0].title, 'Concubinage');
    assert.deepEqual(S.unions.get('u3').type, undefined, 'rien n’est écrit dans la fiche');
  });

  test('type enregistré : prioritaire sur la situation', () => {
    loadTree([person('a', { situation: 'married' }), person('b')], [{ id: 'u', a: 'a', b: 'b', type: 'pacs', date: '1990', place: '' }]);
    assert.equal(familyBook('a').unions[0].title, 'Pacs');
  });

  test('les unions des enfants n’apparaissent pas, celles des parents si', () => {
    loadTree([
      person('p', { given: 'Paul', sex: 'M' }), person('m', { given: 'Anne', sex: 'F' }), person('e', { given: 'Rose', sex: 'F' }),
      person('c', { given: 'Léa', sex: 'F', fatherId: 'p', motherId: 'm', birthDate: '1980', deathDate: '2020' }),
    ], [{ id: 'u1', a: 'p', b: 'm', date: '1975', place: '' }, { id: 'u2', a: 'c', b: 'e', date: '2005', place: '' }]);
    const book = familyBook('p');
    const labels = (x) => x.rows.map(([k]) => k);
    assert.ok(labels(book.holder).includes('Union'));
    assert.ok(labels(book.unions[0].partner).includes('Union'));
    assert.deepEqual(labels(book.unions[0].children[0]), ['Naissance', 'Père', 'Mère', 'Décès']);
  });

  test('personne seule : un livret quand même', () => {
    loadTree([person('a', { given: 'Jean' })]);
    const book = familyBook('a');
    assert.deepEqual([book.unions.length, book.others.length], [0, 0]);
  });
});
