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

describe('crop dialog', () => {
  const realCreate = document.createElement;
  const realImage = globalThis.Image;

  function fakeImage(width, height, decode = async () => {}) {
    globalThis.URL.createObjectURL = () => 'blob:x';
    globalThis.URL.revokeObjectURL = () => {};
    globalThis.Image = class {
      naturalWidth = width;
      naturalHeight = height;
      decode = decode;
    };
    document.createElement = (tag) => {
      const el = realCreate(tag);
      el.getContext = () => ({ fillRect() {}, drawImage() {} });
      el.toDataURL = () => 'data:image/jpeg;base64,CROP';
      return el;
    };
  }
  const restore = () => {
    document.createElement = realCreate;
    globalThis.Image = realImage;
  };
  const stage = { closest: (sel) => (sel === '#cropStage' ? {} : null) };

  test('open, zoom, drag, keep or cancel; shortcuts and Escape while it is open', async () => {
    const { cropOpen, closeCrop, cropZoomInput, cropWheel, cropDrag } = await import('../js/ui/crop.js');
    const { bindEvents } = await import('../js/events.js');
    const { dialogOpen } = await import('../js/ui/dialogs.js');
    const { fire } = await import('./setup.js');
    bindEvents();
    for (const id of ['transfer', 'printDlg', 'treesDlg', 'personDlg', 'mediaDlg', 'photoZoom', 'leaveDlg']) document.getElementById(id).hidden = true;
    document.getElementById('cropStage').getBoundingClientRect = () => ({ left: 0, top: 0 });
    fakeImage(400, 300);
    try {
      const kept = cropPhoto({ type: 'image/png' });
      await new Promise((r) => setImmediate(r));
      assert.equal(cropOpen(), true);
      assert.equal(dialogOpen(), true);
      // "/" doesn't jump to the search field under the crop dialog
      const ev = { key: '/', target: { tagName: 'DIV' }, preventDefault() { ev.prevented = true; } };
      fire('keydown', ev);
      assert.notEqual(ev.prevented, true);
      cropZoomInput('2');
      let prevented = false;
      cropWheel({ target: stage, deltaY: -1, clientX: 10, clientY: 10, preventDefault() { prevented = true; } });
      assert.ok(prevented);
      cropWheel({ target: { closest: () => null }, deltaY: 1 });
      cropDrag({ type: 'pointerdown', target: stage, clientX: 0, clientY: 0 });
      cropDrag({ type: 'pointermove', clientX: -20, clientY: -10 });
      cropDrag({ type: 'pointerup' });
      cropDrag({ type: 'pointermove', clientX: 5, clientY: 5 });
      closeCrop(true);
      assert.equal(await kept, 'data:image/jpeg;base64,CROP');
      assert.equal(cropOpen(), false);

      // Escape cancels
      const cancelled = cropPhoto({ type: 'image/jpeg' });
      await new Promise((r) => setImmediate(r));
      fire('keydown', { key: 'Escape', target: { tagName: 'DIV' }, preventDefault() {} });
      assert.equal(await cancelled, null);
      closeCrop(false); // already closed: nothing happens

      // Unreadable image
      fakeImage(1, 1, async () => { throw new Error('bad'); });
      await assert.rejects(cropPhoto({ type: 'image/png' }), /lue|read/i);
    } finally {
      restore();
    }
  });
});
