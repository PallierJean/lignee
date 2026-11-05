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

    // Dix générations ; dans les anneaux serrés, prénom et nom sur une seule ligne
    loadTree(Array.from({ length: 11 }, (_, i) => person('g' + i, { given: 'P' + i, surname: 'Nom', fatherId: i < 10 ? 'g' + (i + 1) : null })));
    S.focus = 'g0';
    assert.equal(fanSize().gens, 10);
    assert.match(fanSVG(), />P10 NOM<\/tspan>/);
    assert.match(fanSVG(), />P4<\/tspan>/);
    // Une seule lignée : recadrée sur ses secteurs, sans réserver le demi-disque entier (2876 × 1532)
    assert.deepEqual([fanSize().W, fanSize().H], [1556, 366]);
    loadTree([person('k', { fatherId: 'f', motherId: 'm' }), person('f'), person('m')]);
    S.focus = 'k';
    assert.deepEqual([fanSize().W, fanSize().H], [360, 274], 'roue complète : le demi-disque');

    loadTree([person('a', { fatherId: 'b' }), person('b', { fatherId: 'a' })]);
    S.focus = 'a';
    assert.equal(fanSize().gens, MAX_FAN_GENS);
  });
});
