import assert from 'node:assert/strict';
import { test, describe, beforeEach } from 'node:test';
import { S } from '../js/state.js';
import { renderAll, afterData } from '../js/ui/render.js';
import { openPersonDlg, closePersonDlg } from '../js/ui/person-dlg.js';
import { openMedia, closeMedia, placePin, addTag, removeTag, cancelPin } from '../js/ui/media.js';
import { onFindInput, onFindKey, pickFind, showAllFind, closeFind, refreshFind } from '../js/ui/search.js';
import { onSpouseInput, onSpouseKey, closeSpouse } from '../js/ui/spouse-pick.js';
import { resetHistory } from '../js/services/history.js';
import { setLang } from '../js/i18n.js';
import { example, loadTree, person, resetApp, html } from './helpers.js';

const el = (id) => document.getElementById(id);
const ex = example();

function openExample() {
  resetApp();
  resetHistory();
  loadTree(ex.people, ex.unions);
  S.focus = ex.people.find((p) => p.given === 'Camille').id;
  afterData();
}

const view = (name) => {
  S.tab = 'analyse';
  S.analyse = name;
  renderAll();
  return html('paneAnalyse');
};

describe('rendu général', () => {
  beforeEach(openExample);

  test('en-tête, arbre et registre reflètent les données', () => {
    assert.match(el('summary').textContent, /16 personnes/);
    assert.ok(html('reglist').includes('Camille'));
    assert.equal(el('tab-fiche').getAttribute('aria-selected'), 'true');
    assert.ok(el('banner').innerHTML.includes('Famille d’exemple'));
  });

  test('fiche : faits, proches et actions', () => {
    const fiche = html('paneFiche');
    assert.ok(fiche.includes('Camille'));
    assert.ok(fiche.includes('Parents'));
    assert.ok(fiche.includes('data-act="edit"'));
    assert.ok(fiche.includes('data-act="family-book"'));
  });

  test('lecture seule : pas de boutons de modification', () => {
    S.canWrite = false;
    renderAll(true);
    assert.ok(!html('paneFiche').includes('data-act="edit"'));
    assert.equal(el('btnNew').hidden, true);
  });

  test('arbre vide et personne non choisie', () => {
    loadTree([]);
    S.focus = null;
    renderAll(true);
    assert.ok(html('paneFiche').includes('fiche de chaque personne'));
    assert.ok(el('reglist').innerHTML.includes('registre est vide'));
    assert.match(el('summary').textContent, /Aucune personne/);
    assert.ok(view('stats').includes('rien à analyser'));
  });

  test('recherche du registre : résultat et aucun résultat échappé', () => {
    S.query = 'camille';
    renderAll();
    assert.ok(html('reglist').includes('Camille'));
    assert.ok(!html('reglist').includes('Hugo'));
    S.query = '<zzz>';
    renderAll();
    assert.ok(html('reglist').includes('&lt;zzz&gt;'));
  });

  test('roue d’ascendance à la place de l’arbre', () => {
    S.fan = true;
    renderAll();
    assert.ok(html('fan').includes('fan-s'));
    assert.equal(el('sizer').hidden, true);
  });

  test('en anglais', () => {
    setLang('en');
    renderAll(true);
    assert.ok(html('paneFiche').includes('Parents'));
    assert.match(el('summary').textContent, /16 people/);
    setLang('fr');
  });
});

describe('onglet Analyse', () => {
  beforeEach(openExample);

  test('parenté : invite, lien, surlignage', () => {
    assert.ok(view('kin').includes('Choisissez deux personnes'));
    S.kinB = ex.people.find((p) => p.given === 'Michel').id;
    const text = view('kin');
    assert.ok(text.includes('fille de') || text.includes('la fille'), text.slice(0, 200));
    assert.ok(text.includes('data-act="kin-show"'));
    S.kinShow = true;
    assert.ok(view('kin').includes('data-act="kin-hide"'));
  });

  test('parenté : même personne, conjoints, alliance, aucun lien', () => {
    loadTree([person('a', { sex: 'F' }), person('b', { sex: 'M' }), person('c', { sex: 'M', fatherId: 'b' }), person('z')], [{ id: 'u', a: 'a', b: 'b' }]);
    S.focus = 'a';
    S.kinA = 'a';
    S.kinB = 'a';
    assert.ok(view('kin').includes('même personne'));
    S.kinB = 'b';
    assert.ok(view('kin').includes('conjointe'));
    S.kinB = 'c';
    assert.ok(view('kin').includes('Par alliance'));
    S.kinB = 'z';
    assert.ok(view('kin').includes('Aucun lien'));
  });

  test('cohérence : rien, puis erreurs et points à vérifier', () => {
    assert.ok(view('checks').includes('Aucune incohérence'));
    loadTree([
      person('m', { given: 'Mia', sex: 'F', birthDate: '1900', deathDate: '1950' }),
      person('c', { given: 'Léo', motherId: 'm', birthDate: '1908' }),
      person('v', { given: 'Vieux', birthDate: '1700', deathDate: '1830' }),
      person('x', { fatherId: 'y' }), person('y', { fatherId: 'x' }),
      person('e', { given: 'Eve', birthDate: '1900', events: [{ id: 'e1', type: 'census', date: '1890' }] }),
    ]);
    const out = view('checks');
    assert.ok(out.includes('Erreurs'));
    assert.ok(out.includes('À vérifier'));
    assert.ok(out.includes('Boucle de parenté'));
    assert.ok(out.includes('avant la naissance'));
    assert.ok(el('anCount').textContent);
  });

  test('doublons : aucun, puis une paire avec ses boutons', () => {
    assert.ok(view('dups').includes('Aucun doublon'));
    loadTree([person('a', { given: 'Jean', surname: 'Martin', birthDate: '1900' }), person('b', { given: 'Jean', surname: 'Martin', birthDate: '1900' })]);
    const out = view('dups');
    assert.ok(out.includes('data-act="dup-merge"'));
    assert.ok(out.includes('Garder la fiche 2'));
    S.canWrite = false;
    assert.ok(!view('dups').includes('data-act="dup-merge"'));
  });

  test('statistiques, éphémérides, frise, carte, galerie', () => {
    assert.ok(view('stats').includes('Lieux les plus cités'));
    S.calMonth = 6;
    assert.ok(view('cal').includes('juin'));
    assert.ok(view('time').includes('Naissance'));
    S.timeFamily = true;
    assert.ok(view('time').includes('Union'));
    assert.ok(view('map').includes('Localiser'));
    assert.ok(view('gallery').includes('Aucune image'));
  });

  test('frise et statistiques sans données', () => {
    loadTree([person('a', { given: 'A' })]);
    S.focus = 'a';
    assert.ok(view('time').includes('Aucune date'));
    assert.ok(view('stats').includes('Aucune personne n’a des dates'));
    assert.ok(view('map').includes('Aucun lieu'));
  });

  test('carte : lieux déjà localisés, migrations, lieu introuvable', () => {
    localStorage.setItem('lignee.geo.v1', JSON.stringify({ Lyon: { lat: 45.7, lon: 4.8 }, Paris: { lat: 48.8, lon: 2.3 }, Nantes: null }));
    loadTree([
      person('p', { birthPlace: 'Lyon' }), person('c', { birthPlace: 'Paris', fatherId: 'p' }), person('d', { birthPlace: 'Nantes' }),
    ]);
    const out = view('map');
    assert.ok(out.includes('class="pt"'));
    assert.ok(out.includes('class="mv"'));
    assert.ok(out.includes('Introuvables : Nantes'));
    assert.ok(out.includes('Principales migrations'));
  });
});

describe('fiche : événements, sources, galerie', () => {
  const rich = () => loadTree([
    person('a', {
      given: 'Anne', surname: 'Roux', sex: 'F', situation: 'married', birthDate: '12/03/1932', deathDate: '1990', birthPlace: 'Lyon', notes: 'Note',
      events: [{ id: 'e1', type: 'baptism', date: '1932', place: 'Lyon', note: 'Parrain' }],
      sources: [{ id: 's1', fact: 'birth', kind: 'birth', title: 'Acte', place: 'AD', ref: '3E', note: 'Texte', photo: 'data:image/jpeg;base64,AAAA' }],
      media: [{ id: 'm1', photo: 'data:image/jpeg;base64,AAAA', title: 'Noce', date: '1950', note: 'Lyon', tags: [{ id: 'b', x: 'bad"', y: 20 }] }],
    }),
    person('b', { given: 'Paul', surname: 'Blanc', sex: 'M' }),
    person('c', { given: 'Léa', sex: 'F', motherId: 'a', fatherId: 'b' }),
    person('z', { given: 'Yves', sex: 'M' }),
  ], [
    { id: 'u1', a: 'a', b: 'b', type: 'married', date: '1950', end: 'divorce', endDate: '1960', place: 'Lyon' },
    { id: 'u2', a: 'a', b: 'z', type: 'cohabiting', date: '1970', place: '' },
  ]);

  beforeEach(() => {
    resetApp();
    rich();
    S.focus = 'a';
    renderAll(true);
  });

  test('sources, événements, fin d’union, ajout d’enfant par conjoint', () => {
    const fiche = html('paneFiche');
    assert.ok(fiche.includes('Baptême'));
    assert.ok(fiche.includes('Acte'));
    assert.ok(fiche.includes('fin : Divorce, 1960'));
    assert.ok(fiche.includes('Ajouter un enfant avec Yves BLANC') || fiche.includes('Ajouter un enfant avec Yves'));
    assert.ok(fiche.includes('class="meds"'));
  });

  test('fiche en fenêtre : frise de vie, ouverture et fermeture', () => {
    openPersonDlg('a');
    const card = html('personCard');
    assert.ok(card.includes('Mariage'));
    assert.ok(card.includes('Divorce'));
    assert.equal(el('personDlg').hidden, false);
    closePersonDlg();
    assert.equal(el('personDlg').hidden, true);
  });

  test('visionneuse : repère neutralisé, identification, retrait', async () => {
    openMedia('a', 'm1');
    assert.ok(html('mediaCard').includes('left:0%;top:20%'), 'position piégée remise à zéro');
    assert.ok(html('mediaCard').includes('Paul BLANC'));
    const pic = el('mediaPic');
    pic.querySelector = () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }) });
    placePin(pic, { target: { closest: () => null }, clientX: 100, clientY: 50 });
    assert.ok(html('mediaCard').includes('id="tagPerson"'));
    cancelPin();
    assert.ok(!html('mediaCard').includes('id="tagPerson"'));
    placePin(pic, { target: { closest: () => null }, clientX: 100, clientY: 50 });
    await addTag('c');
    assert.equal(S.people.get('a').media[0].tags.length, 2);
    await removeTag(0);
    assert.equal(S.people.get('a').media[0].tags.length, 1);
    closeMedia();
    assert.equal(el('mediaDlg').hidden, true);
  });

  test('image supprimée : la visionneuse se ferme', () => {
    openMedia('a', 'absente');
    assert.equal(el('mediaDlg').hidden, true);
  });
});

describe('recherche rapide', () => {
  const find = el('find');
  beforeEach(() => {
    openExample();
    find.value = 'cam';
    document.activeElement = find;
    onFindInput();
  });

  test('suggestions, aucune correspondance', () => {
    assert.ok(html('findList').includes('Camille'));
    find.value = 'zzz';
    onFindInput();
    assert.ok(html('findList').includes('Aucune personne'));
  });

  test('clavier : flèches, Entrée, Échap, autre touche', () => {
    assert.equal(onFindKey({ key: 'ArrowDown' }, () => {}), true);
    assert.equal(onFindKey({ key: 'ArrowUp' }, () => {}), true);
    let picked = null;
    assert.equal(onFindKey({ key: 'Enter' }, (id) => { picked = id; }), true);
    assert.ok(picked);
    find.value = 'cam';
    assert.equal(onFindKey({ key: 'Escape' }, () => {}), true);
    assert.equal(find.value, '');
    assert.equal(onFindKey({ key: 'Escape' }, () => {}), true);
    assert.equal(onFindKey({ key: 'a' }, () => {}), false);
  });

  test('voir tout, choix, fermeture, actualisation', () => {
    find.value = 'bertrand';
    onFindInput();
    let shown = false;
    showAllFind(() => { shown = true; });
    assert.ok(shown);
    assert.equal(S.query, 'bertrand');
    find.value = 'cam';
    onFindInput();
    let got = null;
    pickFind('x', (id) => { got = id; });
    assert.equal(got, 'x');
    closeFind(false);
    el('findList').hidden = false;
    document.activeElement = find;
    find.value = 'cam';
    refreshFind();
    assert.ok(html('findList').includes('Camille'));
  });

  test('liste longue : lien vers le registre', () => {
    const many = Array.from({ length: 12 }, (_, i) => person('p' + i, { given: 'Jean' + i, surname: 'Martin' }));
    loadTree(many);
    find.value = 'martin';
    document.activeElement = find;
    onFindInput();
    assert.ok(html('findList').includes('Voir les 12 résultats'));
  });
});

describe('choix d’un conjoint', () => {
  const input = el('f-spouse');
  beforeEach(() => {
    openExample();
    S.edit = { id: S.focus, unions: [], draft: {} };
    input.value = 'mi';
    document.activeElement = input;
    onSpouseInput();
  });

  test('suggestions, clavier, Échap', () => {
    assert.ok(html('f-spouseList').includes('role="option"'));
    assert.equal(onSpouseKey({ key: 'ArrowDown' }, () => {}), true);
    let picked = null;
    assert.equal(onSpouseKey({ key: 'Enter' }, (id) => { picked = id; }), true);
    assert.ok(picked);
    assert.equal(onSpouseKey({ key: 'Escape' }, () => {}), true);
    assert.equal(input.value, '');
    assert.equal(onSpouseKey({ key: 'x' }, () => {}), false);
    closeSpouse();
  });

  test('aucun résultat, liste longue', () => {
    input.value = 'zzz';
    onSpouseInput();
    assert.ok(html('f-spouseList').includes('Aucune personne'));
    loadTree(Array.from({ length: 15 }, (_, i) => person('p' + i, { given: 'Jean', surname: 'Martin' })));
    input.value = 'martin';
    onSpouseInput();
    assert.ok(html('f-spouseList').includes('autres') || html('f-spouseList').includes('3 autre'));
  });
});
