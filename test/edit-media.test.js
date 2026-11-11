import assert from 'node:assert/strict';
import { sourcesOf } from '../js/model/sources.js';
import { test, beforeEach, afterEach } from 'node:test';
import { S } from '../js/state.js';
import * as A from '../js/actions.js';
import { closeCrop } from '../js/ui/crop.js';
import { closeCropFree, cropFreeOpen } from '../js/ui/crop-free.js';
import { loadTree, person, resetApp } from './helpers.js';

const realCreate = document.createElement;
const realImage = globalThis.Image;
const realSet = localStorage.setItem;
const toastText = () => document.getElementById('toast').textContent;
const tick = () => new Promise((r) => setImmediate(r));

/** Images the browser can read; `decode` decides when (and whether) each one is read. */
function fakeImages(decode = async () => {}) {
  globalThis.URL.createObjectURL = () => 'blob:x';
  globalThis.URL.revokeObjectURL = () => {};
  globalThis.Image = class {
    naturalWidth = 400;
    naturalHeight = 300;
    decode = decode;
  };
  document.createElement = (tag) => {
    const el = realCreate(tag);
    el.getContext = () => ({ fillRect() {}, drawImage() {} });
    el.toDataURL = () => 'data:image/jpeg;base64,IMG';
    return el;
  };
}

const png = (name = 'acte.png') => ({ type: 'image/png', name });
const text = { type: 'text/plain', name: 'notes.txt' };

beforeEach(() => {
  resetApp();
  loadTree([person('a', { given: 'Anne', surname: 'Roux' }), person('b', { given: 'Paul', surname: 'Roux', fatherId: 'a', example: true })]);
  S.focus = 'a';
  A.startEdit('a');
  document.getElementById('cropStage').getBoundingClientRect = () => ({ left: 0, top: 0 });
  for (const id of ['leaveDlg', 'cropDlg']) document.getElementById(id).hidden = true;
  fakeImages();
});

afterEach(() => {
  document.createElement = realCreate;
  globalThis.Image = realImage;
  localStorage.setItem = realSet;
  S.edit = null;
});

test('gallery: a refused file is reported, the others are added', async () => {
  await A.addDraftMedia([text, png('mariage.png')]);
  assert.match(toastText(), /image/i);
  assert.deepEqual(S.edit.media.map((m) => m.title), ['mariage']);
  assert.equal(S.edit.media[0].photo, 'data:image/jpeg;base64,IMG');
});

test('gallery: once saved, the viewer opens on the new images to identify the people', async () => {
  const { closeMedia } = await import('../js/ui/media.js');
  document.getElementById('mediaDlg').hidden = true;
  /** The form's name fields, as the page would hold them. */
  const named = () => {
    document.getElementById('f-given').value = 'Anne';
    document.getElementById('f-surname').value = 'Roux';
  };
  await A.addDraftMedia([png('noce.png'), png('bapteme.png')]);
  named();
  await A.submitEdit();
  assert.equal(document.getElementById('mediaDlg').hidden, false, 'the viewer opens');
  const card = document.getElementById('mediaCard').innerHTML;
  assert.match(card, /<img src="data:image\/jpeg;base64,IMG"/);
  assert.match(card, /<span class="n">1 \/ 2<\/span>/, 'only the new images');
  assert.match(card, /cliquez sur son visage/, 'ready to identify');
  closeMedia();
  // Saved again with no new image: the viewer stays closed
  A.startEdit('a');
  named();
  await A.submitEdit();
  assert.equal(S.edit, null, 'saved');
  assert.equal(document.getElementById('mediaDlg').hidden, true);
});

test('gallery: the back of an image is added, changed, saved and removed', async () => {
  // A single image: the crop opens, and is confirmed as it is
  const adding = A.addDraftMedia([png('contrat.png')]);
  for (let i = 0; i < 50 && !cropFreeOpen(); i++) await tick();
  assert.ok(cropFreeOpen(), 'recadrage proposé');
  closeCropFree(true);
  await adding;
  assert.match(document.getElementById('paneRecord').innerHTML, /data-med-back="0">Ajouter le verso/);
  await A.setDraftMediaBack(0, text);
  assert.equal(S.edit.media[0].back, '', 'not an image: refused');
  assert.match(toastText(), /image/i);
  await A.setDraftMediaBack(0, png('verso.png'));
  assert.equal(S.edit.media[0].back, 'data:image/jpeg;base64,IMG');
  assert.match(document.getElementById('paneRecord').innerHTML, /Changer le verso.*Retirer le verso/s);
  await A.setDraftMediaBack(5, png()); // no such image: nothing
  document.getElementById('f-given').value = 'Anne';
  document.getElementById('f-surname').value = 'Roux';
  await A.submitEdit();
  assert.equal(S.people.get('a').media[0].back, 'data:image/jpeg;base64,IMG', 'saved with its front');
  A.startEdit('a');
  assert.equal(S.edit.media[0].back, 'data:image/jpeg;base64,IMG', 'back in the form again');
  A.removeDraftMediaBack(0);
  assert.equal(S.edit.media[0].back, '');
  document.getElementById('f-given').value = 'Anne';
  document.getElementById('f-surname').value = 'Roux';
  await A.submitEdit();
  assert.equal('back' in S.people.get('a').media[0], false, 'removed');
  A.removeDraftMediaBack(0); // no form: nothing
});

test('source document: a back, like the second side of a marriage contract', async () => {
  const { sourcesHTML } = await import('../js/ui/record.js');
  A.addDraftSource();
  assert.doesNotMatch(document.getElementById('paneRecord').innerHTML, /data-src-back/, 'no back without a front');
  await A.setDraftSourcePhoto(0, png('contrat-recto.png'));
  assert.match(document.getElementById('paneRecord').innerHTML, /data-src-back="0">Ajouter le verso/);
  await A.setDraftSourceBack(0, text);
  assert.equal(S.edit.sources[0].back, undefined, 'not an image: refused');
  await A.setDraftSourceBack(0, png('contrat-verso.png'));
  assert.equal(S.edit.sources[0].back, 'data:image/jpeg;base64,IMG');
  await A.setDraftSourceBack(7, png()); // no such source: nothing
  for (const [id, v] of [['f-given', 'Anne'], ['f-surname', 'Roux'], ['src-title-0', 'Contrat de mariage']]) document.getElementById(id).value = v;
  await A.submitEdit();
  const saved = sourcesOf(S.people.get('a'))[0];
  assert.equal(saved.back, 'data:image/jpeg;base64,IMG', 'saved with its front');
  const shown = sourcesHTML('a');
  assert.equal((shown.match(/class="src-doc zoomable"/g) || []).length, 2, 'front and back side by side');
  assert.match(shown, /alt="[^"]* \(Verso\)"/);
  // Removing the front takes the back with it
  A.startEdit('a');
  assert.equal(S.edit.sources[0].back, 'data:image/jpeg;base64,IMG');
  A.removeDraftSourceBack(0);
  assert.equal(S.edit.sources[0].back, '');
  await A.setDraftSourceBack(0, png());
  A.removeDraftSourcePhoto(0);
  assert.equal(S.edit.sources[0].back, '', 'no back without its front');
  A.removeDraftSourceBack(3); // no such source: nothing
});

test('gallery: nothing is added once the form was closed or reopened during the load', async () => {
  let release;
  fakeImages(() => new Promise((r) => { release = r; }));
  const adding = A.addDraftMedia([png()]);
  await tick();
  S.edit.token = 'another form';
  release();
  await adding;
  assert.equal(S.edit.media.length, 0);
  S.edit = null;
  await A.addDraftMedia([png()]); // no form: nothing happens
});

test('source document: refused, added, removed, or dropped once the form changed', async () => {
  S.edit.sources = [{ title: 'Acte', photo: '' }];
  await A.setDraftSourcePhoto(0, text);
  assert.match(toastText(), /image/i);
  assert.equal(S.edit.sources[0].photo, '');

  await A.setDraftSourcePhoto(0, png());
  assert.equal(S.edit.sources[0].photo, 'data:image/jpeg;base64,IMG');
  A.removeDraftSourcePhoto(0);
  assert.equal(S.edit.sources[0].photo, '');

  let release;
  fakeImages(() => new Promise((r) => { release = r; }));
  const setting = A.setDraftSourcePhoto(0, png());
  await tick();
  S.edit.token = 'another form';
  release();
  await setting;
  assert.equal(S.edit.sources[0].photo, '');

  await A.setDraftSourcePhoto(0, null); // no file: nothing happens
  S.edit = null;
  A.removeDraftSourcePhoto(0);
  await A.setDraftSourcePhoto(0, png());
});

test('portrait: refused, cancelled, kept, or dropped once the form changed', async () => {
  const before = S.edit.draft.photo;
  await A.setDraftPhoto(text);
  assert.match(toastText(), /image/i);
  assert.equal(S.edit.draft.photo, before);

  let choosing = A.setDraftPhoto(png());
  await tick();
  closeCrop(false);
  await choosing;
  assert.equal(S.edit.draft.photo, before, 'crop cancelled');

  choosing = A.setDraftPhoto(png());
  await tick();
  S.edit.token = 'another form';
  closeCrop(true);
  await choosing;
  assert.equal(S.edit.draft.photo, before, 'form changed while cropping');

  choosing = A.setDraftPhoto(png());
  await tick();
  closeCrop(true);
  await choosing;
  assert.equal(S.edit.draft.photo, 'data:image/jpeg;base64,IMG');
});

test('deleting a record or the example family while the browser is full: nothing changes', async () => {
  S.edit = null;
  localStorage.setItem = () => { throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); };

  A.confirmDelete(true, 'a');
  await A.doDelete('a');
  assert.ok(S.people.has('a'), 'the record is still there');
  assert.equal(S.confirmDel, false);
  assert.match(toastText(), /plus de place/);

  await A.removeExamples();
  assert.ok(S.people.has('b'), 'the example family is still there');
  assert.equal(S.people.get('b').example, true);
});

test('intitulé tiré du nom du fichier, sauf un nom d’appareil', async () => {
  const { fileTitle } = await import('../js/actions/edit.js');
  assert.equal(fileTitle('mariage.jpg'), 'mariage');
  assert.equal(fileTitle('Noces d’or 1975.png'), 'Noces d’or 1975');
  for (const name of ['20260730_210013.heic', '20260730_210013.heic.jpg', 'photo.jpg', 'IMG_1234.JPG', 'DSC0042.jpg', 'PXL_20240512_101010.jpg', 'WhatsApp Image 2024-05-12 at 10.10.10.jpeg', 'Scan 3.png', '20240512_101010.jpg', 'image(2).png']) {
    assert.equal(fileTitle(name), '', name);
  }
});

test('identifier les personnes dès l’ajout, depuis le formulaire : enregistré avec la fiche', async () => {
  const media = await import('../js/ui/media.js');
  const { renderAll } = await import('../js/ui/render.js');
  const { mediaLabel } = await import('../js/model/people.js');
  S.edit.media.push({ id: 'm1', photo: 'data:image/jpeg;base64,IMG', back: '', title: '', date: '1985', note: '', tags: [], removed: false });
  renderAll(true);
  for (const [id, v] of [['med-title-0', ''], ['med-date-0', '1985'], ['med-note-0', '']]) document.getElementById(id).value = v;
  media.openDraftMedia(0);
  assert.equal(document.getElementById('mediaDlg').hidden, false);
  assert.match(document.getElementById('mediaCard').innerHTML, /enregistrés avec la fiche/);
  // Un clic sur un visage, puis la personne
  const pic = { querySelector: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }) }) };
  media.placePin(pic, { clientX: 50, clientY: 40, target: { closest: () => null } });
  await media.addTag('b');
  assert.deepEqual(S.edit.media[0].tags, [{ id: 'b', x: 25, y: 40 }]);
  assert.ok(!S.people.get('a').media, 'rien d’enregistré avant la fiche');
  media.closeMedia();
  assert.match(document.getElementById('paneRecord').innerHTML, /Paul ROUX/, 'le formulaire montre qui est identifié');
  assert.equal(mediaLabel(S.edit.media[0]), 'Paul ROUX · 1985', 'sans intitulé : les personnes et la date');
  await A.submitEdit();
  assert.deepEqual(S.people.get('a').media[0].tags, [{ id: 'b', x: 25, y: 40 }]);
});

test('ancien titre qui n’est qu’un nom de fichier : ignoré à l’affichage, champ vide à la modification', async () => {
  const { mediaLabel } = await import('../js/model/people.js');
  assert.equal(mediaLabel({ title: '20260730_210013.heic', date: '2026', tags: [] }), '2026');
  assert.equal(mediaLabel({ title: 'Noces d’or', date: '2026' }), 'Noces d’or');
});
