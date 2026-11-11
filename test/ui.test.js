import assert from 'node:assert/strict';
import { test, describe, beforeEach } from 'node:test';
import { S } from '../js/state.js';
import * as A from '../js/actions.js';
import { renderHeader } from '../js/ui/header.js';
import { renderAll, afterData, renderRecord } from '../js/ui/render.js';
import { openPersonDlg, closePersonDlg } from '../js/ui/person-dlg.js';
import {
  openMedia, closeMedia, stepMedia, showMediaSide, placePin, addTag, removeTag, cancelPin, highlightTag, editCaption, saveCaption, onTagFind } from '../js/ui/media.js';
import { onFindInput, onFindKey, pickFind, showAllFind, closeFind, refreshFind } from '../js/ui/search.js';
import { onSpouseInput, onSpouseKey, closeSpouse } from '../js/ui/spouse-pick.js';
import { resetHistory } from '../js/services/history.js';
import { setLang } from '../js/i18n.js';
import { mapZoom, mapFit, mapPick, mapDrag } from '../js/ui/places.js';
import { example, loadTree, person, resetApp, html } from './helpers.js';
import { markExported } from '../js/services/exported.js';
import { EXPORT_KEY } from '../js/config.js';

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
  S.tab = 'analysis';
  S.analysis = name;
  renderAll();
  return html('paneAnalysis');
};

describe('rendu général', () => {
  beforeEach(openExample);

  test('en-tête, arbre et registre reflètent les données', () => {
    assert.match(el('summary').textContent, /16 personnes/);
    assert.ok(html('reglist').includes('Camille'));
    assert.equal(el('tab-record').getAttribute('aria-selected'), 'true');
    assert.ok(el('banner').innerHTML.includes('Famille d’exemple'));
  });

  test('bandeaux fermés : exemple puis mode local, l’arbre garde ses exemples', () => {
    S.mode = 'local';
    A.closeBanner('ex');
    assert.equal(el('banner').hidden, true, 'only the example family: nothing to lose');
    assert.equal(S.people.size, 16);
    S.closed = {};
    renderHeader();
    assert.ok(el('banner').innerHTML.includes('data-act="banner-close"'));
  });

  test('local mode: the banner reminds to export a tree of your own until it is exported', () => {
    const DAY = 86400000;
    S.mode = 'local';
    S.closed = { ex: true };
    localStorage.removeItem(EXPORT_KEY);
    [...S.people.values()][0].example = false;
    renderHeader();
    const banner = () => (el('banner').hidden ? '' : el('banner').innerHTML);
    assert.match(banner(), /que dans ce navigateur/);
    assert.match(banner(), /jamais été exporté/);
    assert.match(banner(), /data-act="export-open"/);
    assert.match(banner(), /data-act="repo-link-open"/);
    markExported(Date.now() - 40 * DAY);
    renderHeader();
    assert.match(banner(), /Dernier export il y a 40 jours/);
    markExported();
    renderHeader();
    assert.equal(banner(), '', 'exported recently');
    markExported(Date.now() - 40 * DAY);
    A.closeBanner('local');
    assert.equal(banner(), '', 'closed: snoozed');
    S.closed.local = Date.now() - 8 * DAY;
    renderHeader();
    assert.match(banner(), /il y a 40 jours/, 'back after a week');
    S.mode = 'file';
    renderHeader();
    assert.doesNotMatch(banner(), /que dans ce navigateur/, 'saved on disk by the local server');
    localStorage.removeItem(EXPORT_KEY);
  });

  test('fiche : faits, proches et actions', () => {
    const fiche = html('paneRecord');
    assert.ok(fiche.includes('Camille'));
    assert.ok(fiche.includes('Parents'));
    assert.ok(fiche.includes('data-act="edit"'));
    assert.ok(fiche.includes('data-act="family-book"'));
  });

  test('fiche d’une personne de moins de 17 ans : pas de bouton « Ajouter un enfant »', () => {
    const year = new Date().getFullYear();
    const camille = S.focus;
    const before = S.people.get(camille).birthDate;
    S.people.get(camille).birthDate = String(year - 5);
    renderRecord();
    assert.doesNotMatch(html('paneRecord'), /data-rel="child"/);
    assert.doesNotMatch(html('paneRecord'), /data-rel="spouse"/, 'moins de 15 ans : pas de conjoint non plus');
    A.startEdit(camille);
    assert.doesNotMatch(html('paneRecord'), /id="f-spouse"/, 'ni dans le formulaire');
    A.cancelEdit();
    S.people.get(camille).birthDate = before;
    renderRecord();
    assert.match(html('paneRecord'), /data-rel="child"/);
    assert.match(html('paneRecord'), /data-rel="spouse"/);
    A.startEdit(camille);
    assert.match(html('paneRecord'), /id="f-spouse"/);
    A.cancelEdit();
  });

  test('lecture seule : pas de boutons de modification', () => {
    S.canWrite = false;
    renderAll(true);
    assert.ok(!html('paneRecord').includes('data-act="edit"'));
    assert.equal(el('btnNew').hidden, true);
  });

  test('arbre vide et personne non choisie', () => {
    loadTree([]);
    S.focus = null;
    renderAll(true);
    assert.ok(html('paneRecord').includes('fiche de chaque personne'));
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
    assert.ok(html('paneRecord').includes('Parents'));
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
    assert.ok(out.includes('© les contributeurs d’<a href="https://www.openstreetmap.org/copyright"'), 'mention de la licence ODbL');
  });

  test('carte explorable : commune choisie, zoom, département, glisser', () => {
    localStorage.setItem('lignee.geo.v1', JSON.stringify({ 'Tulle (19)': { lat: 45.27, lon: 1.77 }, 'Brive-la-Gaillarde (19)': { lat: 45.16, lon: 1.53 }, 'Bordeaux (33)': { lat: 44.84, lon: -0.58 } }));
    loadTree([
      person('p', { given: 'Jean', surname: 'Roux', birthPlace: 'Le Bourg, Tulle (19)' }),
      person('c', { given: 'Anne', surname: 'Roux', birthPlace: 'Brive-la-Gaillarde (19)', deathPlace: 'Bordeaux (33)', fatherId: 'p' }),
    ]);
    const out = view('map');
    assert.match(out, /data-act="map-region" data-key="19">Corrèze · 2</);
    assert.match(out, /data-act="map-region" data-key="33">Gironde · 1</);
    assert.match(out, /data-act="map-point" data-name="Tulle \(19\)"/, 'lieu-dit réuni à sa commune');
    const svg = () => document.getElementById('mapBox').innerHTML;
    const cx = (name) => +new RegExp(`cx="([\\d.-]+)"[^>]*data-name="${name.replace(/[()]/g, '\\$&')}"`).exec(svg())[1];

    // Commune choisie : ses personnes, ses migrations en évidence ; un second clic la quitte
    mapPick('Tulle (19)');
    assert.match(document.getElementById('mapPlace').innerHTML, /Tulle \(19\) <span class="n">1 mention<\/span>.*Jean ROUX/);
    assert.match(svg(), /class="map picking"/);
    assert.match(svg(), /class="mv on"/);
    mapPick('Tulle (19)');
    assert.equal(document.getElementById('mapPlace').innerHTML, '');

    // Recadrage sur la Corrèze (Bordeaux sort du cadre), zoom (les communes s'écartent), puis tout voir
    mapFit('19');
    assert.doesNotMatch(svg(), /data-name="Bordeaux \(33\)"/, 'Bordeaux hors du cadre de la Corrèze');
    const gap = cx('Tulle (19)') - cx('Brive-la-Gaillarde (19)');
    mapZoom(1);
    assert.ok(cx('Tulle (19)') - cx('Brive-la-Gaillarde (19)') > gap * 1.5);
    mapFit('');
    assert.match(svg(), /data-name="Bordeaux \(33\)"/);

    // Glisser : la carte suit ; le clic qui termine le glissé ne choisit pas de commune
    const before = cx('Tulle (19)');
    const target = document.getElementById('mapBox');
    target.closest = (sel) => (sel === '#mapBox' ? target : null);
    mapDrag({ type: 'pointerdown', button: 0, clientX: 10, clientY: 10, target });
    mapDrag({ type: 'pointermove', clientX: 15, clientY: 10, target });
    assert.ok(cx('Tulle (19)') > before);
    mapDrag({ type: 'pointerup', target });
    mapPick('Tulle (19)');
    assert.equal(document.getElementById('mapPlace').innerHTML, '', 'fin de glissé, pas un clic');
    mapFit('');
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
    const fiche = html('paneRecord');
    assert.ok(fiche.includes('Baptême'));
    assert.ok(fiche.includes('Acte'));
    assert.ok(fiche.includes('fin : Divorce, 1960'));
    assert.ok(fiche.includes('Ajouter un enfant avec Yves BLANC') || fiche.includes('Ajouter un enfant avec Yves'));
    assert.ok(fiche.includes('class="meds"'));
    assert.match(fiche, /Ouvrez une photo pour identifier les personnes/);
    assert.match(fiche, /<span class="med-n" title="1 personne identifiée">1<\/span>/);
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
    S.people.get('a').media[0].note = 'Lyon, avec Léa et Yves';
    openMedia('a', 'm1');
    assert.ok(html('mediaCard').includes('left:0%;top:20%'), 'position piégée remise à zéro');
    assert.match(html('mediaCard'), /class="hint tag-hint">Pour identifier quelqu’un, cliquez sur son visage/);
    assert.match(html('mediaCard'), /class="media-pic can-tag"/);
    // Repères invisibles, sans numéro ; le survol d'un nom éclaire son repère
    assert.match(html('mediaCard'), /class="tag-pin" type="button" data-tag="0"[^>]*><span class="tag-name"><b>Paul <span class="sur">BLANC<\/span><\/b><\/span><\/button>/);
    assert.match(html('mediaCard'), /<li data-tag="0"><button class="link"/);
    assert.doesNotMatch(html('mediaCard'), /class="tag-n"/);
    const pinEl = document.querySelector('.tag-pin[data-tag="0"]');
    const row = { closest: () => ({ dataset: { tag: '0' } }) };
    highlightTag(row, true);
    assert.ok(pinEl.classList.contains('lit'));
    highlightTag(row, false);
    assert.ok(!pinEl.classList.contains('lit'));
    highlightTag({ closest: () => null }, true); // ailleurs que sur un nom : rien
    assert.ok(html('mediaCard').includes('Paul BLANC'));
    const pic = el('mediaPic');
    pic.querySelector = () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }) });
    placePin(pic, { target: { closest: () => null }, clientX: 100, clientY: 50 });
    assert.ok(html('mediaCard').includes('id="tagFind"'), 'un champ de recherche, pas une liste de 200 noms');
    assert.match(html('mediaCard'), /Tapez un nom/, 'personne nommée dans la légende : rien à proposer d’office');
    S.people.get('a').media[0].note = 'Avec Léa Blanc';
    S.people.get('c').surname = 'Blanc';
    placePin(pic, { target: { closest: () => null }, clientX: 100, clientY: 50 });
    assert.match(html('mediaCard'), /data-act="tag-pick" data-id="c">Léa BLANC/, 'nommée dans la légende : proposée d’office');
    // La recherche ne redessine que les résultats ; les personnes déjà identifiées ne sont pas proposées
    onTagFind('blanc');
    assert.match(el('tagHits').innerHTML, /data-id="c">Léa BLANC/);
    assert.doesNotMatch(el('tagHits').innerHTML, /Paul BLANC/, 'déjà identifié');
    onTagFind('zzz');
    assert.match(el('tagHits').innerHTML, /Personne ne correspond/);
    cancelPin();
    assert.ok(!html('mediaCard').includes('id="tagFind"'));
    placePin(pic, { target: { closest: () => null }, clientX: 100, clientY: 50 });
    await addTag('c');
    assert.equal(S.people.get('a').media[0].tags.length, 2);
    await removeTag(0);
    assert.equal(S.people.get('a').media[0].tags.length, 1);
    closeMedia();
    assert.equal(el('mediaDlg').hidden, true);
  });

  test('visionneuse : modifier la légende sur place, annulable', async () => {
    openMedia('a', 'm1');
    assert.match(html('mediaCard'), /data-act="caption-edit">modifier le titre, la date, la légende</);
    assert.match(html('mediaCard'), /<h2 id="mdTitle">[^<]*<\/h2><button class="icon-btn md-pen" type="button" data-act="caption-edit"/, 'le titre se modifie depuis l’en-tête');
    editCaption(true);
    assert.match(html('mediaCard'), /id="mdEditNote" rows="3">Lyon</);
    el('mdEditTitle').value = 'Mariage';
    el('mdEditDate').value = '1950';
    el('mdEditNote').value = ' Geneviève (en haut), Paul ';
    await saveCaption();
    const m = S.people.get('a').media[0];
    assert.deepEqual([m.title, m.date, m.note], ['Mariage', '1950', 'Geneviève (en haut), Paul']);
    assert.ok(m.tags.length, 'les identifications restent');
    assert.match(html('mediaCard'), /<h2 id="mdTitle">Mariage<\/h2>/);
    await A.undo();
    assert.equal(S.people.get('a').media[0].title, 'Noce');
    // Fiche du propriétaire en cours de saisie : son enregistrement réécrirait la galerie
    A.startEdit('a');
    editCaption(true);
    assert.doesNotMatch(html('mediaCard'), /id="mdEditNote"/);
    A.cancelEdit();
    closeMedia();
  });

  test('visionneuse : image précédente et suivante, dans l’ordre de la galerie, au bouton ou au clavier', () => {
    loadTree([
      person('a', { given: 'Anne', surname: 'Roux', sex: 'F', media: [
        { id: 'm1', photo: 'data:image/jpeg;base64,AAAA', title: 'Noce' },
        { id: 'm2', photo: 'data:image/jpeg;base64,AAAA', title: 'Baptême' },
      ] }),
      person('b', { given: 'Paul', surname: 'Blanc', sex: 'M', media: [{ id: 'm3', photo: 'data:image/jpeg;base64,AAAA', title: 'Pêche', tags: [{ id: 'a', x: 5, y: 5 }] }] }),
    ]);
    S.focus = 'a';
    S.tab = 'record';
    renderAll();
    assert.match(html('paneRecord'), /data-act="media-open" data-owner="a" data-id="m1" data-group="person:a"/);
    openMedia('a', 'm1', 'person:a');
    assert.match(html('mediaCard'), /<span class="n">1 \/ 3<\/span>/, 'ses images et celles où elle est identifiée');
    assert.ok(stepMedia(1));
    assert.match(html('mediaCard'), /Baptême.*2 \/ 3/s);
    stepMedia(1);
    assert.match(html('mediaCard'), /Pêche.*3 \/ 3/s);
    stepMedia(1);
    assert.match(html('mediaCard'), /Noce.*1 \/ 3/s, 'on repart du début');
    stepMedia(-1);
    assert.match(html('mediaCard'), /Pêche/, 'et à l’envers');
    // Pas pendant qu'un repère attend sa personne
    const pic = { querySelector: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) }) };
    placePin(pic, { target: { closest: () => null }, clientX: 10, clientY: 10 });
    assert.equal(stepMedia(1), false);
    cancelPin();
    closeMedia();
    // Ouverte hors d'une galerie, ou avec une seule image : pas de navigation
    openMedia('b', 'm3');
    assert.doesNotMatch(html('mediaCard'), /media-step/);
    assert.equal(stepMedia(1), false);
    closeMedia();
  });

  test('recto et verso : badge sur la vignette, deux faces dans la visionneuse, identification sur le recto', () => {
    loadTree([
      person('a', { given: 'Anne', surname: 'Roux', sex: 'F', media: [
        { id: 'm1', photo: 'data:image/jpeg;base64,RECTO', back: 'data:image/jpeg;base64,VERSO', title: 'Contrat', tags: [{ id: 'a', x: 10, y: 10 }] },
        { id: 'm2', photo: 'data:image/jpeg;base64,SEUL', title: 'Portrait' },
      ] }),
    ]);
    S.focus = 'a';
    S.tab = 'record';
    renderAll();
    assert.match(html('paneRecord'), /data-id="m1"[^>]*>.*<span class="med-rv" title="Recto et verso">R\/V<\/span>/s);
    openMedia('a', 'm1', 'person:a');
    let card = html('mediaCard');
    assert.match(card, /data-act="media-side" data-back="0" aria-pressed="true">Recto/);
    assert.match(card, /src="data:image\/jpeg;base64,RECTO"/);
    assert.match(card, /tag-pin/, 'les personnes sur le recto');
    showMediaSide(true);
    card = html('mediaCard');
    assert.match(card, /src="data:image\/jpeg;base64,VERSO" alt="Contrat \(Verso\)"/);
    assert.doesNotMatch(card, /tag-pin|can-tag/, 'pas d’identification sur le verso');
    assert.match(card, /Les personnes s’identifient sur le recto/);
    const pic = { querySelector: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) }) };
    placePin(pic, { target: { closest: () => null }, clientX: 10, clientY: 10 });
    assert.doesNotMatch(html('mediaCard'), /tag-pick/, 'aucun repère posé sur le verso');
    stepMedia(1); // image suivante : de nouveau le recto
    card = html('mediaCard');
    assert.match(card, /SEUL/);
    assert.doesNotMatch(card, /media-sides/, 'une seule face : pas de bascule');
    stepMedia(1);
    assert.match(html('mediaCard'), /RECTO/);
    closeMedia();
    showMediaSide(true); // visionneuse fermée : rien
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

describe('bibliothèque de sources', () => {
  beforeEach(openExample);

  test('chaque document une fois, avec qui le cite ; avertissement dans le formulaire', async () => {
    const { sourceLibrary } = await import('../js/ui/analysis.js');
    loadTree([
      person('a', { given: 'Jean', surname: 'Roux', citations: [{ id: 'c1', source: 'S1', fact: 'union:u' }] }),
      person('b', { given: 'Marie', surname: 'Roux', citations: [{ id: 'c2', source: 'S1', fact: 'union:u' }] }),
      person('c', { given: 'Paul', sources: [{ id: 'old', kind: 'census', title: 'Recensement 1906' }] }),
    ], [{ id: 'u', a: 'a', b: 'b' }]);
    S.sources.set('S1', { kind: 'marriage', title: 'Mariage', place: 'Lyon', ref: 'n°12' });
    const lib = sourceLibrary();
    assert.deepEqual(lib.map((x) => [x.src.title, x.cites.map((c) => c.id)]), [['Mariage', ['a', 'b']], ['Recensement 1906', ['c']]]);
    S.focus = 'a';
    const out = view('sources');
    assert.ok(out.includes('2 documents, dont 1 partagé'));
    assert.ok(out.includes('Mariage · Lyon · n°12'));
    S.sources.set('S1', { ...S.sources.get('S1'), photo: 'data:image/png;base64,A', back: 'data:image/png;base64,B' });
    const zoomable = view('sources');
    assert.match(zoomable, /<img class="lib-pic zoomable" src="data:image\/png;base64,A" alt="Mariage"[^>]*data-act="photo-zoom">/, 'le document s’agrandit au clic');
    assert.match(zoomable, /src="data:image\/png;base64,B" alt="Mariage \(Verso\)"/, 'son verso aussi');
    assert.ok(out.includes('data-id="b"'));
    S.tab = 'record';
    A.startEdit('a');
    renderAll(true);
    assert.ok(html('paneRecord').includes('aussi cité par Marie ROUX'), 'formulaire : document partagé signalé');
    A.cancelEdit();
  });
});

describe('bibliothèque de sources : filtres', () => {
  beforeEach(openExample);

  test('par nature et par texte, sans redessiner le champ de recherche', async () => {
    const { setLibraryFilter } = await import('../js/ui/analysis.js');
    loadTree([
      person('a', { given: 'Jean', surname: 'Roux', citations: [{ id: 'c1', source: 'S1', fact: '' }, { id: 'c2', source: 'S2', fact: '' }] }),
      person('b', { given: 'Marie', surname: 'Durand', citations: [{ id: 'c3', source: 'S3', fact: '' }] }),
    ]);
    S.sources = new Map([['S1', { kind: 'marriage', title: 'Mariage', place: 'Lyon' }], ['S2', { kind: 'census', title: 'Recensement 1906' }], ['S3', { kind: 'birth', title: 'Naissance', place: 'Paris' }]]);
    S.focus = 'a';
    const out = view('sources');
    assert.ok(out.includes('id="lib-kind"') && out.includes('id="lib-q"'));
    const list = () => document.getElementById('libList').innerHTML;
    setLibraryFilter('census');
    assert.ok(list().includes('Recensement 1906') && !list().includes('Mariage'));
    setLibraryFilter('', 'lyon');
    assert.ok(list().includes('Mariage') && !list().includes('Recensement'));
    setLibraryFilter('', 'durand');
    assert.ok(list().includes('Naissance') && !list().includes('Mariage'), 'recherche par personne');
    setLibraryFilter('', 'zzz');
    assert.ok(list().includes('Aucun document ne correspond'));
    setLibraryFilter('', '');
  });
});

describe('bibliothèque de sources : ordre', () => {
  beforeEach(openExample);

  test('par nature, puis par personne citée (nom puis prénom), puis par numéro', async () => {
    const { sourceLibrary } = await import('../js/ui/analysis.js');
    loadTree([
      person('g', { given: 'Georges', surname: 'BOURREL', citations: [{ id: 'c1', source: 'D10', fact: 'death' }] }),
      person('o', { given: 'Olivier', surname: 'BOURREL', citations: [{ id: 'c2', source: 'D1094', fact: 'death' }] }),
      person('a', { given: 'Alice', surname: 'BOURREL', citations: [{ id: 'c3', source: 'D14', fact: 'death' }, { id: 'c4', source: 'D3', fact: 'death' }] }),
      person('m', { given: 'Monique', surname: 'LAMBORRE', citations: [{ id: 'c5', source: 'B2', fact: 'birth' }] }),
      // Une femme enregistrée avec son seul nom de jeune fille : rangée à ce nom, pas en tête
      person('z', { given: 'Anna', surname: '', maidenName: 'BOURREL', sex: 'F', citations: [{ id: 'c6', source: 'D757', fact: 'death' }] }),
      person('x', { given: 'Sans nom', citations: [{ id: 'c7', source: 'D1', fact: 'death' }] }),
    ]);
    S.sources = new Map([['D10', { kind: 'death', title: 'Acte n°10' }], ['D1094', { kind: 'death', title: 'Acte n°1094' }],
      ['D14', { kind: 'death', title: 'Acte n°14' }], ['D3', { kind: 'death', title: 'Acte n°3' }], ['B2', { kind: 'birth', title: 'Acte n°2' }],
      ['D757', { kind: 'death', title: 'Acte n°757' }], ['D1', { kind: 'death', title: 'Acte n°1' }]]);
    assert.deepEqual(sourceLibrary().map((x) => x.src.title), ['Acte n°2', 'Acte n°3', 'Acte n°14', 'Acte n°757', 'Acte n°10', 'Acte n°1094', 'Acte n°1']);
    // Un en-tête par famille, avec son nombre d'actes ; les fiches sans nom à la fin
    S.focus = 'g';
    const out = view('sources');
    const heads = [...out.matchAll(/<h4>([^<]*) <span class="n">(\d+)<\/span><\/h4>/g)].map((m) => m[1] + ' ' + m[2]);
    assert.deepEqual(heads, ['LAMBORRE 1', 'BOURREL 5', 'Sans nom 1']);
  });
});
