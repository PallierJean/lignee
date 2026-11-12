/**
 * Gallery viewer: a photo or a document, with the people identified.
 * A click on the image places a marker, then you choose the person.
 * The images are the tree's gallery (model/media.js), apart from the records: a person is linked
 * to an image only by being identified on it, with a marker on their face or not yet.
 */
import { S } from '../state.js';
import { $, esc, setHTML } from '../utils/dom.js';
import { t } from '../i18n.js';
import { P, given, surname, maiden, fullName, lifeYears, mediaLabel, photoSrc, peopleNamedIn, fileTitle, SOURCE_KINDS } from '../model/people.js';
import { sourcesOf } from '../model/sources.js';
import { tagsOf, hasPlace } from '../model/media.js';
import { opSet, opUpdate, opDelete, inBatch, beginAction, commitAction, storePhoto, GALLERY_LABEL } from '../services/storage.js';
import { cropFree, cropTags } from './crop-free.js';
import { photoFromFile, DOCUMENT_SIDE } from '../utils/image.js';
import { rid } from '../utils/helpers.js';
import { emit } from '../services/notify.js';
import { captureDraft } from './form.js';
import { searchPeople } from './search.js';
import { toast, reportError } from './toast.js';
import { mediaGroups } from './record.js';

/** Data changed: indexes and page follow (ui/render.js afterData, see ui/connect.js). */
const afterData = () => emit('data');

let current = null;  // { id }: image shown; { draft: index }: an image of the form, not saved yet
let pin = null;      // { x, y }: marker waiting for a person
let editing = false; // caption being edited
let sequence = [];    // [id]: the images of the grid it was opened from, in order
let back = false;     // the back of the image is shown (contract, annotated photo)
let askDelete = false; // the deletion of the image waits for its confirmation
let askArchive = false; // moving the image to the archives waits for its kind

const isDraft = () => !!current && current.draft !== undefined;
const item = () => {
  if (!current) return null;
  if (isDraft()) return (S.edit && S.edit.media[current.draft] && !S.edit.media[current.draft].removed) ? S.edit.media[current.draft] : null;
  return S.media.get(current.id) || null;
};

/** True if the record being edited holds the image shown: saving it would rewrite the image. */
const inForm = () => !!(S.edit && current && !isDraft() && S.edit.media.some((x) => x.id === current.id));

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
  const marks = shown.filter(hasPlace).map((x) => `<button class="tag-pin${pinSide(x)}" type="button" data-tag="${tags.indexOf(x)}" data-style="left:${x.x}%;top:${x.y}%"`
    + ` data-act="media-person" data-id="${esc(x.id)}" aria-label="${esc(fullName(P(x.id)))}">${tagLabel(P(x.id))}</button>`).join('');
  const names = shown.map((x) => `<li data-tag="${tags.indexOf(x)}">`
    + `<button class="link" type="button" data-act="media-person" data-id="${esc(x.id)}">${esc(fullName(P(x.id)))}</button>`
    + (S.canWrite ? ` <button class="link" type="button" data-act="tag-remove" data-i="${tags.indexOf(x)}">${t('med.untag')}</button>` : '') + '</li>').join('');
  // People named in the caption, without a marker yet, at the top of the list
  const tagged = new Set(tags.filter(hasPlace).map((x) => x.id));
  const named = peopleNamedIn([m.title, m.note].join(' ')).filter((id) => !tagged.has(id));
  const picker = pin
    ? `<div class="tag-pick"><input id="tagFind" type="search" autocomplete="off" placeholder="${t('med.whoSearch')}" aria-label="${t('med.who')}">`
      + `<button class="btn small" type="button" data-act="tag-cancel">${t('cancel')}</button>`
      + `<ul class="tag-hits" id="tagHits">${tagHits('', named, tagged)}</ul></div>`
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
  const at = sequence.indexOf(current.id);
  const nav = sequence.length > 1 && at >= 0
    ? `<div class="media-nav"><button class="icon-btn" type="button" data-act="media-step" data-d="-1" aria-label="${t('med.prev')}" title="${t('med.prev')}">‹</button>`
      + `<span class="n">${t('med.position', at + 1, sequence.length)}</span>`
      + `<button class="icon-btn" type="button" data-act="media-step" data-d="1" aria-label="${t('med.next')}" title="${t('med.next')}">›</button></div>`
    : '';
  // The title, and next to it the way to change it
  const pen = S.canWrite && !isDraft() && !editing ? `<button class="icon-btn md-pen" type="button" data-act="caption-edit" aria-label="${t('med.editTitle')}" title="${t('med.editTitle')}">✎</button>` : '';
  setHTML($('#mediaCard'), `<div class="sheet-head"><h2 id="mdTitle">${esc(mediaLabel(m) || t('med.untitled'))}</h2>${pen}${nav}`
    + `<button class="icon-btn" type="button" data-act="media-close" aria-label="${t('close')}">×</button></div>`
    + sides + hint
    + `<div class="media-pic${S.canWrite && !back ? ' can-tag' : ''}" data-act="media-pic"><img src="${esc(photoSrc(back ? m.back : m.photo))}" alt="${esc(m.title || '')}${back ? ' (' + t('med.back') + ')' : ''}">${marks}`
    + (pin ? `<span class="tag-pin new" data-style="left:${pin.x}%;top:${pin.y}%">+</span>` : '') + '</div>'
    + (isDraft() ? `<p class="hint">${t('med.draftHint')}</p>` : caption(m))
    + (names ? `<ol class="tag-list">${names}</ol>` : '') + picker
    + (isDraft() || !S.canWrite || editing ? '' : deleteBlock()));
}

const TAG_HITS = 12; // people listed while searching whom to identify

/**
 * People to identify, as buttons: those matching `query` (name, places, dates), or, with an empty
 * query, those named in the caption. People already identified on the image aren't offered.
 */
function tagHits(query, named, tagged) {
  const ids = String(query || '').trim()
    ? searchPeople(query, TAG_HITS, tagged).ids
    : named;
  if (!ids.length) return `<li class="hint">${t(String(query || '').trim() ? 'med.noHit' : 'med.typeName')}</li>`;
  return ids.map((id) => {
    const years = lifeYears(P(id));
    return `<li><button type="button" data-act="tag-pick" data-id="${esc(id)}">${esc(fullName(P(id)))}${years ? ` <small>${esc(years)}</small>` : ''}</button></li>`;
  }).join('');
}

/** Search typed in the "who is it?" field: only the results are redrawn, the field keeps the cursor. */
export function onTagFind(query) {
  const m = item();
  const list = document.getElementById('tagHits');
  if (!m || !list) return;
  const tagged = new Set(tagsOf(m).filter(hasPlace).map((x) => x.id));
  list.innerHTML = tagHits(query, [], tagged);
}

/** Enter in the "who is it?" field: the first result. */
export function pickFirstTag() {
  const first = document.querySelector('#tagHits [data-act="tag-pick"]');
  if (first) addTag(first.dataset.id);
}

/** Cropping and deleting the image: links, then a confirmation that says where it disappears. */
function deleteBlock() {
  const m = item();
  const crop = back ? '' : `<button class="link" type="button" data-act="media-crop">${t('med.crop')}</button> · `;
  // The back: a contract's second side, a photo's annotated back
  const side = photoSrc(m && m.back)
    ? `<label class="link"><input type="file" accept="image/*" class="sr" data-media-back="1">${t('med.backChange')}</label> · `
      + `<button class="link" type="button" data-act="media-back-remove">${t('med.backRemove')}</button> · `
    : `<label class="link"><input type="file" accept="image/*" class="sr" data-media-back="1">${t('med.backAdd')}</label> · `;
  if (askArchive) {
    const kinds = SOURCE_KINDS.map((k) => `<option value="${k}"${k === 'family' ? ' selected' : ''}>${esc(t('src.' + k))}</option>`).join('');
    return `<div class="confirm media-delete"><p>${t('med.archiveAsk')}</p>`
      + `<label class="fld"><span>${t('f.srcKind')}</span><select id="archiveKind">${kinds}</select></label>`
      + `<button class="btn small primary" type="button" data-act="media-archive-yes">${t('med.archiveYes')}</button>`
      + `<button class="btn small" type="button" data-act="media-archive-no">${t('cancel')}</button></div>`;
  }
  const archive = `<button class="link" type="button" data-act="media-archive">${t('med.archive')}</button> · `;
  if (!askDelete) return `<p class="media-delete">${crop}${side}${archive}<button class="link" type="button" data-act="media-delete">${t('med.delete')}</button></p>`;
  return `<div class="confirm media-delete"><p>${t('med.deleteAsk')}</p>`
    + `<button class="btn small danger" type="button" data-act="media-delete-yes">${t('med.deleteYes')}</button>`
    + `<button class="btn small" type="button" data-act="media-delete-no">${t('cancel')}</button></div>`;
}

/**
 * Crops the image shown (free frame): the cropped image replaces it, the people identified keep
 * their place on it (those left outside go); one undoable action.
 */
export async function cropMedia() {
  const m = item();
  if (!m || isDraft() || !S.canWrite) return;
  if (inForm()) {
    toast(t('finishFirst'));
    return;
  }
  const { id } = current;
  let res;
  try {
    res = await cropFree(photoSrc(m.photo));
  } catch (e) {
    toast(e.message, true);
    return;
  }
  if (!res) return;
  beginAction('hist.mediaCrop');
  try {
    const photo = await storePhoto(res.photo, GALLERY_LABEL);
    await opUpdate('media', id, { photo, tags: cropTags(m.tags, res.rect) });
  } catch (e) {
    reportError(e);
  } finally {
    commitAction();
    afterData();
  }
  renderMedia();
}

/**
 * Adds image files to the gallery, as one undoable action: a single image can be cropped first.
 * From a person's record (`who`), they show that person; from the tree's gallery, no one yet.
 * The first one added opens in the viewer, to identify the people on it.
 */
export async function addGalleryPhotos(who, files) {
  const list = [...(files || [])];
  if (!S.canWrite || (who && !P(who)) || !list.length) return;
  if (who && S.edit && S.edit.id === who) {
    toast(t('finishFirst')); // the record form would rewrite its gallery when saving
    return;
  }
  const added = [];
  for (const file of list) {
    try {
      let photo = await photoFromFile(file, DOCUMENT_SIDE);
      if (list.length === 1) {
        const res = await cropFree(photo);
        if (!res) return; // cancelled: nothing added
        photo = res.photo;
      }
      added.push({ id: rid('m'), photo: await storePhoto(photo, GALLERY_LABEL), title: '', date: '', note: '', tags: who ? [{ id: who }] : [], createdAt: Date.now() });
    } catch (e) {
      toast(e.message, true);
    }
  }
  if (!added.length) return;
  beginAction('hist.mediaAdd');
  try {
    await inBatch(async () => {
      for (const { id, ...m } of added) await opSet('media', id, m);
    });
  } catch (e) {
    reportError(e);
    return;
  } finally {
    commitAction();
    afterData();
  }
  toast(t('med.added', added.length));
  mediaGroups.set('new', added.map((x) => x.id));
  openMedia(added[0].id, 'new');
}

/**
 * Adds or replaces the back of the image shown (`file`), or removes it (`file` null): one undoable
 * action; the viewer shows the side just added.
 */
export async function setMediaBack(file) {
  const m = item();
  if (!m || isDraft() || !S.canWrite) return;
  if (inForm()) {
    toast(t('finishFirst'));
    return;
  }
  const { id } = current;
  let data = '';
  if (file) {
    try {
      data = await storePhoto(await photoFromFile(file, DOCUMENT_SIDE), GALLERY_LABEL);
    } catch (e) {
      toast(e.message, true);
      return;
    }
  }
  beginAction(file ? 'hist.mediaBack' : 'hist.mediaBackRemove');
  try {
    if (data) await opUpdate('media', id, { back: data });
    else {
      const { back: gone, ...front } = S.media.get(id);
      await opSet('media', id, front);
    }
  } catch (e) {
    reportError(e);
  } finally {
    commitAction();
    afterData();
  }
  back = Boolean(data);
  renderMedia();
}

/** Asks (true) or no longer asks to confirm the deletion of the image shown. */
export function askMediaDelete(on) {
  if (on && inForm()) {
    toast(t('finishFirst')); // the record form would bring the image back when saving
    return;
  }
  askDelete = on;
  askArchive = false;
  renderMedia();
}

/** Asks (true) or no longer asks the kind of document, before moving the image to the archives. */
export function askMediaArchive(on) {
  const busy = on && item() && (inForm() || tagsOf(item()).some((x) => S.edit && S.edit.id === x.id));
  if (busy) {
    toast(t('finishFirst')); // the record form would bring the image back, or drop the source, when saving
    return;
  }
  askArchive = on;
  askDelete = false;
  renderMedia();
}

/** After the image shown left the gallery: the viewer goes on to the next image, or closes. */
function leaveCurrent(id) {
  // The next image first: the page redrawn afterwards would close a viewer showing a gone image
  const at = sequence.indexOf(id);
  sequence = sequence.filter((x) => x !== id);
  if (sequence.length) {
    current = { id: sequence[Math.max(0, Math.min(at, sequence.length - 1))] };
    back = false;
  } else closeMedia();
  afterData();
  if (current) renderMedia();
}

/**
 * Moves the image shown to the archives: it leaves the gallery and becomes a source of `kind`
 * (front, back, title, date and note kept), cited by the people identified on it, for their whole
 * record. One undoable action. An image identifying no one stays: no record would keep the source.
 */
export async function archiveMedia(kind) {
  const m = item();
  if (!m || isDraft() || !S.canWrite) return;
  const { id } = current;
  const citers = [...new Set(tagsOf(m).map((x) => x.id))].filter((pid) => P(pid));
  if (!citers.length) {
    toast(t('med.archiveNobody'), true);
    return;
  }
  askArchive = false;
  const source = rid('S');
  const doc = {
    source, fact: '', kind: SOURCE_KINDS.includes(kind) ? kind : 'other', title: m.title || '',
    note: [m.date, m.note].filter(Boolean).join(' — '), photo: m.photo, ...(photoSrc(m.back) ? { back: m.back } : {}),
  };
  beginAction('hist.mediaArchive');
  try {
    await inBatch(async () => {
      for (const pid of citers) await opUpdate('people', pid, { sources: [...sourcesOf(P(pid)), { ...doc, id: rid('c') }] });
      await opDelete('media', id);
    });
  } catch (e) {
    reportError(e);
  } finally {
    commitAction();
  }
  leaveCurrent(id);
  toast(t('med.archived'));
}

/**
 * Deletes the image shown from the tree's gallery (and so from the galleries of the people
 * identified on it), as one undoable action; the viewer goes on to the next image, or closes.
 */
export async function deleteMedia() {
  const m = item();
  if (!m || isDraft() || !S.canWrite) return;
  const { id } = current;
  askDelete = false;
  askArchive = false;
  beginAction('hist.mediaDelete');
  try {
    await opDelete('media', id);
  } catch (e) {
    reportError(e);
  } finally {
    commitAction();
  }
  leaveCurrent(id);
  toast(t('med.deleted'));
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
      + `<label class="fld"><span>${t('f.srcTitle')}</span><input id="mdEditTitle" value="${esc(fileTitle(m.title || '') ? m.title : '')}" placeholder="${t('f.medTitlePlaceholder')}"></label>`
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
  if (on && inForm()) {
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
  beginAction('hist.caption');
  try {
    await opUpdate('media', current.id, patch);
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

export function openMedia(id, group = '') {
  if (!S.media.has(id)) return;
  current = { id };
  sequence = (mediaGroups.get(group) || []).filter((x) => S.media.has(x));
  back = false;
  askDelete = false;
  askArchive = false;
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
  const at = sequence.indexOf(current.id);
  if (at < 0) return false;
  current = { id: sequence[(at + d + sequence.length) % sequence.length] };
  back = false;
  askDelete = false;
  askArchive = false;
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
  const find = document.getElementById('tagFind');
  if (find) find.focus(); // type the name right away
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
  beginAction('hist.tag');
  try {
    await opUpdate('media', current.id, { tags });
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
  // A person already on the image without a marker: the marker is theirs now
  const tags = [...tagsOf(m).filter((x) => x.id !== id || hasPlace(x)), { id, x: pin.x, y: pin.y }];
  pin = null;
  await saveTags(tags);
}

export async function removeTag(i) {
  const m = item();
  if (m) await saveTags(tagsOf(m).filter((_, k) => k !== i));
}
