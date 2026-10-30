import assert from 'node:assert/strict';
import { test } from 'node:test';
import { photoFromFile, DOCUMENT_SIDE } from '../js/utils/image.js';

let canvas;
const realCreate = document.createElement;

function fakeBrowser(width, height, decode = async () => {}) {
  globalThis.URL.createObjectURL = () => 'blob:x';
  globalThis.URL.revokeObjectURL = () => {};
  globalThis.Image = class {
    naturalWidth = width;
    naturalHeight = height;
    decode = decode;
  };
  document.createElement = (tag) => {
    canvas = realCreate(tag);
    canvas.toDataURL = () => 'data:image/jpeg;base64,AAAA';
    return canvas;
  };
}

test('une photo est réduite, sans jamais être agrandie', async () => {
  fakeBrowser(3200, 1600);
  assert.equal(await photoFromFile({ type: 'image/png' }), 'data:image/jpeg;base64,AAAA');
  assert.deepEqual([canvas.width, canvas.height], [320, 160]);
  await photoFromFile({ type: 'image/png' }, DOCUMENT_SIDE);
  assert.deepEqual([canvas.width, canvas.height], [1400, 700]);
  fakeBrowser(100, 50);
  await photoFromFile({ type: 'image/jpeg' });
  assert.deepEqual([canvas.width, canvas.height], [100, 50]);
});

test('fichier refusé : pas une image, image illisible', async () => {
  await assert.rejects(photoFromFile({ type: 'text/plain' }), /pas une image/);
  await assert.rejects(photoFromFile(null), /pas une image/);
  fakeBrowser(10, 10, async () => { throw new Error('non'); });
  await assert.rejects(photoFromFile({ type: 'image/png' }), /pu être lue/);
});
