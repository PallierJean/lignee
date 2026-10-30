import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { S } from '../js/state.js';
import { fanSize, fanSVG, MAX_FAN_GENS } from '../js/tree/fan.js';
import { loadTree, person } from './helpers.js';

describe('roue d’ascendance', () => {
  test('générations comptées, bornées, noms échappés, boucle sans effet', () => {
    loadTree([
      person('a', { given: '<b>', fatherId: 'b' }), person('b', { fatherId: 'c' }), person('c'),
    ]);
    S.focus = 'a';
    assert.equal(fanSize().gens, 2);
    assert.ok(fanSVG().includes('&lt;b&gt;'));
    assert.equal((fanSVG().match(/class="fan-s"/g) || []).length, 3);

    loadTree([person('a', { fatherId: 'b' }), person('b', { fatherId: 'a' })]);
    S.focus = 'a';
    assert.equal(fanSize().gens, MAX_FAN_GENS);
  });
});
