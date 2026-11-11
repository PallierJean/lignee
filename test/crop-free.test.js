import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampRect, dragRect, cropTags, stageSize } from '../js/ui/crop-free.js';

test('recadrage libre : le cadre reste dans l’image, assez grand', () => {
  assert.deepEqual(clampRect({ x: -0.2, y: 0.9, w: 0.5, h: 0.5 }), { x: 0, y: 0.5, w: 0.5, h: 0.5 });
  assert.deepEqual(clampRect({ x: 0, y: 0, w: 0.01, h: 2 }), { x: 0, y: 0, w: 0.05, h: 1 });
});

test('recadrage libre : déplacer le cadre, tirer ses coins', () => {
  const full = { x: 0, y: 0, w: 1, h: 1 };
  const r = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 100) / 100]));
  assert.deepEqual(r(dragRect(full, 'nw', 0.1, 0.2)), { x: 0.1, y: 0.2, w: 0.9, h: 0.8 }, 'coin haut gauche');
  assert.deepEqual(r(dragRect(full, 'se', -0.3, -0.1)), { x: 0, y: 0, w: 0.7, h: 0.9 }, 'coin bas droit');
  assert.deepEqual(r(dragRect({ x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, 'move', 0.5, 0)), { x: 0.5, y: 0.2, w: 0.5, h: 0.5 }, 'déplacé, sans sortir');
  assert.ok(dragRect(full, 'nw', 2, 2).w >= 0.05, 'jamais plus petit que 5 %');
});

test('recadrage libre : les personnes identifiées gardent leur place, celles hors cadre partent', () => {
  const tags = [{ id: 'a', x: 50, y: 50 }, { id: 'b', x: 10, y: 10 }];
  assert.deepEqual(cropTags(tags, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 }), [{ id: 'a', x: 50, y: 50 }]);
  assert.deepEqual(cropTags(tags, { x: 0, y: 0, w: 0.5, h: 1 }), [{ id: 'a', x: 100, y: 50 }, { id: 'b', x: 20, y: 10 }]);
});

test('recadrage libre : la zone a la taille exacte de l’image affichée, quelle que soit sa forme', () => {
  const room = { w: 700, h: 500 };
  assert.deepEqual(stageSize({ w: 3000, h: 4000 }, room), { w: 375, h: 500 }, 'en hauteur : réduite par la hauteur');
  assert.deepEqual(stageSize({ w: 4000, h: 2000 }, room), { w: 700, h: 350 }, 'en largeur : réduite par la largeur');
  assert.deepEqual(stageSize({ w: 300, h: 200 }, room), { w: 300, h: 200 }, 'petite : jamais agrandie');
});
