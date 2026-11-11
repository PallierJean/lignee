/**
 * Gallery viewer: a photo or a document, with the people identified.
 * A click on the image places a marker, then you choose the person.
 */
import { S } from '../state.js';
import { $, esc, setHTML } from '../utils/dom.js';
import { t } from '../i18n.js';
import { P, given, surname, maiden, fullName, lifeYears, mediaList, mediaLabel, photoSrc, peopleNamedIn } from '../model/people.js';
import { opUpdate, beginAction, commitAction } from '../services/storage.js';
import { emit } from '../services/notify.js';
import { personOptions, captureDraft } from './form.js';
import { toast, reportError } from './toast.js';
import { mediaGroups } from './record.js';

/** Data changed: indexes and page follow (ui/render.js afterData, see ui/connect.js). */
const afterData = () => emit('data');

let current = null;  // { owner, id }: photo shown; { draft: index }: an image of the form, not saved yet
let pin = null;      // { x, y }: marker waiting for a person
let editing = false; // caption being edited
let sequence = [];    // [{ owner, id }]: the images of the grid it was opened from, in order
let back = false;     // the back of the image is shown (contract, annotated photo)

const isDraft = () => !!current && current.draft !== undefined;
const item = () => {
  if (!current) return null;
  if (isDraft()) return (S.edit && S.edit.media[current.draft] && !S.edit.media[current.draft].removed) ? S.edit.media[current.draft] : null;
  return mediaList(P(current.owner)).find((m) => m.id === current.id);
};

/** Markers of an image, with numeric positions: they may come from an imported file. */
const tagsOf = (m) => (Array.isArray(m.tags) ? m.tags : [])
  .filter((x) => x && typeof x === 'object')
  .map((x) => ({ ...x, x: Math.min(100, Math.max(0, +x.x || 0)), y: Math.min(100, Math.max(0, +x.y || 0)) }));

/** A face's label: first name, surname and lifespan. */
function tagLabel(p) {
  const years = lifeYears(p);
  return `<span class="tag-name"><b>${esc(given(p))} <span class="sur">${esc(surname(p) || maiden(p))}</span></b>`
    + (years ? `<small>${esc(years)}</small>` : '') + '</span>';
}

/** Face at the bottom of the photo: the label above. On the sides, see fitLabel. */
const pinSide = (x) => (x.y > 70 ? ' up' : '');

export function renderMedia() {
  if (!current) return;
  const m = item();
  if (!m) {
    closeMedia();
    return;
  }
  if (!photoSrc(m.back)) back = false;
  const tags = back ? [] : tagsOf(m); // people are identified on the front
  // Invisible markers on faces: they light up on hover, of the face or of the name in the list (highlightTag)
  const shown = tags.filter((x) => P(x.id));
  const marks = shown.map((x) => `<button class="tag-pin${pinSide(x)}" type="button" data-tag="${tags.indexOf(x)}" data-style="left:${x.x}%;top:${x.y}%"`
    + ` data-act="media-person" data-id="${esc(x.id)}" aria-label="${esc(fullName(P(x.id)))}">${tagLabel(P(x.id))}</button>`).join('');
  const names = shown.map((x) => `<li data-tag="${tags.indexOf(x)}">`
    + `<button class="link" type="button" data-act="media-person" data-id="${esc(x.id)}">${esc(fullName(P(x.id)))}</button>`
    + (S.canWrite ? ` <button class="link" type="button" data-act="tag-remove" data-i="${tags.indexOf(x)}">${t('med.untag')}</button>` : '') + '</li>').join('');
  // People named in the caption, not yet identified, at the top of the list
  const tagged = new Set(tags.map((x) => x.id));
  const named = peopleNamedIn([m.title, m.note].join(' ')).filter((id) => !tagged.has(id));
  const options = named.length
    ? `<optgroup label="${t('med.named')}">${named.map((id) => `<option value="${esc(id)}">${esc(fullName(P(id)))}</option>`).join('')}</optgroup>`
      + `<optgroup label="${t('med.everyone')}">${personOptions('')}</optgroup>`
    : personOptions('');
  const picker = pin
    ? `<div class="row-btns tag-pick"><select id="tagPerson" aria-label="${t('med.who')}"><option value="">${t('med.who')}</option>${options}</select>`
      + `<button class="btn small" type="button" data-act="tag-cancel">${t('cancel')}</button></div>`
    : '';
  // The instruction above the image: that's where you click
  const hint = back ? `<p class="hint tag-hint">${t('med.backHint')}</p>`
    : S.canWrite && !pin ? `<p class="hint tag-hint">${t('med.hint')}</p>` : '';
  // Front and back: two sides of the same document
  const sides = photoSrc(m.back)
    ? `<div class="seg media-sides" role="group" aria-label="${t('med.sides')}">`
      + `<button type="button" data-act="media-side" data-back="0" aria-pressed="${!back}">${t('med.front')}</button>`
      + `<button type="button" data-act="media-side" data-back="1" aria-pressed="${back}">${t('med.back')}</button></div>`
    : '';
  // From one image to the next: buttons, and the arrow keys (ui/events.js)
  const at = sequence.findIndex((x) => x.owner === current.owner && x.id === current.id);
  const nav = sequence.length > 1 && at >= 0
    ? `<div class="media-nav"><button class="icon-btn" type="button" data-act="media-step" data-d="-1" aria-label="${t('med.prev')}" title="${t('med.prev')}">‹</button>`
      + `<span class="n">${t('med.position', at + 1, sequence.length)}</span>`
      + `<button class="icon-btn" type="button" data-act="media-step" data-d="1" aria-label="${t('med.next')}" title="${t('med.next')}">›</button></div>`
    : '';
  setHTML($('#mediaCard'), `<div class="sheet-head"><h2 id="mdTitle">${esc(mediaLabel(m) || t('med.untitled'))}</h2>${nav}`
    + `<button class="icon-btn" type="button" data-act="media-close" aria-label="${t('close')}">×</button></div>`
    + sides + hint
    + `<div class="media-pic${S.canWrite && !back ? ' can-tag' : ''}" data-act="media-pic"><img src="${esc(photoSrc(back ? m.back : m.photo))}" alt="${esc(m.title || '')}${back ? ' (' + t('med.back') + ')' : ''}">${marks}`
    + (pin ? `<span class="tag-pin new" data-style="left:${pin.x}%;top:${pin.y}%">+</span>` : '') + '</div>'
    + (isDraft() ? `<p class="hint">${t('med.draftHint')}</p>` : caption(m))
    + (names ? `<ol class="tag-list">${names}</ol>` : '') + picker);
}

/**
 * Keeps a face's label inside the photo: near an edge, it slides inwards (--dx)
 * and its tip stays on the face; wider than the photo, it wraps.
 */
function fitLabel(pin) {
  const label = pin.querySelector('.tag-name');
  const pic = pin.closest('.media-pic');
  if (!label || !pic) return;
  const box = pic.getBoundingClientRect();
  label.style.maxWidth = `${box.width - 12}px`;
  label.style.setProperty('--dx', '0px');
  const r = label.getBoundingClientRect();
  const dx = Math.max(box.left + 6 - r.left, Math.min(0, box.right - 6 - r.right));
  label.style.setProperty('--dx', `${Math.round(dx)}px`);
}

/** Hover (or focus) of a face, or of a name in the list, which then lights up its person on the photo. */
export function highlightTag(target, on) {
  if (!target || !target.closest) return;
  const row = target.closest('.tag-list [data-tag]');
  const pin = row ? document.querySelector(`.tag-pin[data-tag="${row.dataset.tag}"]`) : target.closest('.tag-pin[data-tag]');
  if (!pin) return;
  if (on) fitLabel(pin);
  if (row) pin.classList.toggle('lit', on);
}

/** Caption under the image: title, date and text; editable in place. */
function caption(m) {
  if (editing) {
    const off = S.busy ? ' disabled' : '';
    return `<div class="an-form media-caption">`
      + `<label class="fld"><span>${t('f.srcTitle')}</span><input id="mdEditTitle" value="${esc(m.title)}"></label>`
      + `<label class="fld"><span>${t('f.date')}</span><input id="mdEditDate" value="${esc(m.date)}"></label>`
      + `<label class="fld"><span>${t('med.caption')}</span><textarea id="mdEditNote" rows="3">${esc(m.note)}</textarea></label>`
      + `<div class="row-btns"><button class="btn small primary" type="button" data-act="caption-save"${off}>${t('save')}</button>`
      + `<button class="btn small" type="button" data-act="caption-cancel">${t('cancel')}</button></div></div>`;
  }
  const text = [m.date, m.note].filter(Boolean).join(' · ');
  const change = S.canWrite ? ` <button class="link" type="button" data-act="caption-edit">${t(text ? 'med.editCaption' : 'med.addCaption')}</button>` : '';
  return text || change ? `<p class="media-text">${esc(text)}${change}</p>` : '';
}

/** Opens or closes caption editing. */
export function editCaption(on) {
  if (on && S.edit && S.edit.id === current.owner) {
    toast(t('finishFirst')); // the record form would rewrite the gallery when saving
    return;
  }
  editing = on;
  pin = null;
  renderMedia();
}

/** Saves the title, date and caption entered. */
export async function saveCaption() {
  const m = item();
  if (!m || !S.canWrite) return;
  const value = (id) => String((document.getElementById(id) || {}).value || '').trim();
  const patch = { title: value('mdEditTitle'), date: value('mdEditDate'), note: value('mdEditNote') };
  editing = false;
  const owner = P(current.owner);
  beginAction('hist.caption');
  try {
    await opUpdate('people', current.owner, { media: mediaList(owner).map((x) => (x.id === current.id ? { ...x, ...patch } : x)) });
  } catch (e) {
    reportError(e);
  } finally {
    commitAction();
    afterData();
  }
}

/**
 * Opens an image of the form (gallery of the record being edited) to identify the people on it:
 * the markers go with the record, when it is saved.
 */
export function openDraftMedia(i) {
  if (!S.edit || !S.edit.media[i]) return;
  captureDraft(); // what was typed in the form stays
  current = { draft: i };
  sequence = [];
  back = false;
  pin = null;
  editing = false;
  $('#mediaDlg').hidden = false;
  renderMedia();
}

export function openMedia(owner, id, group = '') {
  current = { owner, id };
  sequence = (mediaGroups.get(group) || []).filter((x) => P(x.owner));
  back = false;
  pin = null;
  editing = false;
  $('#mediaDlg').hidden = false;
  renderMedia();
}

/**
 * Next (d = 1) or previous (d = -1) image of the grid, going round; not while a marker waits for
 * its person or the caption is being edited.
 */
export function stepMedia(d) {
  if (!current || pin || editing || sequence.length < 2) return false;
  const at = sequence.findIndex((x) => x.owner === current.owner && x.id === current.id);
  if (at < 0) return false;
  current = { ...sequence[(at + d + sequence.length) % sequence.length] };
  back = false;
  renderMedia();
  return true;
}

/** Shows the back (true) or the front of the image; a marker waiting for its person is dropped. */
export function showMediaSide(onBack) {
  if (!current) return;
  back = Boolean(onBack);
  pin = null;
  renderMedia();
}

export function closeMedia() {
  current = null;
  sequence = [];
  pin = null;
  $('#mediaDlg').hidden = true;
}

/** Click on the image: marker position, as a percentage of the image. */
export function placePin(el, ev) {
  // While typing the caption, a click on the image must not redraw (and clear) the fields
  if (!S.canWrite || editing || back || !item() || ev.target.closest('.tag-pin')) return;
  const box = el.querySelector('img').getBoundingClientRect();
  pin = {
    x: Math.round(((ev.clientX - box.left) / box.width) * 1000) / 10,
    y: Math.round(((ev.clientY - box.top) / box.height) * 1000) / 10,
  };
  renderMedia();
}

export function cancelPin() {
  pin = null;
  renderMedia();
}

async function saveTags(tags) {
  if (isDraft()) {
    // An image of the form: the markers wait for the record to be saved
    item().tags = tags;
    renderMedia();
    emit('form');
    return;
  }
  const owner = P(current.owner);
  beginAction('hist.tag');
  try {
    await opUpdate('people', current.owner, { media: mediaList(owner).map((m) => (m.id === current.id ? { ...m, tags } : m)) });
  } catch (e) {
    reportError(e);
  } finally {
    commitAction();
    afterData();
  }
}

export async function addTag(id) {
  const m = item();
  if (!m || !pin || !P(id)) return;
  const tags = [...tagsOf(m), { id, x: pin.x, y: pin.y }];
  pin = null;
  await saveTags(tags);
}

export async function removeTag(i) {
  const m = item();
  if (m) await saveTags(tagsOf(m).filter((_, k) => k !== i));
}
