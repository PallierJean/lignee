import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { S } from '../js/state.js';
import { CW, CH } from '../js/config.js';
import { buildLayout } from '../js/tree/layout.js';
import { buildFullLayout } from '../js/tree/full-layout.js';
import { example, loadTree, person } from './helpers.js';

const ex = example();
const cards = (layout) => layout.nodes.filter((n) => n.t === 'p');

/** Deux fiches d'une même ligne ne se chevauchent pas. */
function assertNoOverlap(nodes) {
  const rows = Map.groupBy(nodes, (n) => n.y);
  for (const [y, row] of rows) {
    row.sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i++) {
      assert.ok(row[i].x - row[i - 1].x >= CW, `chevauchement sur la ligne y=${y} : ${row[i - 1].id || row[i - 1].key} / ${row[i].id || row[i].key}`);
    }
  }
}

beforeEach(() => {
  S.up = 3;
  S.down = 2;
  S.canWrite = true;
  S.full = false;
});

describe('vue centrée sur une personne', () => {
  test('numéros Sosa : personne centrale 1, père 2n, mère 2n + 1', () => {
    loadTree(ex.people, ex.unions);
    S.focus = 'p_ex_13';
    const sosa = new Map(cards(buildLayout()).filter((n) => n.sosa).map((n) => [n.id, n.sosa]));
    assert.equal(sosa.get('p_ex_13'), 1);
    assert.equal(sosa.get('p_ex_09'), 2);
    assert.equal(sosa.get('p_ex_10'), 3);
    assert.equal(sosa.get('p_ex_05'), 4);
    assert.equal(sosa.get('p_ex_06'), 5);
    assert.equal(sosa.get('p_ex_01'), 8);
    assert.equal(sosa.get('p_ex_04'), 11);
    for (const [id, n] of sosa) {
      const p = S.people.get(id);
      if (sosa.has(p.fatherId)) assert.equal(sosa.get(p.fatherId), 2 * n);
      if (sosa.has(p.motherId)) assert.equal(sosa.get(p.motherId), 2 * n + 1);
    }
  });

  test('ascendants au-dessus, descendants en dessous, sans chevauchement', () => {
    loadTree(ex.people, ex.unions);
    S.focus = 'p_ex_09';
    const layout = buildLayout();
    const y = new Map(cards(layout).map((n) => [n.id, n.y]));
    assert.ok(y.get('p_ex_05') < y.get('p_ex_09'));
    assert.ok(y.get('p_ex_12') > y.get('p_ex_09'));
    assert.equal(y.get('p_ex_10'), y.get('p_ex_09'), 'conjointe sur la même ligne');
    assertNoOverlap(layout.nodes);
    for (const n of layout.nodes) assert.ok(n.x >= 0 && n.x + CW <= layout.W && n.y + CH <= layout.H, 'dans la toile');
  });

  test('profondeur limitée par S.up', () => {
    loadTree(ex.people, ex.unions);
    S.focus = 'p_ex_13';
    S.up = 1;
    const ids = cards(buildLayout()).map((n) => n.id);
    assert.ok(ids.includes('p_ex_09'));
    assert.ok(!ids.includes('p_ex_05'));
  });

  test('emplacements vides seulement en écriture', () => {
    loadTree([person('solo', { given: 'Seul' })]);
    S.focus = 'solo';
    assert.ok(buildLayout().nodes.some((n) => n.t === 'ph' && n.rel === 'father'));
    S.canWrite = false;
    assert.ok(!buildLayout().nodes.some((n) => n.t === 'ph'));
  });

  test('null sans personne centrale connue', () => {
    loadTree(ex.people, ex.unions);
    S.focus = 'absent';
    assert.equal(buildLayout(), null);
  });
});

describe('arbre complet', () => {
  test('chaque personne une fois, enfants sous leurs parents, sans chevauchement', () => {
    loadTree(ex.people, ex.unions);
    S.focus = 'p_ex_13';
    const layout = buildFullLayout();
    const nodes = cards(layout);
    assert.equal(nodes.length, ex.people.length);
    assert.equal(new Set(nodes.map((n) => n.id)).size, ex.people.length);
    const y = new Map(nodes.map((n) => [n.id, n.y]));
    for (const p of ex.people) {
      for (const parent of [p.fatherId, p.motherId].filter(Boolean)) assert.ok(y.get(parent) < y.get(p.id), `${p.id} sous ${parent}`);
    }
    assertNoOverlap(nodes);
  });

  test('familles sans lien posées côte à côte', () => {
    loadTree([...ex.people, person('a', { given: 'A' }), person('b', { given: 'B', fatherId: 'a' })], ex.unions);
    S.focus = 'p_ex_13';
    const nodes = cards(buildFullLayout());
    assert.equal(nodes.length, ex.people.length + 2);
    assertNoOverlap(nodes);
  });

  test('null pour un arbre vide', () => {
    loadTree([]);
    assert.equal(buildFullLayout(), null);
  });
});

describe('sept générations d’ascendants', () => {
  test('arbre complet : tous les numéros Sosa, aucun chevauchement', () => {
    const people = [];
    for (let n = 1; n < 2 ** 8; n++) {
      const parents = 2 * n < 2 ** 8 ? { fatherId: 'p' + 2 * n, motherId: 'p' + (2 * n + 1) } : {};
      people.push(person('p' + n, { sex: n % 2 ? 'F' : 'M', ...parents }));
    }
    loadTree(people);
    S.focus = 'p1';
    S.up = 7;
    const nodes = cards(buildLayout());
    assert.deepEqual(nodes.map((n) => n.sosa).filter(Boolean).sort((a, b) => a - b), [...Array(255)].map((_, i) => i + 1));
    assertNoOverlap(nodes);
  });
});
