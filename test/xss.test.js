/**
 * Text typed or imported (GEDCOM, backup, GitHub repository) never becomes HTML: a name, a note
 * or a place holding markup is shown as text in every view, never run.
 */
import assert from 'node:assert/strict';
import { test, describe, before } from 'node:test';
import { S } from '../js/state.js';
import { renderAll, afterData } from '../js/ui/render.js';
import { openPersonDlg, closePersonDlg } from '../js/ui/person-dlg.js';
import { openMedia, closeMedia } from '../js/ui/media.js';
import { renderHeader } from '../js/ui/header.js';
import { resetHistory } from '../js/services/history.js';
import { loadTree, resetApp, html } from './helpers.js';

const X = '"><img src=x onerror=alert(1)>';
const evil = (s) => s + X;

/** True if the payload reached the page as markup rather than as text. */
const injected = (h) => h.includes('<img src=x') || /" ?onerror=/.test(h);

const PIC = 'data:image/jpeg;base64,/9j/';

before(() => {
  resetApp();
  resetHistory();
  const fields = (given) => ({
    given: evil(given), surname: evil('Durand'), maidenName: evil('Faure'), sex: 'M',
    birthDate: evil('1900'), birthPlace: evil('Lyon (69)'), deathDate: evil('1970'), deathPlace: evil('Paris (75)'),
    deceased: true, occupation: evil('Forgeron'), notes: evil('Note'), situation: 'married', situationDate: evil('1925'),
    events: [{ id: 'e1', type: 'other', label: evil('Fête'), date: evil('1930'), place: evil('Nice'), note: evil('n') }],
    sources: [{ id: 's1', fact: 'birth', kind: 'birth', title: evil('Acte'), place: evil('Lyon'), ref: evil('n°1'), note: evil('n') }],
    media: [{ id: 'm1', photo: PIC, title: evil('Photo'), date: evil('1950'), note: evil('Légende'), tags: [{ id: 'b', x: 10, y: 10 }] }],
  });
  loadTree(
    [
      { id: 'a', ...fields('Jean') },
      { id: 'b', ...fields('Marie'), sex: 'F' },
      { id: 'c', ...fields('Paul'), fatherId: 'a', motherId: 'b' },
    ],
    [{ id: 'u1', a: 'a', b: 'b', type: 'married', date: evil('1925'), place: evil('Lyon (69)') }],
  );
  S.trees = new Map([['principal', { name: evil('Mon arbre'), createdAt: 0, count: 3 }]]);
  S.focus = 'c';
  afterData();
});

describe('aucune injection de HTML', () => {
  test('arbre, en-tête, fiche et registre', () => {
    for (const [full, fan] of [[false, false], [true, false], [false, true]]) {
      Object.assign(S, { full, fan, tab: 'record' });
      renderAll();
      renderHeader();
      for (const id of ['tree', 'paneRecord', 'treeName']) assert.ok(!injected(html(id)), `${id} (full=${full}, fan=${fan})`);
    }
    S.tab = 'register';
    renderAll();
    assert.ok(!injected(html('paneRegister')), 'registre');
  });

  test('chaque vue de l’onglet Analyse', () => {
    S.tab = 'analysis';
    Object.assign(S, { kinA: 'a', kinB: 'c', kinShow: true });
    for (const view of ['kin', 'checks', 'places', 'dups', 'insee', 'stats', 'cal', 'time', 'map', 'gallery']) {
      S.analysis = view;
      renderAll();
      assert.ok(!injected(html('paneAnalysis')), view);
    }
  });

  test('fiche en fenêtre et visionneuse de la galerie', () => {
    for (const id of ['a', 'b', 'c']) {
      openPersonDlg(id);
      assert.ok(!injected(html('personCard')), id);
      closePersonDlg();
    }
    S.tab = 'record';
    S.focus = 'a';
    renderAll();
    openMedia('a', 'm1');
    assert.ok(!injected(document.body.innerHTML + html('mediaDlg')), 'visionneuse');
    closeMedia();
  });
});
