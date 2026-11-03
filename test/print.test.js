import assert from 'node:assert/strict';
import { test, describe, beforeEach, afterEach } from 'node:test';
import { S } from '../js/state.js';
import { openPrint, closePrint, printTree, printFamilyBook, updatePrintInfo } from '../js/ui/print.js';
import { afterData } from '../js/ui/render.js';
import { example, loadTree, person, resetApp, html } from './helpers.js';

const el = (id) => document.getElementById(id);
const ex = example();
const camille = ex.people.find((p) => p.given === 'Camille').id;
let printed = [];

const open = (content, format = 'A3', tiles = 'auto', orient = 'auto') => {
  Object.assign(el('prContent'), { value: content });
  Object.assign(el('prFormat'), { value: format });
  Object.assign(el('prOrient'), { value: orient });
  Object.assign(el('prTiles'), { value: tiles });
  openPrint();
  el('prTiles').value = tiles;
  updatePrintInfo();
};
const go = async () => {
  await printTree();
  window.dispatchAfterPrint();
};

/** Un arbre large : deux lignées, beaucoup de frères et sœurs. */
function wide() {
  const people = [person('a', { given: 'Ana' }), person('b', { given: 'Bob' })];
  for (let i = 0; i < 50; i++) people.push(person('k' + i, { given: 'K' + i, fatherId: 'a', motherId: 'b' }));
  loadTree(people);
  S.focus = 'a';
}

describe('impression', () => {
  let after = [];
  beforeEach(() => {
    resetApp();
    loadTree(ex.people, ex.unions);
    S.focus = camille;
    afterData();
    printed = [];
    after = [];
    window.print = () => printed.push(document.title);
    window.addEventListener = (type, fn) => after.push(fn);
    window.dispatchAfterPrint = () => {};
  });
  afterEach(() => { delete window.addEventListener; });

  test('titre calculé d’après les parents, qui suit le contenu choisi', () => {
    open('tree');
    assert.equal(el('prTitleText').value, 'Arbre de la famille BERTRAND – MOREL');
    el('prContent').value = 'book';
    updatePrintInfo();
    assert.equal(el('prTitleText').value, 'Famille BERTRAND – MOREL');
    assert.equal(el('prPaper').hidden, true);
    closePrint();
    assert.equal(el('printDlg').hidden, true);
  });

  test('titre saisi : conservé', async () => {
    open('tree', 'A2', '1');
    el('prTitleText').value = 'Mon titre';
    await printTree();
    assert.ok(html('printArea').includes('Mon titre'));
    assert.equal(printed[0], 'Mon titre');
    open('tree');
    assert.equal(el('prTitleText').value, 'Mon titre');
    el('prTitleText').value = '';
  });

  test('arbre sur une feuille : format en millimètres', async () => {
    open('tree', 'A2', '1');
    await printTree();
    assert.match(el('printPageStyle').textContent, /size: 594mm 420mm/);
    assert.ok(html('printArea').includes('print-tree'));
  });

  test('découpage : plan d’assemblage, codes, zones de collage', async () => {
    wide();
    open('tree', 'A4', '4');
    assert.match(el('printInfo').textContent, /feuille/);
    await printTree();
    const out = html('printArea');
    assert.ok(out.includes('Plan d’assemblage'));
    assert.ok(out.includes('tile-map'));
    assert.ok(out.includes('Coller A2 ici'));
    assert.match(el('printPageStyle').textContent, /297mm 210mm/);
  });

  test('découpage automatique, orientation imposée', () => {
    wide();
    open('tree', 'A4', 'auto', 'portrait');
    assert.match(el('printInfo').textContent, /portrait/);
    open('tree', 'A2', 'auto');
    assert.ok(el('printInfo').textContent);
  });

  test('avertissement si le texte est très petit sur une feuille', () => {
    wide();
    open('tree', 'A3', '1');
    assert.match(el('printInfo').textContent, /très petit/);
    open('tree', 'A2', '1');
    assert.match(el('printInfo').textContent, /très petit/);
  });

  test('formats A1 et A0 ; le message propose le plus petit format lisible', async () => {
    const people = [person('a'), person('b')];
    for (let i = 0; i < 30; i++) people.push(person('k' + i, { fatherId: 'a', motherId: 'b' }));
    loadTree(people);
    S.focus = 'a';
    const suggested = (format) => {
      open('tree', format, '1');
      return /format (A\d)/.exec(el('printInfo').textContent)?.[1];
    };
    assert.deepEqual(['A3', 'A2', 'A1', 'A0'].map(suggested), ['A1', 'A1', undefined, undefined]);
    assert.doesNotMatch(el('printInfo').textContent, /très petit/);
    for (const [format, size] of [['A1', /841mm 594mm/], ['A0', /1189mm 841mm/]]) {
      open('tree', format, '1', 'landscape');
      await go();
      assert.match(el('printPageStyle').textContent, size);
    }
  });

  test('plus grand que A0 : pas de format à proposer', () => {
    const people = [person('a'), person('b')];
    for (let i = 0; i < 200; i++) people.push(person('k' + i, { fatherId: 'a', motherId: 'b' }));
    loadTree(people);
    S.focus = 'a';
    open('tree', 'A0', '1');
    assert.match(el('printInfo').textContent, /grand pour une seule feuille/);
  });

  test('Firefox : pas de taille imposée, le dessin suit le papier ; sa largeur ne dépasse jamais la feuille', async () => {
    const agent = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 Firefox/158.0', configurable: true });
    try {
      open('tree', 'A1', '1');
      await go();
      assert.equal(el('printPageStyle').textContent, '@page { margin: 10mm; }');
      assert.match(el('printArea').style.width, /^min\(.*100%\)$/);
      open('tree', 'A1', 'auto');
      await go();
      assert.equal(el('printPageStyle').textContent, '@page { margin: 10mm; }');
    } finally {
      if (agent) Object.defineProperty(navigator, 'userAgent', agent);
      else delete navigator.userAgent;
    }
    open('tree', 'A1', '1');
    await go();
    assert.match(el('printPageStyle').textContent, /size: \d+mm \d+mm/);
  });

  test('roue d’ascendance, sur une ou plusieurs feuilles', async () => {
    open('fan', 'A3', '1');
    assert.match(el('printInfo').textContent, /génération/);
    await printTree();
    assert.ok(html('printArea').includes('fan-s'));
    open('fan', 'A4', '3');
    assert.match(el('printInfo').textContent, /feuille/);
    await printTree();
    assert.ok(html('printArea').includes('Coller'));
  });

  test('livret de l’arbre : couverture, sommaire, chapitres', async () => {
    open('book');
    assert.match(el('printInfo').textContent, /16 personnes/);
    await printTree();
    const out = html('printArea');
    assert.ok(out.includes('Livret de famille'));
    assert.ok(out.includes('Sommaire'));
    assert.ok(out.includes('Génération 1'));
    assert.ok(out.includes('bk-fan'));
    assert.match(el('printPageStyle').textContent, /210mm 297mm; margin: 0mm/);
  });

  test('livret d’une personne', async () => {
    await printFamilyBook(ex.people.find((p) => p.given === 'Michel').id);
    const out = html('printArea');
    assert.ok(out.includes('Titulaire du livret'));
    assert.ok(out.includes('1er enfant'));
    assert.ok(out.includes('sans valeur officielle'));
    assert.match(printed[0], /^Livret de famille BERTRAND – MOREL/);
    for (const fn of after) fn();
    assert.equal(html('printArea'), '');
    await printFamilyBook('absent');
    assert.equal(printed.length, 1);
  });

  test('livret d’une personne seule, enfants d’un parent inconnu', async () => {
    loadTree([person('a', { given: 'Lou', surname: 'Noir', sex: 'F' }), person('c', { given: 'Max', motherId: 'a' }), person('z', { given: 'Zed' })]);
    await printFamilyBook('a');
    assert.ok(html('printArea').includes('Enfants'));
    assert.equal(printed[0], 'Livret de famille NOIR');
    await printFamilyBook('z');
    assert.equal(printed[1], 'Livret de famille Zed');
  });

  test('impression indisponible : message, feuille vidée', async () => {
    window.print = () => { throw new Error('non'); };
    open('tree', 'A2', '1');
    await printTree();
    assert.equal(html('printArea'), '');
    assert.match(el('toast').textContent, /pas disponible/);
  });

  test('arbre vide', async () => {
    loadTree([]);
    S.focus = null;
    open('tree');
    assert.match(el('printInfo').textContent, /vide/);
    await printTree();
    assert.equal(printed.length, 0);
  });
});
