/**
 * "Faces to identify", from the gallery: the whole gallery seen by the local server (faces.js).
 *
 * - The same unknown face on several photos: named once, everyone of them is identified (a marker on
 *   each photo, one undoable action). A face that isn't that person is taken out first (×).
 * - People without a portrait who are on photos: their clearest face, framed in the crop tool, becomes
 *   their portrait.
 * Without the local server and OpenCV, the button doesn't show (services/faces.js).
 */
import { S } from '../state.js';
import { $, esc, setHTML } from '../utils/dom.js';
import { t } from '../i18n.js';
import { P, fullName, lifeYears, photoSrc } from '../model/people.js';
import { tagsOf, hasPlace } from '../model/media.js';
import { opUpdate, inBatch, beginAction, commitAction, storePhoto } from '../services/storage.js';
import { faceOverview, facesReady } from '../services/faces.js';
import { emit } from '../services/notify.js';
import { cropPhoto } from './crop.js';
import { searchPeople } from './search.js';
import { toast, reportError } from './toast.js';

const HITS = 8; // people listed while naming a group

let open = false;
let data = null;    // { groups, portraits } from the server; null while it looks
let failed = '';    // the server's error
const removed = new Set(); // "group|face": faces taken out of their group
const done = new Set();    // "g<group>" named or skipped, "p<id>" portrait chosen or skipped

/** The button of the gallery, when the local server can recognise faces. */
export const facesButton = () => (facesReady() && S.canWrite
  ? `<p class="gallery-tools"><button class="btn small" type="button" data-act="faces-open">${t('fc.open')}</button></p>` : '');

export const facesOpen = () => open;

export function openFaces() {
  open = true;
  data = null;
  failed = '';
  removed.clear();
  done.clear();
  $('#facesDlg').hidden = false;
  renderFaces();
  faceOverview()
    .then((o) => { data = o; })
    .catch((e) => { failed = e.message || t('fc.failed'); })
    .then(() => open && renderFaces());
}

export function closeFaces() {
  open = false;
  $('#facesDlg').hidden = true;
}

/** Faces of group `g` still in it. */
const groupFaces = (g) => (data.groups[g] ? data.groups[g].faces.filter((_, k) => !removed.has(`${g}|${k}`)) : []);

/** Gallery image showing `photo`: [id, image], or null. */
const imageOf = (photo) => [...S.media].find(([, m]) => m && m.photo === photo) || null;

/**
 * A face cut out of its photo, without a canvas: the image is enlarged so that the face (with a
 * margin) fills the box, then moved onto it (a translation in percent of the image itself).
 */
function faceThumb(f) {
  const [bx, by, bw, bh] = f.box;
  const m = 0.3;
  const x = bx - bw * m;
  const y = by - bh * m;
  const w = bw * (1 + 2 * m);
  return `<span class="face-thumb"><img src="${esc(photoSrc(f.photo))}" alt="" loading="lazy"`
    + ` data-style="width:${(100 / w).toFixed(2)}%;transform:translate(${(-x * 100).toFixed(2)}%,${(-y * 100).toFixed(2)}%)"></span>`;
}

function hitsHTML(g, query) {
  const ids = query.trim() ? searchPeople(query, HITS).ids : [];
  return ids.map((id) => {
    const years = lifeYears(P(id));
    return `<li><button type="button" data-act="fc-name" data-g="${g}" data-id="${esc(id)}">${esc(fullName(P(id)))}${years ? ` <small>${esc(years)}</small>` : ''}</button></li>`;
  }).join('');
}

function groupHTML(g) {
  const faces = data.groups[g].faces;
  const thumbs = faces.map((f, k) => (removed.has(`${g}|${k}`) ? ''
    : `<li class="fc-face">${faceThumb(f)}<button class="fc-drop" type="button" data-act="fc-drop" data-g="${g}" data-k="${k}" aria-label="${t('fc.notSame')}" title="${t('fc.notSame')}">×</button></li>`)).join('');
  return `<li class="fc-group"><p class="fc-count">${t('fc.photos', groupFaces(g).length)}</p><ul class="fc-faces">${thumbs}</ul>`
    + `<div class="fc-pick"><input class="fc-find" type="search" autocomplete="off" data-g="${g}" placeholder="${t('med.whoSearch')}" aria-label="${t('med.who')}">`
    + `<button class="btn small" type="button" data-act="fc-skip" data-g="${g}">${t('fc.skip')}</button></div>`
    + `<ul class="tag-hits" id="fcHits${g}"></ul></li>`;
}

function portraitHTML(c) {
  const p = P(c.id);
  const years = lifeYears(p);
  return `<li class="fc-portrait">${faceThumb(c)}<span class="fc-who"><b>${esc(fullName(p))}</b>${years ? ` <small>${esc(years)}</small>` : ''}</span>`
    + `<button class="btn small primary" type="button" data-act="fc-portrait" data-id="${esc(c.id)}">${t('fc.usePortrait')}</button>`
    + `<button class="btn small" type="button" data-act="fc-portrait-skip" data-id="${esc(c.id)}">${t('fc.skip')}</button></li>`;
}

export function renderFaces() {
  if (!open) return;
  const head = `<div class="sheet-head"><h2 id="fcTitle">${t('fc.title')}</h2>`
    + `<button class="icon-btn" type="button" data-act="faces-close" aria-label="${t('close')}">×</button></div>`;
  if (!data) {
    setHTML($('#facesCard'), head + `<p class="hint">${failed ? esc(failed) : t('fc.looking')}</p>`);
    return;
  }
  const groups = data.groups.map((_, g) => g).filter((g) => !done.has('g' + g) && groupFaces(g).length);
  const portraits = data.portraits.filter((c) => P(c.id) && !P(c.id).photo && !done.has('p' + c.id));
  const body = (groups.length
    ? `<section class="fc-section"><h3>${t('fc.groups')} <span class="n">${groups.length}</span></h3><p class="hint">${t('fc.groupsHint')}</p>`
      + `<ul class="fc-groups">${groups.map(groupHTML).join('')}</ul></section>` : '')
    + (portraits.length
      ? `<section class="fc-section"><h3>${t('fc.portraits')} <span class="n">${portraits.length}</span></h3><p class="hint">${t('fc.portraitsHint')}</p>`
        + `<ul class="fc-portraits">${portraits.map(portraitHTML).join('')}</ul></section>` : '');
  setHTML($('#facesCard'), head + (body || `<p class="hint">${t('fc.nothing')}</p>`));
}

/** Typing a name for group `g`: the people found. */
export function onFacesFind(g, query) {
  const list = document.getElementById('fcHits' + g);
  if (list) setHTML(list, hitsHTML(g, query));
}

/** Enter in a group's search: the first person found. */
export function pickFirstFace(g) {
  const first = document.querySelector(`#fcHits${g} [data-act="fc-name"]`);
  if (first) nameGroup(g, first.dataset.id);
}

/** Takes face `k` out of group `g`: it isn't that person. */
export function dropFace(g, k) {
  removed.add(`${g}|${k}`);
  renderFaces();
}

export function skipGroup(g) {
  done.add('g' + g);
  renderFaces();
}

export function skipPortrait(id) {
  done.add('p' + id);
  renderFaces();
}

/** Group `g` is person `id`: a marker on their face on each photo, one undoable action. */
export async function nameGroup(g, id) {
  if (!data || !P(id) || !S.canWrite) return;
  const changes = new Map(); // image id -> tags
  for (const f of groupFaces(g)) {
    const found = imageOf(f.photo);
    if (!found) continue;
    const [mid, m] = found;
    const tags = changes.get(mid) || tagsOf(m);
    if (tags.some((x) => x.id === id && hasPlace(x))) continue; // already placed there
    changes.set(mid, [...tags.filter((x) => x.id !== id), { id, x: f.x, y: f.y }]);
  }
  if (S.edit && S.edit.media && S.edit.media.some((x) => changes.has(x.id))) {
    toast(t('finishFirst')); // the record form would rewrite its gallery when saving
    return;
  }
  done.add('g' + g);
  if (changes.size) {
    beginAction('hist.tag');
    try {
      await inBatch(async () => {
        for (const [mid, tags] of changes) await opUpdate('media', mid, { tags });
      });
    } catch (e) {
      reportError(e);
    } finally {
      commitAction();
      emit('data');
    }
    toast(t('fc.named', fullName(P(id)), changes.size, P(id).sex));
  }
  renderFaces();
}

/** The face proposed for `id`'s portrait, framed in the crop tool, becomes their portrait. */
export async function choosePortrait(id) {
  const c = data && data.portraits.find((x) => x.id === id);
  if (!c || !P(id) || !S.canWrite) return;
  if (S.edit && S.edit.id === id) {
    toast(t('finishFirst')); // the record form would put back its own photo when saving
    return;
  }
  let photo;
  try {
    const blob = await (await fetch(photoSrc(c.photo))).blob();
    photo = await cropPhoto(blob, c.box);
  } catch (e) {
    toast(e.message, true);
    return;
  }
  if (!photo || !P(id)) return; // cancelled
  beginAction('hist.portrait');
  try {
    await opUpdate('people', id, { photo: await storePhoto(photo, P(id)) });
    done.add('p' + id);
  } catch (e) {
    reportError(e);
  } finally {
    commitAction();
    emit('data');
  }
  renderFaces();
}
