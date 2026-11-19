import assert from 'node:assert/strict';
import { test, describe, afterEach } from 'node:test';
import { setLang } from '../js/i18n.js';
import { occupationLabel } from '../js/model/occupations.js';

const job = (occupation, sex = 'M') => occupationLabel({ occupation, sex });

describe('traduction des professions', () => {
  afterEach(() => setLang('fr'));

  test('du français vers l’anglais, sans tenir compte de la casse ni des accents', () => {
    setLang('en');
    assert.equal(job('Boulanger'), 'Baker');
    assert.equal(job('Institutrice', 'F'), 'Primary school teacher');
    assert.equal(job('INGENIEUR INTEGRATION ET  DEPLOIEMENT CONTINU'), 'Continuous integration and deployment engineer');
  });

  test('de l’anglais vers le français, accordé au sexe', () => {
    assert.equal(job('Medical Visitor', 'M'), 'Visiteur médical');
    assert.equal(job('Medical Visitor', 'F'), 'Visiteuse médicale');
    assert.equal(job('Doctor', 'F'), 'Médecin');
    assert.equal(job('Baker', 'U'), 'Boulanger');
  });

  test('déjà dans la bonne langue, ou inconnu : inchangé', () => {
    assert.equal(job('INGENIEUR'), 'INGENIEUR');
    assert.equal(job('Astronaute'), 'Astronaute');
    setLang('en');
    assert.equal(job('doctor'), 'doctor');
    assert.equal(job('Astronaute'), 'Astronaute');
  });

  test('valeur double ou vide', () => {
    assert.equal(job('Baker / Boulanger'), 'Boulanger');
    assert.equal(job(''), '');
    setLang('en');
    assert.equal(job('Baker / Boulanger'), 'Baker');
  });

  test('métier suivi du lieu', () => {
    setLang('en');
    assert.equal(job('Cultivateur à Bressounaix d’Organde'), 'Farmer in Bressounaix d’Organde');
    assert.equal(job('Astronaute à Paris'), 'Astronaute à Paris');
    setLang('fr');
    assert.equal(job('Baker in Lyon', 'F'), 'Boulangère à Lyon');
    assert.equal(job('Cultivateur à Lyon'), 'Cultivateur à Lyon');
  });

  test('métiers au féminin', () => {
    setLang('en');
    for (const [fr, en] of [['Couturière', 'Dressmaker'], ['Passementière', 'Trimmings maker'], ['Tanneur', 'Tanner'], ['Cheminot', 'Railway worker']]) assert.equal(job(fr), en);
  });
});
