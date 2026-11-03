import assert from 'node:assert/strict';
import { test, describe, beforeEach } from 'node:test';
import { S } from '../js/state.js';
import * as A from '../js/actions.js';
import { parsePlace, formatPlace, renamePatches, placeUses } from '../js/model/places.js';
import { resetHistory } from '../js/services/history.js';
import { loadTree, person, resetApp, html } from './helpers.js';

const el = (id) => document.getElementById(id);

describe('lieux en trois parties', () => {
  test('lecture et écriture : lieu-dit, ville, département', () => {
    assert.deepEqual(parsePlace('Roussely, Orgnac-sur-Vézère (19)'), { hamlet: 'Roussely', city: 'Orgnac-sur-Vézère', dept: '19' });
    assert.deepEqual(parsePlace('Bressouneix ,  Orgnac (19)'), { hamlet: 'Bressouneix', city: 'Orgnac', dept: '19' });
    assert.deepEqual(parsePlace('Paris'), { hamlet: '', city: 'Paris', dept: '' });
    assert.deepEqual(parsePlace('Hounoux (Aude)'), { hamlet: '', city: 'Hounoux', dept: 'Aude' });
    assert.deepEqual(parsePlace('A, B, Ville (87)'), { hamlet: 'A, B', city: 'Ville', dept: '87' });
    assert.deepEqual(parsePlace(''), { hamlet: '', city: '', dept: '' });
    assert.equal(formatPlace({ hamlet: ' Roussely ', city: 'Orgnac-sur-Vézère', dept: '19' }), 'Roussely, Orgnac-sur-Vézère (19)');
    assert.equal(formatPlace({ city: 'Paris' }), 'Paris');
    assert.equal(formatPlace({ city: 'Brive', dept: '19' }), 'Brive (19)');
    assert.equal(formatPlace({}), '');
    for (const s of ['Roussely, Orgnac-sur-Vézère (19)', 'Paris', 'Brive (19)']) assert.equal(formatPlace(parsePlace(s)), s);
  });

  test('renommage partout : naissance, décès, événements, unions ; annulable', async () => {
    resetApp();
    resetHistory();
    loadTree([
      person('a', { birthPlace: 'Mezieres (87)', deathPlace: 'Lyon', events: [{ id: 'e', type: 'census', place: 'Mezieres (87)' }] }),
      person('b', { deathPlace: ' Mezieres (87) ' }),
      person('c', { birthPlace: 'Paris' }),
    ], [{ id: 'u', a: 'a', b: 'b', place: 'Mezieres (87)' }]);
    assert.equal(renamePatches('Mezieres (87)', 'X').length, 3);
    await A.renamePlace('Mezieres (87)', 'Mézières-sur-Issoire (87)');
    const a = S.people.get('a');
    assert.deepEqual([a.birthPlace, a.deathPlace, a.events[0].place, S.people.get('b').deathPlace, S.unions.get('u').place],
      ['Mézières-sur-Issoire (87)', 'Lyon', 'Mézières-sur-Issoire (87)', 'Mézières-sur-Issoire (87)', 'Mézières-sur-Issoire (87)']);
    assert.equal(S.people.get('c').birthPlace, 'Paris');
    assert.equal(placeUses().find((u) => u.name === 'Mézières-sur-Issoire (87)').n, 4);
    await A.undo();
    assert.equal(S.people.get('a').birthPlace, 'Mezieres (87)');
    assert.equal(S.unions.get('u').place, 'Mezieres (87)');
  });

  test('vue Lieux : une ligne par lieu, renommage depuis ses trois champs', async () => {
    resetApp();
    resetHistory();
    loadTree([person('a', { birthPlace: 'Villagr de Freyssinet' }), person('b', { birthPlace: 'Village de Freyssinet' })]);
    S.focus = 'a';
    A.setTab('analyse');
    A.setAnalyseView('places');
    assert.match(html('paneAnalyse'), /Villagr de Freyssinet/);
    assert.match(html('paneAnalyse'), /data-act="place-rename"/);
    const i = placeUses().findIndex((u) => u.name === 'Villagr de Freyssinet');
    el(`pl-${i}-city`).value = 'Village de Freyssinet';
    el(`pl-${i}-hamlet`).value = '';
    el(`pl-${i}-dept`).value = '19';
    const { placeRowValue } = await import('../js/ui/analyse.js');
    await A.renamePlace('Villagr de Freyssinet', placeRowValue(i));
    assert.equal(S.people.get('a').birthPlace, 'Village de Freyssinet (19)');
  });
});
