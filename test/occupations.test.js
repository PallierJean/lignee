import assert from 'node:assert/strict';
import { test, describe, afterEach } from 'node:test';
import { setLang } from '../js/i18n.js';
import { occupationLabel, occupationTypoFix } from '../js/model/occupations.js';

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

  test('liste de métiers, et charges « de » un lieu', () => {
    setLang('en');
    assert.equal(job('Maire, conseiller général, greffier de la justice de paix'), 'Mayor, General councillor, Clerk of the justice of the peace');
    assert.equal(job('Maire d’Eyburie'), 'Mayor of Eyburie');
    assert.equal(job("Maire de Tulle"), 'Mayor of Tulle');
    assert.equal(job('Professeur de mathématiques'), 'Professeur de mathématiques', '« de » n’est un lieu que pour une charge');
    assert.equal(job('Astronaute, boulanger'), 'Astronaute, Baker');
    setLang('fr');
    assert.equal(job('Mayor of Eyburie'), 'Maire d’Eyburie');
    assert.equal(job('Mayor of Tulle'), 'Maire de Tulle');
  });

  test('métiers composés', () => {
    setLang('en');
    assert.equal(job('Docteur en médecine', 'F'), 'Doctor of medicine');
    assert.equal(job("Ingénieur d'étude et de developpement"), 'Software development engineer');
    assert.equal(job('Mécanicien Automobile'), 'Car mechanic');
    setLang('fr');
    assert.equal(job('Doctor', 'F'), 'Médecin');
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

describe('fautes de frappe dans les professions', () => {
  test('la profession du dictionnaire la plus proche, chaque métier d’une liste à part', () => {
    assert.equal(occupationTypoFix('Enseignatne'), 'Enseignante');
    assert.equal(occupationTypoFix('Avocate en droit  des contracts'), 'Avocate en droit des contrats');
    assert.equal(occupationTypoFix('Maire, conseiler général'), 'Maire, Conseiller général');
    assert.equal(occupationTypoFix('Boulangr / Baker'), 'Boulanger / Baker');
  });

  test('connue, inconnue, courte ou lointaine : rien à corriger', () => {
    for (const x of ['Enseignante', 'medecin', 'Astronaute', 'Marin', 'Maçon', 'Cultivateur à Tulle', 'Mineur', 'Meunier', '', undefined]) {
      assert.equal(occupationTypoFix(x), '', String(x));
    }
  });
});
