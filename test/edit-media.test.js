import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { S } from '../js/state.js';
import * as A from '../js/actions.js';
import { closeCrop } from '../js/ui/crop.js';
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
