import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { S } from '../js/state.js';
import { fanSize, fanSVG, MAX_FAN_GENS } from '../js/tree/fan.js';
import { loadTree, person } from './helpers.js';

describe('roue d’ascendance', () => {
  test('générations comptées, bornées, noms échappés, boucle sans effet', () => {
    loadTree([
      person('a', { given: '<b>', fatherId: 'b', sex: 'M' }), person('b', { fatherId: 'c', sex: 'M' }), person('c'),
    ]);
    S.focus = 'a';
    assert.equal(fanSize().gens, 2);
    assert.ok(fanSVG().includes('&lt;b&gt;'));
    assert.equal((fanSVG().match(/class="fan-s"/g) || []).length, 3);
    // Sans attribut style (interdit par la politique de sécurité) : classes à l'écran, couleurs à l'impression
    assert.ok(!fanSVG().includes('style='));
    assert.match(fanSVG(), /class="fan-sector sx-M"/);
    const ink = { text: '#111', muted: '#555', line: '#ccc', empty: '#eee', M: '#fff', F: '#fff', U: '#fff', stroke: { M: '#00f', F: '#f0f', U: '#ccc' } };
    assert.match(fanSVG(ink), /fill="#fff" stroke="#00f" stroke-width="2"/);

    loadTree([person('a', { fatherId: 'b' }), person('b', { fatherId: 'a' })]);
    S.focus = 'a';
    assert.equal(fanSize().gens, MAX_FAN_GENS);
  });
});
