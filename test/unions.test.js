import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { S } from '../js/state.js';
import { familyBook } from '../js/model/family-book.js';
import { currentSituation, situationText, unionEndText } from '../js/model/people.js';
import { buildGedcom, parseGedcom } from '../js/services/gedcom.js';
import { findIssues } from '../js/model/checks.js';
import { buildLayout } from '../js/tree/layout.js';
import { loadTree, person } from './helpers.js';

describe('parcours d’unions', () => {
  /* Anne : veuve de Paul, remariée à Marc (divorce), concubinage avec Luc (2 enfants), puis avec Yves */
  const path = (extra = {}) => loadTree([
    person('a', { given: 'Anne', sex: 'F', ...extra }),
    person('p', { given: 'Paul', sex: 'M', deathDate: '1960' }), person('m', { given: 'Marc', sex: 'M' }),
    person('l', { given: 'Luc', sex: 'M' }), person('y', { given: 'Yves', sex: 'M' }),
    person('k1', { given: 'Léa', motherId: 'a', fatherId: 'p' }),
    person('k2', { given: 'Max', motherId: 'a', fatherId: 'l' }),
    person('k3', { given: 'Zoé', motherId: 'a', fatherId: 'y' }),
  ], [
    { id: 'u1', a: 'a', b: 'p', type: 'married', date: '1950', place: '', end: 'death', endDate: '1960' },
    { id: 'u2', a: 'a', b: 'm', type: 'married', date: '1965', place: '', end: 'divorce', endDate: '1975' },
    { id: 'u3', a: 'a', b: 'l', type: 'cohabiting', date: '1980', place: '', end: 'separation', endDate: '1990' },
    { id: 'u4', a: 'a', b: 'y', type: 'cohabiting', date: '1995', place: '' },
  ]);

  test('la situation suit la dernière union', () => {
    path();
    assert.equal(currentSituation('a'), 'cohabiting');
    S.unions.delete('u4');
    assert.equal(currentSituation('a'), 'separated');
    S.unions.delete('u3');
    assert.equal(currentSituation('a'), 'divorced');
    S.unions.delete('u2');
    assert.equal(currentSituation('a'), 'widowed');
  });

  test('remariée : second mariage en cours ; veuf déduit du décès du conjoint', () => {
    loadTree([person('a', { sex: 'F' }), person('b', { sex: 'M' }), person('c', { sex: 'M', situation: 'married' })], [
      { id: 'u1', a: 'a', b: 'b', type: 'married', date: '1950', end: 'death', place: '' },
      { id: 'u2', a: 'a', b: 'c', type: 'married', date: '1960', place: '' },
    ]);
    assert.equal(currentSituation('a'), 'remarried');
    assert.equal(situationText(S.people.get('a'), 'a'), 'Remariée (1960)');
    assert.equal(currentSituation('c'), 'married');
    loadTree([person('a'), person('b', { deathDate: '1990' })], [{ id: 'u', a: 'a', b: 'b', type: 'married', date: '1950', place: '' }]);
    assert.equal(currentSituation('a'), 'widowed');
  });

  test('sans union : la situation saisie', () => {
    loadTree([person('a', { situation: 'widowed' })]);
    assert.equal(currentSituation('a'), 'widowed');
  });

  test('livret, fin d’union, GEDCOM', () => {
    path();
    assert.equal(unionEndText(S.unions.get('u2')), 'Divorce, 1975');
    const book = familyBook('a');
    assert.deepEqual(book.unions.map((u) => u.children.map((c) => c.id)), [['k1'], [], ['k2'], ['k3']]);
    assert.equal(book.unions[1].when, '1965 · fin : Divorce, 1975');
    const ged = buildGedcom();
    assert.match(ged, /1 DIV\r\n2 DATE 1975/);
    const ends = parseGedcom(ged).unions.map((u) => [u.data.type, u.data.end, u.data.endDate]).sort((a, b) => (a[2] || '9') > (b[2] || '9') ? 1 : -1);
    assert.deepEqual(ends, [['married', 'death', '1960'], ['married', 'divorce', '1975'], ['cohabiting', 'separation', '1990'], ['cohabiting', undefined, undefined]]);
  });

  test('cohérence : fin avant le début', () => {
    loadTree([person('a'), person('b')], [{ a: 'a', b: 'b', date: '1990', endDate: '1980', end: 'divorce', place: '' }]);
    assert.ok(findIssues().some((x) => x.code === 'unionEndBeforeStart'));
  });

  test('vue centrée : tous les conjoints et tous les enfants, sans chevauchement', () => {
    path();
    S.focus = 'a';
    S.up = 1;
    S.down = 2;
    const nodes = buildLayout().nodes.filter((n) => n.t === 'p');
    const ids = nodes.map((n) => n.id);
    for (const id of ['p', 'm', 'l', 'y', 'k1', 'k2', 'k3']) assert.ok(ids.includes(id), id);
    const row = nodes.filter((n) => n.y === nodes.find((x) => x.id === 'a').y).sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i++) assert.ok(row[i].x - row[i - 1].x >= 176);
    const kids = nodes.filter((n) => n.id[0] === 'k').sort((a, b) => a.x - b.x);
    for (let i = 1; i < kids.length; i++) assert.ok(kids[i].x - kids[i - 1].x >= 176);
  });
});
