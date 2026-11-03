import assert from 'node:assert/strict';
import { test, describe, before } from 'node:test';
import { S } from '../js/state.js';
import * as A from '../js/actions.js';
import { loadCommunes, cityDepartments, placeDepartmentIssue } from '../js/model/communes.js';
import { departmentCode } from '../js/model/departments.js';
import { findIssues } from '../js/model/checks.js';
import { departmentFromCity, departmentHint } from '../js/ui/form.js';
import { placeUses } from '../js/model/places.js';
import { example, loadTree, person, resetApp, html } from './helpers.js';

const el = (id) => document.getElementById(id);
const NOW = new Date(2026, 10, 3);

/** Champs d'un lieu, tels que le navigateur les garde. */
function fields(id, city, dept) {
  el(id + '-city').value = city;
  el(id + '-hamlet').value = '';
  el(id + '-dept').value = dept;
  el(id + '-deptname').textContent = '';
}

describe('ville et département', () => {
  before(() => loadCommunes());

  test('départements d’une commune, actuelle ou déléguée, sans tenir compte de l’écriture', () => {
    assert.deepEqual(cityDepartments('Confolens'), ['16']);
    assert.deepEqual(cityDepartments('orgnac sur vezere'), ['19']);
    assert.deepEqual(cityDepartments('Mézières-sur-Issoire'), ['87']); // commune déléguée de Val-d'Issoire
    assert.deepEqual(cityDepartments('St-Étienne'), ['42']);
    assert.ok(cityDepartments('Saint-Martin').length > 1);
    assert.deepEqual(cityDepartments('Village de Freyssinet'), []);
    assert.deepEqual(['19', '9', 'Corrèze', 'correze', 'Aude', 'Digne', ''].map(departmentCode), ['19', '09', '19', '19', '11', '', '']);
  });

  test('lieu dont le département contredit la ville : la ville prime', () => {
    assert.deepEqual(placeDepartmentIssue('Confolens (87)'), { expected: ['16'], fixed: 'Confolens (16)' });
    assert.deepEqual(placeDepartmentIssue('Roussely, Orgnac (Corrèze)'), null); // ville inconnue : pas de conclusion
    assert.deepEqual(placeDepartmentIssue('La rivière, Orgnac-sur-Vézère (87)'), { expected: ['19'], fixed: 'La rivière, Orgnac-sur-Vézère (19)' });
    for (const ok of ['Roussely, Orgnac-sur-Vézère (19)', 'Hounoux (Aude)', 'Paris', 'Brive (19)', 'Saint-Martin (65)', 'Lyon (Digne)']) {
      assert.equal(placeDepartmentIssue(ok), null, ok);
    }
    assert.equal(placeDepartmentIssue('Saint-Martin (19)').fixed, ''); // plusieurs communes : pas de correction automatique
  });

  test('cohérence : un avertissement par lieu contradictoire', () => {
    loadTree([
      person('a', { birthPlace: 'Confolens (87)', deceased: true }),
      person('b', { deathPlace: 'Confolens (87)', deceased: true }),
      person('c', { birthPlace: 'Confolens (16)', deceased: true }),
    ]);
    const found = findIssues(NOW).filter((x) => x.code === 'placeDept');
    assert.equal(found.length, 1);
    assert.match(found[0].n, /lieu « Confolens \(87\) », mais Confolens est en Charente \(16\) \(2 mentions\)/);
    const ex = example();
    loadTree(ex.people, ex.unions);
    assert.deepEqual(findIssues(NOW), []);
  });

  test('formulaire : la ville remplit ou corrige le département', async () => {
    fields('f-bplace', 'Confolens', '87');
    await departmentFromCity('f-bplace');
    assert.equal(el('f-bplace-dept').value, '16');
    assert.equal(el('f-bplace-deptname').textContent, 'Charente · d’après la ville');
    fields('f-dplace', 'Vigeois', '');
    await departmentFromCity('f-dplace');
    assert.equal(el('f-dplace-dept').value, '19');
    fields('u-place-0', 'Saint-Martin', '19');
    await departmentFromCity('u-place-0');
    assert.equal(el('u-place-0-dept').value, '19'); // plusieurs départements possibles : rien n'est changé
    assert.match(el('u-place-0-deptname').textContent, /^Plusieurs communes de ce nom : Gers \(32\)/);
    fields('ev-place-0', 'Ville inconnue', '87');
    await departmentFromCity('ev-place-0');
    assert.equal(el('ev-place-0-dept').value, '87');
    fields('f-bplace', 'Confolens', '87');
    assert.match(departmentHint('f-bplace'), /Confolens n’est pas dans ce département : Charente \(16\)/);
  });

  test('vue Lieux : le lieu contradictoire est signalé et déjà corrigé dans ses champs', () => {
    resetApp();
    loadTree([person('a', { birthPlace: 'Confolens (87)', deceased: true }), person('b', { birthPlace: 'Paris', deceased: true })]);
    S.focus = 'a';
    A.setTab('analyse');
    A.setAnalyseView('places');
    const out = html('paneAnalyse');
    assert.match(out, /Confolens est en Charente \(16\) : le département est corrigé ci-dessous/);
    const i = placeUses().findIndex((u) => u.name === 'Confolens (87)');
    assert.match(out, new RegExp(`id="pl-${i}-dept" value="16"`));
  });
});
