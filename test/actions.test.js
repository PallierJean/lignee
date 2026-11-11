import assert from 'node:assert/strict';
import { test, describe, beforeEach } from 'node:test';
import { fire, FakeElement } from './setup.js';
import { S, cardEls } from '../js/state.js';
import * as A from '../js/actions.js';
import { bindEvents } from '../js/events.js';
import { afterData } from '../js/ui/render.js';
import { openPersonDlg } from '../js/ui/person-dlg.js';
import { currentSituation, unionCauseText, hasDeathNumber, passesFilter } from '../js/model/people.js';
import { renderTree } from '../js/tree/render.js';
import { CW, CH, CARD_W, PHOTO_D, DUP_KEY, PREF_KEY } from '../js/config.js';
import { ignoredPairs } from '../js/services/dup-ignore.js';
import { parsePlace } from '../js/model/places.js';
import { resetHistory, canUndo } from '../js/services/history.js';
import { example, loadTree, person, resetApp, html } from './helpers.js';

const el = (id) => document.getElementById(id);
const ex = example();
const camille = ex.people.find((p) => p.given === 'Camille').id;
const settle = () => new Promise((r) => setImmediate(r));

function openExample() {
  resetApp();
  resetHistory();
  loadTree(ex.people, ex.unions);
  S.focus = camille;
  afterData();
}

/** Remplit le formulaire : le faux navigateur ne relit pas le HTML produit. */
function fill(values) {
  for (const id of ['f-given', 'f-surname', 'f-maiden', 'f-bdate', 'f-bplace', 'f-ddate', 'f-dplace', 'f-occ', 'f-situ', 'f-situdate', 'f-notes', 'f-father', 'f-mother']) {
    el(id).value = values[id] ?? S.edit.draft[{
      'f-given': 'given', 'f-surname': 'surname', 'f-maiden': 'maidenName', 'f-bdate': 'birthDate', 'f-bplace': 'birthPlace', 'f-ddate': 'deathDate',
      'f-dplace': 'deathPlace', 'f-occ': 'occupation', 'f-situ': 'situation', 'f-situdate': 'situationDate', 'f-notes': 'notes', 'f-father': 'fatherId', 'f-mother': 'motherId',
    }[id]] ?? '';
  }
  S.edit.unions.forEach((u, i) => Object.assign(el('u-date-' + i), { value: u.date }) && Object.assign(el('u-place-' + i), { value: u.place })
    && Object.assign(el('u-type-' + i), { value: u.type || '' }) && Object.assign(el('u-end-' + i), { value: u.end || '' }) && Object.assign(el('u-enddate-' + i), { value: u.endDate || '' })
    && Object.assign(el('u-cause-' + i), { value: u.cause || '' }) && Object.assign(el('u-former-' + i), { value: u.formerId || '' }));
  S.edit.events.forEach((x, i) => {
    for (const [k, id] of [['type', 'ev-type-'], ['date', 'ev-date-'], ['place', 'ev-place-'], ['note', 'ev-note-']]) el(id + i).value = x[k];
  });
  S.edit.sources.forEach((x, i) => {
    for (const [k, id] of [['kind', 'src-kind-'], ['fact', 'src-fact-'], ['title', 'src-title-'], ['place', 'src-place-'], ['ref', 'src-ref-'], ['note', 'src-note-']]) el(id + i).value = x[k];
  });
  S.edit.media.forEach((x, i) => {
    for (const [k, id] of [['title', 'med-title-'], ['date', 'med-date-'], ['note', 'med-note-']]) el(id + i).value = x[k];
  });
  for (const [id, value] of Object.entries(values)) if (id.startsWith('u-')) el(id).value = value;
  // Lieux : trois champs (ville, lieu-dit, département) par lieu
  const places = [['f-bplace', values['f-bplace'] ?? S.edit.draft.birthPlace], ['f-dplace', values['f-dplace'] ?? S.edit.draft.deathPlace],
    ...S.edit.unions.map((u, i) => ['u-place-' + i, values['u-place-' + i] ?? u.place]),
    ...S.edit.events.map((x, i) => ['ev-place-' + i, x.place])];
  for (const [id, value] of places) for (const [k, v] of Object.entries(parsePlace(value))) el(id + '-' + k).value = v;
}

describe('navigation et affichage', () => {
  beforeEach(openExample);

  test('changer de personne, d’onglet, de niveaux, de zoom', () => {
    const michel = ex.people.find((p) => p.given === 'Michel').id;
    A.setFocus(michel, true);
    assert.equal(S.focus, michel);
    A.setFocus('absent');
    assert.equal(S.focus, michel);
    A.setTab('register');
    assert.equal(el('paneRegister').hidden, false);
    A.setGenerations('up', 7);
    assert.equal(S.up, 7);
    A.setGenerations('up', 7);
    const zoom = S.zoom;
    A.zoomBy(1);
    assert.ok(S.zoom > zoom);
    A.recenter();
  });

  test('ascendants : fenêtre de quatre valeurs, jusqu’au plus lointain ancêtre de la personne choisie', () => {
    const shown = (up) => {
      A.setGenerations('up', up);
      return [...el('segUp').innerHTML.matchAll(/data-n="(\d+)"[^>]*>([^<]+)</g)].map((m) => m[2]).join(' ');
    };
    const chain = (n) => Array.from({ length: n }, (_, i) => person('g' + i, { fatherId: i + 1 < n ? 'g' + (i + 1) : null }));
    loadTree(chain(9)); // huit générations d'écart
    S.focus = 'g0';
    assert.equal(shown(0), '0 1 2 3 …');
    assert.equal(shown(2), '0 1 2 3 …');
    assert.equal(shown(3), '… 1 2 3 4 …');
    assert.equal(shown(5), '… 3 4 5 6 …');
    assert.equal(shown(6), '… 4 5 6 7 …');
    assert.equal(shown(7), '… 5 6 7 8');
    assert.equal(shown(8), '… 5 6 7 8');
    assert.match(el('segUp').innerHTML, /data-n="7"[^>]*>…</); // recule d'un cran
    S.focus = 'g5'; // trois générations au-dessus de g5 : le choix s'arrête à 3
    assert.equal(shown(8), '0 1 2 3');
    S.focus = 'g8'; // sans parent : de quoi ajouter parents et grands-parents
    assert.equal(shown(8), '0 1 2');
    S.focus = 'g0';

    loadTree(chain(5)); // S.up garde 8, le choix affiché s'arrête au plus lointain ancêtre
    A.setGenerations('up', 8);
    assert.equal(S.up, 8);
    assert.match(el('segUp').innerHTML, /data-n="4"[^>]*aria-pressed="true"/);
    assert.equal(shown(8), '… 1 2 3 4');
    assert.match(el('segUp').innerHTML, /data-n="3"[^>]*>…</);

    loadTree(chain(4));
    assert.equal(shown(3), '0 1 2 3');
    loadTree([person('seul')]); // de quoi ajouter parents et grands-parents
    assert.equal(shown(3), '0 1 2');
    loadTree([]);
    assert.equal(shown(3), '0 1 2');
  });

  test('descendants : fenêtre de quatre valeurs, jusqu’au dernier descendant de la personne choisie', () => {
    const shown = (down) => {
      A.setGenerations('down', down);
      return [...el('segDown').innerHTML.matchAll(/data-n="(\d+)"[^>]*>([^<]+)</g)].map((m) => m[2]).join(' ');
    };
    // g0 → g1 → … → g6 : six générations de descendants sous g0
    const line = (n) => Array.from({ length: n }, (_, i) => person('g' + i, { fatherId: i ? 'g' + (i - 1) : null }));
    loadTree(line(7));
    S.focus = 'g0';
    assert.equal(shown(0), '0 1 2 3 …');
    assert.equal(shown(4), '… 2 3 4 5 …');
    assert.equal(shown(6), '… 3 4 5 6');
    S.focus = 'g4'; // deux générations sous g4 : S.down garde 6, le choix affiché s'arrête à 2
    A.setGenerations('down', 6);
    assert.equal(S.down, 6);
    assert.match(el('segDown').innerHTML, /data-n="2"[^>]*aria-pressed="true"/);
    assert.equal(shown(6), '0 1 2');
    S.focus = 'g6'; // sans enfant : de quoi ajouter un enfant
    assert.equal(shown(2), '0 1');
    S.focus = 'g0';
    A.setGenerations('down', 2);
  });

  test('recentrer : la personne centrale ; défilement à la taille de l’arbre ; la roue aussi', () => {
    const canvas = el('canvas');
    const moves = [];
    canvas.scrollTo = (x) => moves.push(x);
    S.fan = false;
    const size = [canvas.clientWidth, canvas.clientHeight];
    // L'arbre tient à l'écran : centré, sans marge de défilement en trop
    Object.assign(canvas, { clientWidth: 10000, clientHeight: 8000 });
    renderTree();
    const w = Math.ceil(S.lastLayout.W * S.zoom);
    const h = Math.ceil(S.lastLayout.H * S.zoom);
    assert.equal(el('sizer').style.margin, `${Math.floor((8000 - h) / 2)}px ${Math.floor((10000 - w) / 2)}px`);
    // Plus grand que l'écran : les barres suivent sa taille, la personne centrale vient au milieu
    Object.assign(canvas, { clientWidth: 200, clientHeight: 150 });
    renderTree();
    assert.equal(el('sizer').style.margin, '0px 0px');
    const n = S.lastLayout.nodes.find((x) => x.focus);
    A.recenter();
    assert.equal(moves[0].left, (n.x + CW / 2) * S.zoom - 100);
    assert.equal(moves[0].top, (n.y + CH / 2) * S.zoom - 150 * 0.55);
    [canvas.clientWidth, canvas.clientHeight] = size;
    S.fan = true;
    canvas.scrollWidth = 1000;
    canvas.scrollHeight = 900;
    A.recenter();
    assert.equal(moves[1].left, 100);
    assert.equal(moves[1].top, 150);
    S.fan = false;
    delete canvas.scrollTo;
  });

  test('bascules : arbre complet, roue, lignée, langue', () => {
    A.toggleFull();
    assert.equal(S.full, true);
    A.toggleFan();
    assert.equal(S.fan, true);
    A.toggleFull();
    assert.deepEqual([S.full, S.fan], [true, false]);
    A.toggleLine();
    assert.equal(S.line, false);
    A.togglePanel();
    assert.equal(S.panel, false);
    assert.equal(el('main').className, 'main side-off');
    assert.equal(el('btnPanel').attrs['aria-pressed'], 'false');
    A.setTab('register'); // un onglet demandé rouvre le panneau
    assert.equal(S.panel, true);
    assert.equal(el('main').className, 'main');
    A.setTab('record');
    A.toggleLang();
    assert.equal(el('btnLang').textContent, 'FR');
    A.toggleLang();
  });

  test('mode photos : photo ronde, nom au survol, cartes plus petites, retenu', () => {
    const cards = () => [...cardEls.values()].filter((c) => c.dataset.id);
    const before = S.lastLayout.W;
    A.togglePhotos();
    assert.equal(S.photos, true);
    assert.equal(el('btnPhotos').attrs['aria-pressed'], 'true');
    assert.ok(el('tree').classList.contains('photos'));
    assert.equal(CW, PHOTO_D);
    assert.equal(CH, PHOTO_D);
    assert.ok(S.lastLayout.W < before, 'arbre plus étroit');
    const henri = cards().find((c) => S.people.get(c.dataset.id).given === 'Henri');
    assert.match(henri.innerHTML, /<img class="ph-img" src="images\/avatar_homme\.jpeg"/);
    assert.match(henri.innerHTML, /<span class="tip" aria-hidden="true"><b>Henri /);
    assert.ok(henri.attrs['aria-label'].startsWith('Henri'), 'nom toujours lu par les lecteurs d’écran');
    assert.equal(JSON.parse(localStorage.getItem(PREF_KEY)).photos, true);
    A.togglePhotos();
    assert.equal(CW, CARD_W);
    assert.ok(henri.innerHTML.includes('class="pic"'), 'fiche portrait : la photo au-dessus du nom');
  });

  test('filtres de l’arbre : vivants ou numéro d’acte, les autres cartes estompées', () => {
    const cards = () => el('tree').children.filter((c) => c.dataset && c.dataset.id);
    const faded = () => cards().filter((c) => c.className.includes('is-faded')).map((c) => S.people.get(c.dataset.id).given).sort();
    const henri = ex.people.find((p) => p.given === 'Henri').id;
    assert.deepEqual(faded(), [], 'sans filtre : aucune carte estompée');
    A.toggleFilter('living');
    assert.equal(S.filter, 'living');
    assert.equal(el('btnLiving').attrs['aria-pressed'], 'true');
    assert.ok(faded().includes('Henri'), 'décédé : estompé');
    assert.ok(!faded().includes('Camille'), 'en vie : net');
    assert.match(localStorage.getItem('lignee.view.v1'), /"filter":"living"/, 'gardé avec les préférences');

    S.people.get(henri).sources = [{ id: 's1', kind: 'death', fact: 'death', title: 'Acte n°412', photo: '' }];
    A.toggleFilter('certificate'); // l'un remplace l'autre
    assert.deepEqual([el('btnLiving').attrs['aria-pressed'], el('btnCertificate').attrs['aria-pressed']], ['false', 'true']);
    assert.ok(!faded().includes('Henri'), 'numéro d’acte dans une source : net');
    assert.ok(faded().includes('Camille'));
    A.toggleFilter('certificate'); // second clic : plus de filtre
    assert.equal(S.filter, '');
    assert.deepEqual(faded(), []);
    delete S.people.get(henri).sources;
  });

  test('numéro d’acte de décès : dans la cote ou le titre d’une source du décès', () => {
    assert.equal(hasDeathNumber({ sources: [{ kind: 'death', title: 'Acte n°5' }] }), true);
    assert.equal(hasDeathNumber({ sources: [{ kind: 'death', title: 'Décès', ref: '1094 N' }] }), true);
    assert.equal(hasDeathNumber({ sources: [{ kind: 'other', fact: 'death', title: 'Acte no 12' }] }), true);
    assert.equal(hasDeathNumber({ sources: [{ kind: 'death', title: 'Décès en 1950' }] }), false, 'une année n’est pas un numéro');
    assert.equal(hasDeathNumber({ sources: [{ kind: 'birth', title: 'Acte n°5' }] }), false, 'un autre acte');
    assert.equal(hasDeathNumber({}), false);
    assert.equal(passesFilter({ deceased: true }, 'living'), false);
    assert.equal(passesFilter({}, 'living'), true);
    assert.equal(passesFilter({ deceased: true }, ''), true);
  });

  test('parenté : ouverture, choix, surlignage, retour à la vue d’avant', () => {
    A.openKin(camille);
    assert.equal(S.tab, 'analysis');
    A.setKin('kinB', ex.people.find((p) => p.given === 'Michel').id);
    A.showKin();
    assert.deepEqual([S.kinShow, S.full], [true, true]);
    assert.ok(html('edges').includes('class="kin"'));
    A.hideKin();
    assert.deepEqual([S.kinShow, S.full], [false, false]);
  });

  test('frise et éphémérides', () => {
    A.setAnalysisView('time');
    A.setTimeScope(true);
    assert.equal(S.timeFamily, true);
    S.calMonth = 12;
    A.shiftMonth(1);
    assert.equal(S.calMonth, 1);
    A.shiftMonth(-1);
    assert.equal(S.calMonth, 12);
  });

  test('pendant une saisie, changer de personne demande quoi faire de la fiche', () => {
    const michel = ex.people.find((p) => p.given === 'Michel').id;
    A.startEdit(camille);
    A.setFocus(michel);
    assert.equal(S.focus, camille);
    assert.equal(el('leaveDlg').hidden, false);
    assert.match(el('leaveText').textContent, /Camille .* ouverte en modification/);
    assert.match(el('leaveDrop').textContent, /Abandonner et afficher Michel/);
    S.tab = 'register';
    A.leaveEdit(false);
    assert.equal(el('leaveDlg').hidden, true);
    assert.equal(S.tab, 'record', 'back to the form');
    assert.equal(S.edit.id, camille);
    A.setFocus(camille);
    assert.equal(el('leaveDlg').hidden, true, 'its own person: no question');
    A.editPerson(michel);
    assert.equal(el('leaveDlg').hidden, false);
    assert.match(el('leaveDrop').textContent, /Abandonner et modifier Michel/);
    A.leaveEdit(true);
    assert.equal(el('leaveDlg').hidden, true);
    assert.equal(S.focus, michel);
    assert.equal(S.edit.id, michel, 'the other record opens for editing');
    A.cancelEdit();
    A.startEdit(camille);
    A.setFocus(michel);
    A.leaveEdit(true);
    assert.equal(S.focus, michel);
    assert.equal(S.edit, null);
    A.setFocus(camille);
    A.startEdit(camille);
    A.startNew();
    A.startAdd('child', camille);
    assert.equal(S.edit.id, camille);
    A.cancelEdit();
    assert.equal(S.edit, null);
  });
});

describe('formulaire', () => {
  beforeEach(openExample);

  test('ajouter, annuler, rétablir', async () => {
    A.startNew();
    assert.ok(html('paneRecord').includes('Nouvelle personne'));
    fill({ 'f-given': 'Lou', 'f-surname': 'Noir', 'f-bdate': '1990' });
    await A.submitEdit();
    assert.equal(S.people.size, ex.people.length + 1);
    assert.equal(S.people.get(S.focus).given, 'Lou');
    await A.undo();
    assert.equal(S.people.size, ex.people.length);
    await A.redo();
    assert.equal(S.people.size, ex.people.length + 1);
  });

  test('failed save: a bug gets a message, a storage error is not reported twice', async () => {
    const quiet = console.error;
    console.error = () => {};
    const set = localStorage.setItem;
    try {
      S.mode = 'local';
      // A bug while saving (here, storage throwing a plain error): generic message
      A.startNew();
      fill({ 'f-given': 'Lou', 'f-surname': 'Noir' });
      S.people.set = () => { throw new TypeError('boom'); };
      await A.submitEdit();
      delete S.people.set;
      assert.match(el('toast').textContent, /erreur inattendue/);
      assert.equal(S.busy, false);
      // The browser is full: only the storage's own message
      localStorage.setItem = () => { throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); };
      fill({ 'f-given': 'Lou', 'f-surname': 'Noir' });
      await A.submitEdit();
      assert.match(el('toast').textContent, /plus de place/);
      assert.ok(S.edit, 'the form stays open, nothing was saved');
      assert.equal([...S.people.values()].some((p) => p.given === 'Lou'), false);
    } finally {
      localStorage.setItem = set;
      console.error = quiet;
      S.edit = null;
    }
  });

  test('dates en toutes lettres dans le formulaire ; la saisie d’origine reste si le jour ne change pas', async () => {
    loadTree([person('a', { given: 'Ana', surname: 'Roux', birthDate: '01/01/1900', deathDate: '1970' })]);
    S.focus = 'a';
    A.startEdit('a');
    const form = html('paneRecord');
    assert.match(form, /id="f-bdate" value="01 Janvier 1900"/);
    assert.match(form, /id="f-ddate" value="1970"/);
    fill({ 'f-bdate': '01 Janvier 1900' });
    await A.submitEdit();
    assert.equal(S.people.get('a').birthDate, '01/01/1900', 'même jour : rien ne change');
    A.startEdit('a');
    fill({ 'f-bdate': '02 Janvier 1900' });
    await A.submitEdit();
    assert.equal(S.people.get('a').birthDate, '02 Janvier 1900');
  });

  test('erreurs de saisie : nom, date, parents, fratrie', async () => {
    A.startNew();
    fill({});
    await A.submitEdit();
    assert.equal(S.edit.error, 'f.errName');
    fill({ 'f-given': 'A', 'f-bdate': '31/02/1900' });
    await A.submitEdit();
    assert.equal(S.edit.error, 'f.errDate');
    fill({ 'f-given': 'A', 'f-father': camille, 'f-mother': camille });
    await A.submitEdit();
    assert.equal(S.edit.error, 'f.errParents');
    A.cancelEdit();
    loadTree([person('a', { given: 'Seul' })]);
    S.focus = 'a';
    A.startAdd('sibling', 'a');
    fill({ 'f-given': 'B' });
    await A.submitEdit();
    assert.equal(S.edit.error, 'f.errSibling');
  });

  test('ajouter père, mère, enfant, conjoint, frère', async () => {
    const michel = ex.people.find((p) => p.given === 'Michel');
    for (const [rel, of] of [['spouse', camille], ['child', camille], ['sibling', camille], ['child', michel.id]]) {
      A.startAdd(rel, of);
      assert.ok(S.edit);
      A.cancelEdit();
    }
    loadTree([person('a', { given: 'Ana', sex: 'F', motherId: 'm' }), person('m', { given: 'Mia', sex: 'F' })]);
    S.focus = 'a';
    A.startAdd('father', 'a');
    fill({ 'f-given': 'Paul' });
    await A.submitEdit();
    const father = S.people.get('a').fatherId;
    assert.equal(S.people.get(father).given, 'Paul');
    assert.equal(S.unions.size, 1, 'union créée avec la mère');
    A.startAdd('child', 'a');
    assert.equal(S.edit.draft.motherId, 'a');
    A.cancelEdit();
    A.startAdd('mother', father);
    assert.equal(S.edit.draft.sex, 'F');
    A.cancelEdit();
  });

  test('événements, sources et galerie : ajout, retrait, enregistrement', async () => {
    A.startEdit(camille);
    A.addDraftEvent();
    A.addDraftEvent();
    A.removeDraftEvent(1);
    A.addDraftSource();
    A.addDraftSource();
    A.removeDraftSource(1);
    S.edit.media.push({ id: 'm1', photo: 'data:image/jpeg;base64,AAAA', title: 'Noce', date: '', note: '', tags: [], removed: false });
    fill({});
    A.refreshDraft();
    S.edit.sources[0].title = 'Acte';
    S.edit.sources[0].fact = S.edit.events[0].id;
    fill({});
    await A.submitEdit();
    const p = S.people.get(camille);
    assert.equal(p.events.length, 1);
    assert.equal(p.sources[0].title, 'Acte');
    assert.equal(p.sources[0].fact, p.events[0].id);
    assert.equal(p.media[0].title, 'Noce');
    A.startEdit(camille);
    assert.equal(S.edit.media.length, 1);
    A.removeDraftEvent(0);
    A.removeDraftMedia(0);
    fill({});
    await A.submitEdit();
    assert.equal(S.people.get(camille).sources[0].fact, '', 'source gardée pour la fiche entière');
    assert.equal(S.people.get(camille).media, undefined);
  });

  test('unions du formulaire : ajout, modification, retrait', async () => {
    const michel = ex.people.find((p) => p.given === 'Michel').id;
    A.startEdit(camille);
    A.addDraftUnion(michel);
    const before = S.unions.size;
    fill({});
    S.edit.unions[S.edit.unions.length - 1].type = 'pacs';
    el('u-type-' + (S.edit.unions.length - 1)).value = 'pacs';
    await A.submitEdit();
    assert.equal(S.unions.size, before + 1);
    A.startEdit(camille);
    fill({});
    el('u-end-0').value = 'divorce';
    el('u-enddate-0').value = '2020';
    await A.submitEdit();
    assert.equal([...S.unions.values()].filter((u) => u.end === 'divorce').length, 1);
    A.startEdit(camille);
    A.removeDraftUnion(S.edit.unions.length - 1);
    fill({});
    await A.submitEdit();
    assert.equal(S.unions.size, before);
  });

  test('situation : le type et la fin de la dernière union suivent', async () => {
    loadTree([person('a', { given: 'A', sex: 'F' }), person('b', { given: 'B', sex: 'M' })], [{ id: 'u', a: 'a', b: 'b', date: '', place: '' }]);
    S.focus = 'a';
    A.startEdit('a');
    fill({ 'f-situ': 'remarried', 'f-situdate': '1990' });
    await A.submitEdit();
    assert.equal(S.unions.get('u').type, 'remarried');
    assert.equal(S.unions.get('u').date, '1990');
    assert.equal(S.people.get('b').situation, 'married', 'le conjoint est marié, pas remarié');
    A.startEdit('a');
    fill({ 'f-situ': 'widowed' });
    await A.submitEdit();
    assert.equal(S.unions.get('u').end, 'death');
  });

  describe('le couple partage son statut', () => {
    const couple = (a = {}, b = {}, union = {}) => {
      loadTree([person('a', { given: 'A', sex: 'F', ...a }), person('b', { given: 'B', sex: 'M', ...b })], [{ id: 'u', a: 'a', b: 'b', date: '', place: '', ...union }]);
      S.focus = 'a';
    };
    const setSituation = async (id, situation) => {
      A.startEdit(id);
      fill({ 'f-situ': situation });
      await A.submitEdit();
    };

    test('union sans type : concubinage pour les deux', async () => {
      couple();
      await setSituation('a', 'cohabiting');
      assert.equal(S.unions.get('u').type, 'cohabiting');
      assert.equal(S.people.get('b').situation, 'cohabiting');
    });

    test('union déjà mariée : passer en concubinage change l’union et le conjoint', async () => {
      couple({ situation: 'married' }, { situation: 'married' }, { type: 'married' });
      await setSituation('a', 'cohabiting');
      assert.equal(S.unions.get('u').type, 'cohabiting');
      assert.equal(S.people.get('b').situation, 'cohabiting');
      assert.equal(currentSituation('a'), 'cohabiting');
      assert.equal(currentSituation('b'), 'cohabiting');
    });

    test('conjoint remarié : il suit aussi le concubinage, mais reste remarié si le couple est marié', async () => {
      couple({}, { situation: 'remarried' }, { type: 'married' });
      await setSituation('a', 'cohabiting');
      assert.equal(S.people.get('b').situation, 'cohabiting');
      couple({}, { situation: 'remarried' }, { type: 'married' });
      await setSituation('a', 'married');
      assert.equal(S.people.get('b').situation, 'remarried');
    });

    test('sans changement de statut, un type d’union religieux est conservé', async () => {
      couple({ situation: 'married' }, { situation: 'married' }, { type: 'religious' });
      await setSituation('a', 'married');
      assert.equal(S.unions.get('u').type, 'religious');
    });

    test('nouveau partenaire d’une personne en concubinage : même statut', async () => {
      loadTree([person('a', { given: 'A', sex: 'F', situation: 'cohabiting' })]);
      S.focus = 'a';
      A.startAdd('spouse', 'a');
      fill({ 'f-given': 'Paul' });
      await A.submitEdit();
      const [id, paul] = [...S.people].find(([, p]) => p.given === 'Paul');
      assert.equal(paul.situation, 'cohabiting');
      assert.equal(currentSituation(id), 'cohabiting');
      assert.equal(S.unions.values().next().value.type, 'cohabiting');
    });

    test('partenaire déjà présent, sans statut, relié dans son formulaire : même statut', async () => {
      loadTree([person('a', { given: 'A', sex: 'F', situation: 'cohabiting' }), person('b', { given: 'B', sex: 'M' })]);
      S.focus = 'b';
      A.startEdit('b');
      A.addDraftUnion('a');
      fill({});
      await A.submitEdit();
      assert.equal(S.people.get('b').situation, 'cohabiting');
    });

    test('union terminée ou conjoint décédé : le statut n’est pas repris', async () => {
      couple({ situation: 'cohabiting' }, {}, { type: 'cohabiting', end: 'separation' });
      await setSituation('b', '');
      assert.equal(S.people.get('b').situation, '');
      couple({ situation: 'cohabiting', deathDate: '2000', deceased: true }, {}, { type: 'cohabiting' });
      await setSituation('b', '');
      assert.equal(S.people.get('b').situation, 'widowed', 'veuve, pas en concubinage');
    });

    test('type d’union changé dans le bloc : la situation suit, le conjoint aussi', async () => {
      couple({ situation: 'married' }, { situation: 'married' }, { type: 'married' });
      A.startEdit('a');
      fill({ 'u-type-0': 'cohabiting' });
      await A.submitEdit();
      assert.equal(S.people.get('a').situation, 'cohabiting');
      assert.equal(S.people.get('b').situation, 'cohabiting');
    });

    test('divorce saisi dans le bloc : les deux conjoints sont divorcés', async () => {
      couple({ situation: 'married' }, { situation: 'married' }, { type: 'married' });
      A.startEdit('a');
      fill({ 'u-end-0': 'divorce', 'u-enddate-0': '1980' });
      await A.submitEdit();
      assert.equal(S.people.get('a').situation, 'divorced');
      assert.equal(S.people.get('b').situation, 'divorced');
    });

    test('décès : l’union s’arrête, le conjoint survivant est veuf, le défunt reste marié', async () => {
      couple({ situation: 'married' }, { situation: 'married' }, { type: 'married' });
      A.startEdit('a');
      fill({ 'f-ddate': '1999' });
      await A.submitEdit();
      assert.equal(S.unions.get('u').end, 'death');
      assert.equal(S.unions.get('u').endDate, '1999');
      assert.equal(currentSituation('a'), 'married');
      assert.equal(S.people.get('b').situation, 'widowed');
      assert.equal(currentSituation('b'), 'widowed');
    });

    test('une union divorcée ne passe pas en veuvage au décès', async () => {
      couple({}, {}, { type: 'married', end: 'divorce', endDate: '1980' });
      A.startEdit('a');
      fill({ 'f-ddate': '1999' });
      await A.submitEdit();
      assert.equal(S.unions.get('u').end, 'divorce');
      assert.equal(S.unions.get('u').endDate, '1980');
    });

    test('remariage : la cause et le conjoint décédé ferment l’union précédente', async () => {
      loadTree([person('a', { given: 'A', sex: 'F' }), person('b', { given: 'B', sex: 'M', deceased: true }), person('c', { given: 'C', sex: 'M' })], [
        { id: 'u1', a: 'a', b: 'b', type: 'married', date: '1950', place: '', end: 'separation' },
        { id: 'u2', a: 'a', b: 'c', date: '1960', place: '' },
      ]);
      S.focus = 'a';
      A.startEdit('a');
      fill({ 'u-type-1': 'remarried', 'u-cause-1': 'widowed', 'u-former-1': 'b' });
      await A.submitEdit();
      assert.equal(S.unions.get('u2').type, 'remarried');
      assert.equal(S.unions.get('u2').cause, 'widowed');
      assert.equal(S.unions.get('u2').formerId, 'b');
      assert.equal(S.unions.get('u1').end, 'separation', 'une fin renseignée est gardée');
      assert.equal(S.people.get('a').situation, 'remarried');
      assert.equal(S.people.get('c').situation, 'married', 'premier mariage du conjoint');
      assert.equal(unionCauseText(S.unions.get('u2')), 'après le décès de B');
    });

    test('remariage après divorce : la fin de l’union précédente est renseignée', async () => {
      loadTree([person('a', { given: 'A', sex: 'F' }), person('b', { given: 'B', sex: 'M' }), person('c', { given: 'C', sex: 'M' })], [
        { id: 'u1', a: 'a', b: 'b', type: 'married', date: '1950', place: '' },
        { id: 'u2', a: 'a', b: 'c', date: '1960', place: '' },
      ]);
      S.focus = 'a';
      A.startEdit('a');
      fill({ 'u-type-1': 'remarried', 'u-cause-1': 'divorce' });
      await A.submitEdit();
      assert.equal(S.unions.get('u1').end, 'divorce');
      assert.equal(S.unions.get('u2').formerId, '');
    });

    test('le conjoint a une union plus récente : il ne change pas', async () => {
      loadTree([person('a', { given: 'A', sex: 'F' }), person('b', { given: 'B', sex: 'M', situation: 'married' }), person('c', { given: 'C', sex: 'F' })], [
        { id: 'u1', a: 'a', b: 'b', date: '1950', place: '' },
        { id: 'u2', a: 'b', b: 'c', date: '1980', place: '', type: 'married' },
      ]);
      S.focus = 'a';
      await setSituation('a', 'cohabiting');
      assert.equal(S.people.get('b').situation, 'married');
    });
  });
});

describe('suppression, exemples, fusion', () => {
  beforeEach(openExample);

  test('supprimer une fiche : liens retirés, annulation complète', async () => {
    const michel = ex.people.find((p) => p.given === 'Michel').id;
    A.confirmDelete(true);
    assert.ok(html('paneRecord').includes('data-act="delete-yes"'));
    await A.doDelete(michel);
    assert.ok(!S.people.has(michel));
    assert.equal(S.people.get(camille).fatherId, null);
    await A.undo();
    assert.equal(S.people.get(camille).fatherId, michel);
    await A.doDelete('absent');
  });

  test('supprimer depuis la fenêtre d’une personne : la personne centrale reste', async () => {
    const hugo = ex.people.find((p) => p.given === 'Hugo').id;
    openPersonDlg(hugo);
    assert.match(html('personCard'), new RegExp(`data-act="delete-ask" data-id="${hugo}"`));
    A.confirmDelete(true, hugo);
    assert.match(html('personCard'), new RegExp(`data-act="delete-yes" data-id="${hugo}"`));
    assert.doesNotMatch(html('paneRecord'), /data-act="delete-yes"/, 'la fiche de Camille ne demande rien');
    await A.doDelete(hugo);
    assert.ok(!S.people.has(hugo));
    assert.equal(S.focus, camille);
    assert.equal(S.popup, null, 'la fenêtre se ferme');
    await A.undo();
    assert.ok(S.people.has(hugo));
  });

  test('supprimer depuis le formulaire d’une fiche créée au mauvais endroit', async () => {
    const lea = ex.people.find((p) => p.given === 'Léa').id;
    A.startEdit(lea);
    assert.match(html('paneRecord'), /data-act="form-delete-ask"/);
    assert.match(html('paneRecord'), new RegExp(`id="f-delconfirm" hidden>.*data-act="delete-yes" data-id="${lea}"`, 's'));
    await A.doDelete(lea);
    assert.equal(S.edit, null, 'la saisie est abandonnée');
    assert.ok(!S.people.has(lea));
    await A.undo();
    assert.ok(S.people.has(lea));
    A.startNew();
    assert.doesNotMatch(html('paneRecord'), /form-delete-ask/, 'rien à supprimer pour une fiche pas encore créée');
    A.cancelEdit();
  });

  test('retirer les exemples, puis annuler', async () => {
    A.confirmRemoveExamples(true);
    assert.ok(html('banner').includes('data-act="ex-yes"'));
    await A.removeExamples();
    assert.equal(S.people.size, 0);
    await A.undo();
    assert.equal(S.people.size, ex.people.length);
  });

  test('fusion : enfants, unions, identifications et sources suivent', async () => {
    loadTree([
      person('k', { given: 'Jean', surname: 'Roux', sex: 'M', birthDate: '1900' }),
      person('d', { given: 'Jean', surname: 'Roux', sex: 'M', birthPlace: 'Lyon', fatherId: 'k' }),
      person('w', { given: 'Ana', sex: 'F', sources: [{ id: 's', fact: 'union:u2' }], media: [{ id: 'm', photo: 'x', tags: [{ id: 'd', x: 1, y: 1 }] }] }),
      person('c', { fatherId: 'd' }), person('o', { sex: 'F' }),
    ], [
      { id: 'u1', a: 'k', b: 'w', date: '', place: '' }, { id: 'u2', a: 'd', b: 'w', date: '1920', place: 'Lyon' },
      { id: 'u3', a: 'd', b: 'o', date: '', place: '' }, { id: 'u4', a: 'd', b: 'k', date: '', place: '' },
    ]);
    S.focus = 'd';
    await A.mergePeople('k', 'd');
    assert.ok(!S.people.has('d'));
    assert.equal(S.focus, 'k');
    assert.equal(S.people.get('c').fatherId, 'k');
    assert.equal(S.people.get('k').birthPlace, 'Lyon');
    assert.equal(S.people.get('k').fatherId, null, 'jamais son propre parent');
    assert.equal(S.unions.get('u1').date, '1920');
    assert.equal(S.unions.get('u3').a, 'k');
    assert.equal(S.people.get('w').sources[0].fact, 'union:u1');
    assert.equal(S.people.get('w').media[0].tags[0].id, 'k');
    assert.ok(canUndo());
    await A.undo();
    assert.ok(S.people.has('d'));
    A.ignoreDuplicate('a|b');
    assert.ok(ignoredPairs().has('a|b'));
    assert.deepEqual(JSON.parse(localStorage.getItem(DUP_KEY)), { principal: ['a|b'] }, 'gardé après rechargement');
    S.tree = 'autre';
    assert.equal(ignoredPairs().size, 0, 'propre à chaque arbre');
    S.tree = 'principal';
  });

  test('annuler pendant une saisie : refusé', async () => {
    A.startNew();
    await A.undo();
    assert.match(el('toast').textContent, /Enregistrez ou annulez/);
  });
});

describe('événements de la page', () => {
  let bound = false;
  beforeEach(() => {
    openExample();
    if (!bound) bindEvents();
    bound = true;
    for (const id of ['transfer', 'printDlg', 'treesDlg', 'personDlg', 'mediaDlg', 'photoZoom', 'leaveDlg', 'cropDlg']) el(id).hidden = true;
    Object.assign(el('prFormat'), { value: 'A3' });
    Object.assign(el('prOrient'), { value: 'auto' });
    Object.assign(el('prContent'), { value: 'tree' });
  });

  const target = (dataset = {}, id = '', tag = 'button') => Object.assign(new FakeElement(id, tag), { dataset });
  const click = (dataset) => fire('click', { target: target(dataset) });
  const key = (key, extra = {}) => {
    const ev = { key, target: target(), preventDefault() { ev.prevented = true; }, ...extra };
    fire('keydown', ev);
    return ev;
  };

  test('phone: the side panel opens over the tree, the Back button closes it', () => {
    globalThis.matchMedia = () => ({ matches: true });
    try {
      click({ act: 'tab', tab: 'register' });
      assert.equal(S.sheet, true);
      assert.match(el('main').className, /\bsheet\b/);
      assert.deepEqual(history.state, { sheet: true });
      click({ act: 'sheet-close' });
      assert.equal(S.sheet, false);
      assert.equal(history.state, null, 'its history entry is gone');
      A.startEdit(camille);
      assert.equal(S.sheet, true, 'editing opens it');
      history.back();
      assert.equal(S.sheet, false);
      assert.ok(S.edit, 'the input is kept for later');
      click({ act: 'panel' });
      assert.equal(S.sheet, true, 'the panel button opens it again');
      assert.equal(S.panel, true, 'the desktop setting is unchanged');
      A.cancelEdit();
      click({ act: 'sheet-close' });
    } finally {
      delete globalThis.matchMedia;
    }
  });

  test('pinching the tree with two fingers zooms one step at a time', () => {
    const onCanvas = { closest: (sel) => (sel === '#canvas' ? {} : null) };
    const touch = (type, pointerId, x) => fire(type, { type, pointerId, pointerType: 'touch', clientX: x, clientY: 100, target: onCanvas });
    S.zoom = 1;
    touch('pointerdown', 1, 100);
    touch('pointerdown', 2, 200);
    touch('pointermove', 2, 220);
    assert.equal(S.zoom, 1, 'a small spread does nothing');
    touch('pointermove', 2, 240);
    const zoomed = S.zoom;
    assert.ok(zoomed > 1, 'spread: zoom in');
    touch('pointermove', 2, 180);
    assert.ok(S.zoom < zoomed, 'pinch: zoom out');
    touch('pointerup', 1, 100);
    touch('pointerup', 2, 180);
    const after = S.zoom;
    touch('pointermove', 2, 400);
    assert.equal(S.zoom, after, 'fingers lifted: nothing more');
    fire('pointerdown', { type: 'pointerdown', pointerId: 3, pointerType: 'mouse', clientX: 0, clientY: 0, target: onCanvas });
  });

  test('chaque bouton lance son action', async () => {
    click({ act: 'tab', tab: 'register' });
    assert.equal(S.tab, 'register');
    click({ act: 'up', n: '5' });
    assert.equal(S.up, 5);
    click({ act: 'down', n: '1' });
    click({ act: 'zoom', d: '1' });
    click({ act: 'center' });
    click({ act: 'full' });
    click({ act: 'fan' });
    click({ act: 'line' });
    click({ act: 'lang' });
    click({ act: 'lang' });
    click({ act: 'analysis-view', view: 'cal' });
    click({ act: 'cal-month', d: '1' });
    click({ act: 'time-scope', family: 'true' });
    click({ act: 'kin-open', id: camille });
    click({ act: 'dup-ignore', key: 'x|y' });
    click({ act: 'focus', id: camille });
    click({ act: 'new' });
    click({ act: 'ev-add' });
    click({ act: 'ev-remove', i: '0' });
    click({ act: 'src-add' });
    click({ act: 'src-remove', i: '0' });
    click({ act: 'med-remove', i: '0' });
    click({ act: 'photo-remove' });
    click({ act: 'src-photo-remove', i: '0' });
    click({ act: 'cancel-edit' });
    click({ act: 'add', rel: 'spouse', of: camille });
    click({ act: 'cancel-edit' });
    click({ act: 'edit' });
    click({ act: 'cancel-edit' });
    click({ act: 'delete-ask' });
    click({ act: 'delete-no' });
    click({ act: 'ex-ask' });
    click({ act: 'ex-no' });
    click({ act: 'undo' });
    click({ act: 'redo' });
    click({ act: 'inconnu' });
    await settle();
    assert.equal(S.edit, null);
  });

  test('fenêtres : ouverture, fermeture, fond, Échap, photo', () => {
    for (const [open, id] of [['import-open', 'transfer'], ['export-open', 'transfer'], ['print-open', 'printDlg'], ['trees-open', 'treesDlg']]) {
      click({ act: open });
      assert.equal(el(id).hidden, false, id);
      key('Escape');
      assert.equal(el(id).hidden, true, id);
      click({ act: open });
      fire('click', { target: target({}, id) });
      assert.equal(el(id).hidden, true, id);
    }
    click({ act: 'person-open', id: camille });
    assert.equal(el('personDlg').hidden, false);
    key('Escape');
    assert.equal(el('personDlg').hidden, true);
    click({ act: 'person-open', id: camille });
    click({ act: 'person-center', id: camille });
    click({ act: 'person-open', id: camille });
    click({ act: 'person-edit', id: camille });
    assert.ok(S.edit);
    key('Escape');
    assert.equal(S.edit, null);
    click({ act: 'photo-zoom', src: 'x' });
  });

  test('menu Affichage : Échap ou un clic ailleurs le ferme ; ses listes changent le thème et le texte', () => {
    const look = el('appearance');
    look.contains = (node) => node === look;
    look.open = true;
    key('Escape');
    assert.equal(look.open, false);
    look.open = true;
    fire('click', { target: look });
    assert.equal(look.open, true, 'clic dans le menu');
    fire('click', { target: target() });
    assert.equal(look.open, false, 'clic ailleurs');
    fire('change', { target: Object.assign(target({}, 'themeSel', 'select'), { value: 'contraste-sombre' }) });
    assert.equal(S.theme, 'contraste-sombre');
    fire('change', { target: Object.assign(target({}, 'textSel', 'select'), { value: 'large' }) });
    assert.equal(S.textSize, 'large');
    A.setTheme('auto');
    A.setTextSize('normal');
  });

  test('photo agrandie : un clic ou Échap la ferme', () => {
    const img = Object.assign(target({ act: 'photo-zoom' }), { src: 'a.jpg', alt: 'A' });
    fire('click', { target: img });
    assert.equal(el('photoZoom').hidden, false);
    fire('click', { target: target() });
    assert.equal(el('photoZoom').hidden, true);
    fire('click', { target: img });
    key('Escape');
    assert.equal(el('photoZoom').hidden, true);
  });

  test('raccourcis : Ctrl+Z, Ctrl+Maj+Z, Ctrl+Y, /, Ctrl+K', async () => {
    await A.doDelete(ex.people.find((p) => p.given === 'Hugo').id);
    key('z', { ctrlKey: true });
    await settle();
    assert.equal(S.people.size, ex.people.length);
    key('z', { ctrlKey: true, shiftKey: true });
    await settle();
    assert.equal(S.people.size, ex.people.length - 1);
    key('y', { ctrlKey: true });
    await settle();
    assert.ok(key('/').prevented);
    assert.ok(key('k', { ctrlKey: true }).prevented);
    fire('keydown', { target: target(), preventDefault() {} }); // remplissage automatique : pas de touche
  });

  test('saisies : recherche, situation, sexe, parents', () => {
    const input = (id, value) => fire('input', { target: Object.assign(target({}, id, 'input'), { value }) });
    input('q', 'cam');
    assert.equal(S.query, 'cam');
    A.startNew();
    const change = (props) => fire('change', { target: Object.assign(target({}, props.id || '', 'select'), props) });
    change({ name: 'f-sex', value: 'F' });
    assert.equal(el('f-maiden-row').hidden, false);
    change({ id: 'f-father', value: '' });
    change({ id: 'f-situ', value: 'married' });
    assert.equal(el('f-situdate-row').hidden, false);
    A.addDraftUnion(camille);
    change({ id: 'f-situ', value: 'remarried' });
    assert.equal(el('u-type-0').value, 'remarried');
    assert.equal(el('u-cause-row-0').hidden, false);
    el('u-cause-0').value = 'widowed';
    change({ id: 'u-cause-0', value: 'widowed' });
    assert.equal(el('u-former-row-0').hidden, false);
    el('u-type-0').value = 'pacs';
    change({ id: 'u-type-0', value: 'pacs' });
    assert.equal(el('f-situ').value, 'pacs');
    assert.equal(el('u-cause-row-0').hidden, true);
    el('u-end-0').value = 'divorce';
    change({ id: 'u-end-0', value: 'divorce' });
    assert.equal(el('f-situ').value, 'divorced');
    change({ id: 'kinB', value: camille });
    assert.equal(S.kinB, camille);
    A.cancelEdit();
  });

  test('envois de formulaires', async () => {
    A.startNew();
    fill({ 'f-given': 'Ida' });
    fire('submit', { target: target({}, 'editForm'), preventDefault() {} });
    await settle();
    await settle();
    assert.ok([...S.people.values()].some((p) => p.given === 'Ida'));
  });

  test('every other click, submit and key reaches its action', async () => {
    const realTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (fn) => { fn(); return 0; };
    try {
      // Form: delete confirmation shown and hidden without redrawing the form
      click({ act: 'edit' });
      const delBtn = el('f-del-btn');
      fire('click', { target: Object.assign(target({ act: 'form-delete-ask' }), { hidden: false }) });
      assert.equal(el('f-delconfirm').hidden, false);
      click({ act: 'form-delete-no' });
      assert.equal(el('f-delconfirm').hidden, true);
      assert.ok(delBtn);
      click({ act: 'cancel-edit' });
      // Register export, repository link and reconnect: the transfer dialog opens on the right field
      click({ act: 'register-csv' });
      assert.equal(el('transfer').hidden, false);
      click({ act: 'repo-link-open' });
      assert.equal(document.activeElement, el('repoUrl'));
      click({ act: 'repo-reconnect' });
      assert.equal(document.activeElement, el('repoToken'));
      key('Escape');
      assert.equal(el('transfer').hidden, true);
      // Person dialog: centre on the person
      const other = ex.people.find((p) => p.given !== 'Camille').id;
      click({ act: 'person-open', id: other });
      click({ act: 'person-center', id: other });
      assert.equal(S.focus, other);
      assert.equal(el('personDlg').hidden, true);
      // Gallery viewer: open, go to a person, close
      S.people.set(camille, { ...S.people.get(camille), media: [{ id: 'm1', photo: 'data:image/jpeg;base64,AA', title: 'Photo', tags: [] }] });
      click({ act: 'media-open', owner: camille, id: 'm1' });
      assert.equal(el('mediaDlg').hidden, false);
      click({ act: 'media-person', id: camille });
      assert.equal(el('mediaDlg').hidden, true);
      assert.equal(el('personDlg').hidden, false);
      key('Escape');
      click({ act: 'media-open', owner: camille, id: 'm1' });
      click({ act: 'media-close' });
      assert.equal(el('mediaDlg').hidden, true);
      // Fan chart: back with nobody to go back to
      click({ act: 'fan-back' });
      // Ctrl+B toggles the panel; not while a dialog is open
      const panel = S.panel;
      assert.ok(key('b', { ctrlKey: true }).prevented);
      assert.equal(S.panel, !panel);
      el('printDlg').hidden = false;
      assert.ok(!key('b', { ctrlKey: true }).prevented);
      el('printDlg').hidden = true;
      key('b', { ctrlKey: true });
      // Enter on a fan sector opens the person
      const sector = Object.assign(target({ id: camille }), { closest: (sel) => (sel === '.fan-s' ? sector : null) });
      fire('keydown', { key: 'Enter', target: sector, preventDefault() {} });
      assert.equal(el('personDlg').hidden, false);
      // Escape: the topmost dialog first (record being edited dialog over the person dialog)
      el('leaveDlg').hidden = false;
      key('Escape');
      assert.equal(el('leaveDlg').hidden, true);
      assert.equal(el('personDlg').hidden, false);
      key('Escape');
      assert.equal(el('personDlg').hidden, true);
      // Search field and spouse field keys go to their own handlers
      fire('keydown', { key: 'ArrowDown', target: target({}, 'find', 'input'), preventDefault() {} });
      A.startNew();
      fire('focusin', { target: target({}, 'f-spouse', 'input') });
      fire('keydown', { key: 'x', target: target({}, 'f-spouse', 'input'), preventDefault() {} });
      fire('focusout', { target: target({}, 'f-spouse', 'input') });
      let kept = false;
      fire('mousedown', { target: { closest: (sel) => (sel === '#f-spouseList' ? {} : null) }, preventDefault() { kept = true; } });
      assert.ok(kept, 'a click in the spouse list keeps the cursor in the field');
      fire('dblclick', { target: target() });
      key('Escape');
      assert.equal(S.edit, null);
      // Trees: new tree and rename forms
      const before = S.trees.size;
      el('newTreeName').value = 'Second';
      let prevented = false;
      fire('submit', { target: target({}, 'newTreeForm', 'form'), preventDefault() { prevented = true; } });
      await settle();
      assert.ok(prevented);
      assert.equal(S.trees.size, before + 1);
      el('renameInput').value = 'Renamed';
      fire('submit', { target: Object.assign(target({ id: S.tree }, 'renameForm', 'form')), preventDefault() {} });
      await settle();
      assert.equal(S.trees.get(S.tree).name, 'Renamed');
    } finally {
      globalThis.setTimeout = realTimeout;
    }
  });
});
