import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { pageRule } from '../js/config.js';
import { tileGrid, bestGrid, autoGrid, sheetCode, neighbours, OVERLAP } from '../js/tree/tiles.js';

test('format de page en millimètres : le mot-clé A2 est ignoré par Chrome', () => {
  assert.equal(pageRule(594, 420, 10), '@page { size: 594mm 420mm; margin: 10mm; }');
});

describe('découpage sur plusieurs feuilles', () => {
  test('tout le dessin est couvert, feuilles voisines recouvertes de 10 mm', () => {
    const W = 6752;
    const H = 1354;
    const g = tileGrid(W, H, 297, 210, 10, 4);
    assert.equal(g.cols, 4);
    assert.equal(g.total, g.cols * g.rows);
    assert.equal(g.tiles.length, g.total);
    const last = g.tiles[g.tiles.length - 1];
    assert.ok(last.x + g.w / g.mm >= W - 1e-6, 'largeur couverte');
    assert.ok(last.y + g.h / g.mm >= H - 1e-6, 'hauteur couverte');
    const covered = g.tiles[0].x + g.w / g.mm - g.tiles[1].x;
    assert.ok(Math.abs(covered * g.mm - OVERLAP) < 1e-6);
  });

  test('repères d’assemblage : code et feuilles voisines', () => {
    assert.equal(sheetCode(0, 0), 'A1');
    assert.equal(sheetCode(1, 2), 'B3');
    const g = { cols: 3, rows: 2 };
    assert.deepEqual(neighbours(g, { row: 0, col: 0 }), { left: '', right: 'A2', up: '', down: 'B1' });
    assert.deepEqual(neighbours(g, { row: 1, col: 2 }), { left: 'B2', right: '', up: 'A3', down: '' });
  });

  test('petit dessin : pas d’agrandissement démesuré ni de feuilles vides', () => {
    const g = tileGrid(500, 300, 297, 210, 10, 8);
    assert.equal(g.total, 1);
    assert.ok(g.mm <= 0.43);
  });

  test('découpage automatique : selon le dessin et le format, jamais moins lisible que visé', () => {
    const target = 2.5 / 14;
    const wide = autoGrid(6752, 1354, [210, 297], 10, 'auto', target);
    assert.ok(wide.mm >= target);
    assert.ok(wide.total > autoGrid(6752, 1354, [297, 420], 10, 'auto', target).total, 'moins de feuilles en A3');
    assert.equal(wide.orient, 'landscape');
    assert.equal(autoGrid(800, 400, [297, 420], 10, 'auto', target), null, 'une feuille suffit');
    const tall = autoGrid(900, 9000, [210, 297], 10, 'auto', target);
    assert.equal(tall.orient, 'portrait');
    assert.ok(tall.total > 1);
    const smaller = tileGrid(6752, 1354, wide.pageW, wide.pageH, 10, wide.cols - 1);
    assert.ok(smaller.mm < target, 'une colonne de moins serait trop petit');
  });

  test('orientation automatique : celle de la forme du dessin', () => {
    assert.equal(bestGrid(1000, 6000, [210, 297], 10, 2, 'auto').orient, 'portrait');
    assert.equal(bestGrid(6000, 1000, [210, 297], 10, 2, 'auto').orient, 'landscape');
    assert.equal(bestGrid(6000, 1000, [210, 297], 10, 2, 'portrait').orient, 'portrait');
  });
});
