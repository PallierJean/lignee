import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { FRAME, coverScale, clampView, cropRect, cropPhoto } from '../js/ui/crop.js';

describe('recadrage d’une photo de fiche', () => {
  test('le cadre portrait est toujours rempli, sans bande vide', () => {
    // Photo haute et étroite (171 × 320, comme celle d'Arthur) : la largeur commande
    const tall = coverScale(171, 320);
    assert.equal(tall, FRAME.w / 171);
    assert.ok(320 * tall >= FRAME.h);
    // Photo en paysage : la hauteur commande
    const wide = coverScale(1600, 900);
    assert.equal(wide, FRAME.h / 900);
    // Glisser trop loin : l'image revient border le cadre
    assert.deepEqual(clampView({ x: 50, y: 40, scale: tall }, 171, 320), { scale: tall, x: 0, y: 0 });
    const v = clampView({ x: -9999, y: -9999, scale: tall }, 171, 320);
    assert.equal(v.x, FRAME.w - 171 * tall);
    assert.equal(Math.round(v.y), Math.round(FRAME.h - 320 * tall));
  });

  test('partie gardée : le haut de la photo, là où est le visage', () => {
    const scale = coverScale(171, 320);
    const r = cropRect({ x: 0, y: 0, scale });
    assert.ok(r.sx === 0 && r.sy === 0, 'depuis le coin haut gauche');
    assert.equal(Math.round(r.sw), 171);
    assert.equal(Math.round(r.sh), Math.round(171 * 5 / 4), 'portrait 4:5');
    // Zoom ×2, image décalée : on garde un morceau deux fois plus petit, au bon endroit
    const z = cropRect({ x: -100, y: -60, scale: scale * 2 });
    assert.ok(Math.abs(z.sw - r.sw / 2) < 1e-9);
    assert.ok(Math.abs(z.sx - 100 / (scale * 2)) < 1e-9);
  });

  test('un fichier qui n’est pas une image est refusé', async () => {
    await assert.rejects(cropPhoto({ type: 'application/pdf' }), /image/i);
    await assert.rejects(cropPhoto(null), /image/i);
  });
});
