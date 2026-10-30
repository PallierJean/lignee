import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { datesOfDay, datesOfMonth } from '../js/model/ephemerides.js';
import { loadTree, person } from './helpers.js';

const NOW = new Date(2026, 9, 30);

describe('éphémérides', () => {
  test('naissances, décès, unions ; dates imprécises écartées', () => {
    loadTree([
      person('a', { birthDate: '30/10/1932', deathDate: '10/1990' }),
      person('b', { birthDate: 'vers 30/10/1900' }),
      person('c', { situation: 'married', situationDate: '05/10/1950' }),
    ], [{ a: 'a', b: 'b', date: '30/10/1955' }]);
    assert.deepEqual(datesOfDay(NOW).map((x) => [x.kind, x.y]), [['birth', 1932], ['union', 1955]]);
    assert.deepEqual(datesOfMonth(10).map((x) => [x.kind, x.d]), [['union', 5], ['birth', 30], ['union', 30], ['death', null]]);
  });

  test('29 février fêté le 28 les années non bissextiles', () => {
    loadTree([person('a', { birthDate: '29/02/2000' })]);
    assert.equal(datesOfDay(new Date(2027, 1, 28)).length, 1);
    assert.equal(datesOfDay(new Date(2028, 1, 28)).length, 0);
    assert.equal(datesOfDay(new Date(2028, 1, 29)).length, 1);
  });
});
