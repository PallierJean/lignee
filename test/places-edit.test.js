import assert from 'node:assert/strict';
import { test, describe, beforeEach } from 'node:test';
import { S } from '../js/state.js';
import * as A from '../js/actions.js';
import { parsePlace, formatPlace, renamePatches, placeUses } from '../js/model/places.js';
import { resetHistory } from '../js/services/history.js';
import { departmentName, DEPARTMENTS } from '../js/model/departments.js';
import { fire } from './setup.js';
import { bindEvents } from '../js/events.js';
import { placeFields } from '../js/ui/form.js';
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

  test('nom du département d’après son numéro', () => {
    assert.equal(Object.keys(DEPARTMENTS).length, 103); // 01 à 95 (avec 20), 2A, 2B, outre-mer
    assert.deepEqual(['19', '9', '09', '2a', '2B', '87', '974', ' 16 ', 'Aude', '99', ''].map(departmentName),
      ['Corrèze', 'Ariège', 'Ariège', 'Corse-du-Sud', 'Haute-Corse', 'Haute-Vienne', 'La Réunion', 'Charente', '', '', '']);
    assert.match(placeFields('f-bplace', 'Roussely, Orgnac-sur-Vézère (19)'), /<small class="dept-name" id="f-bplace-deptname">Corrèze<\/small>/);
    assert.match(placeFields('f-bplace', 'Hounoux (Aude)'), /id="f-bplace-deptname"><\/small>/);
  });

  test('le nom suit la saisie du numéro', () => {
    bindEvents();
    const input = el('f-dplace-dept');
    input.id = 'f-dplace-dept';
    input.value = '87';
    fire('input', { target: input });
    assert.equal(el('f-dplace-deptname').textContent, 'Haute-Vienne');
    input.value = '8';
    fire('input', { target: input });
    assert.equal(el('f-dplace-deptname').textContent, 'Ardennes');
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

  test('renommage pendant une saisie : appliqué, et la fiche en cours suit', async () => {
    resetApp();
    resetHistory();
    loadTree([
      person('a', { birthPlace: 'Estivaux (19)', events: [{ id: 'e', type: 'census', place: 'Estivaux (19)' }] }),
      person('b', { sex: 'F', deathPlace: 'Estivaux (19)' }),
    ], [{ id: 'u', a: 'a', b: 'b', place: 'Estivaux (19)' }]);
    S.focus = 'a';
    A.startEdit('a');
    // Le formulaire, tel que le navigateur le garde : ses champs de lieu remplis
    for (const id of ['f-bplace', 'ev-place-0', 'u-place-0']) {
      el(id + '-city').value = 'Estivaux';
      el(id + '-hamlet').value = '';
      el(id + '-dept').value = '19';
    }
    A.setTab('analyse');
    await A.renamePlace('Estivaux (19)', 'Estivaux, Orgnac (19)');
    assert.equal(S.people.get('b').deathPlace, 'Estivaux, Orgnac (19)');
    assert.equal(S.edit.draft.birthPlace, 'Estivaux, Orgnac (19)');
    assert.equal(S.edit.events[0].place, 'Estivaux, Orgnac (19)');
    assert.equal(S.edit.unions[0].place, 'Estivaux, Orgnac (19)');
  });

  test('rien de changé : un message, aucune écriture', async () => {
    resetApp();
    resetHistory();
    loadTree([person('a', { birthPlace: 'Paris' })]);
    await A.renamePlace('Paris', ' Paris ');
    assert.match(el('toast').textContent, /Rien à renommer/);
    assert.equal(S.people.get('a').birthPlace, 'Paris');
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
