import assert from 'node:assert/strict';
import { test, describe, beforeEach } from 'node:test';
import { fire, FakeElement } from './setup.js';
import { S } from '../js/state.js';
import * as A from '../js/actions.js';
import { bindEvents } from '../js/events.js';
import { afterData } from '../js/ui/render.js';
import { currentSituation } from '../js/model/people.js';
import { renderTree } from '../js/tree/render.js';
import { CW } from '../js/config.js';
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
    && Object.assign(el('u-type-' + i), { value: u.type || '' }) && Object.assign(el('u-end-' + i), { value: u.end || '' }) && Object.assign(el('u-enddate-' + i), { value: u.endDate || '' }));
  S.edit.events.forEach((x, i) => {
    for (const [k, id] of [['type', 'ev-type-'], ['date', 'ev-date-'], ['place', 'ev-place-'], ['note', 'ev-note-']]) el(id + i).value = x[k];
  });
  S.edit.sources.forEach((x, i) => {
    for (const [k, id] of [['kind', 'src-kind-'], ['fact', 'src-fact-'], ['title', 'src-title-'], ['place', 'src-place-'], ['ref', 'src-ref-'], ['note', 'src-note-']]) el(id + i).value = x[k];
  });
  S.edit.media.forEach((x, i) => {
    for (const [k, id] of [['title', 'med-title-'], ['date', 'med-date-'], ['note', 'med-note-']]) el(id + i).value = x[k];
  });
}

describe('navigation et affichage', () => {
  beforeEach(openExample);

  test('changer de personne, d’onglet, de niveaux, de zoom', () => {
    const michel = ex.people.find((p) => p.given === 'Michel').id;
    A.setFocus(michel, true);
    assert.equal(S.focus, michel);
    A.setFocus('absent');
    assert.equal(S.focus, michel);
    A.setTab('registre');
    assert.equal(el('paneRegistre').hidden, false);
    A.setGenerations('up', 7);
    assert.equal(S.up, 7);
    const zoom = S.zoom;
    A.zoomBy(1);
    assert.ok(S.zoom > zoom);
    A.recenter();
  });

  test('recentrer : la personne centrale, même au bord de l’arbre ; la roue aussi', () => {
    const canvas = el('canvas');
    const moves = [];
    canvas.scrollTo = (x) => moves.push(x);
    S.fan = false;
    renderTree();
    assert.equal(el('sizer').style.margin, `${canvas.clientHeight / 2}px ${canvas.clientWidth / 2}px`);
    const n = S.lastLayout.nodes.find((x) => x.focus);
    A.recenter();
    assert.equal(moves[0].left, (n.x + CW / 2) * S.zoom);
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
    A.toggleLang();
    assert.equal(el('btnLang').textContent, 'FR');
    A.toggleLang();
  });

  test('parenté : ouverture, choix, surlignage, retour à la vue d’avant', () => {
    A.openKin(camille);
    assert.equal(S.tab, 'analyse');
    A.setKin('kinB', ex.people.find((p) => p.given === 'Michel').id);
    A.showKin();
    assert.deepEqual([S.kinShow, S.full], [true, true]);
    assert.ok(html('edges').includes('class="kin"'));
    A.hideKin();
    assert.deepEqual([S.kinShow, S.full], [false, false]);
  });

  test('frise et éphémérides', () => {
    A.setAnalyseView('time');
    A.setTimeScope(true);
    assert.equal(S.timeFamily, true);
    S.calMonth = 12;
    A.shiftMonth(1);
    assert.equal(S.calMonth, 1);
    A.shiftMonth(-1);
    assert.equal(S.calMonth, 12);
  });

  test('pendant une saisie, on ne change pas de personne', () => {
    A.startEdit(camille);
    A.setFocus(ex.people.find((p) => p.given === 'Michel').id);
    assert.equal(S.focus, camille);
    assert.match(el('toast').textContent, /Enregistrez ou annulez/);
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
    assert.ok(html('paneFiche').includes('Nouvelle personne'));
    fill({ 'f-given': 'Lou', 'f-surname': 'Noir', 'f-bdate': '1990' });
    await A.submitEdit();
    assert.equal(S.people.size, ex.people.length + 1);
    assert.equal(S.people.get(S.focus).given, 'Lou');
    await A.undo();
    assert.equal(S.people.size, ex.people.length);
    await A.redo();
    assert.equal(S.people.size, ex.people.length + 1);
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
    assert.equal(S.unions.get('u').type, 'married');
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
      assert.equal(S.people.get('b').situation, '');
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
    assert.ok(html('paneFiche').includes('data-act="delete-yes"'));
    await A.doDelete(michel);
    assert.ok(!S.people.has(michel));
    assert.equal(S.people.get(camille).fatherId, null);
    await A.undo();
    assert.equal(S.people.get(camille).fatherId, michel);
    await A.doDelete('absent');
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
    assert.ok(S.dupIgnored.has('a|b'));
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
    for (const id of ['transfer', 'printDlg', 'treesDlg', 'personDlg', 'mediaDlg', 'photoZoom']) el(id).hidden = true;
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

  test('chaque bouton lance son action', async () => {
    click({ act: 'tab', tab: 'registre' });
    assert.equal(S.tab, 'registre');
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
    click({ act: 'analyse-view', view: 'cal' });
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
});
