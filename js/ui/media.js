/**
 * Gallery viewer: a photo or a document, with the people identified.
 * A click on the image places a marker, then you choose the person.
 * It shows the archives too (images classed from the gallery, model/people.js ARCHIVE_KIND): a
 * shared source whose `tags` place people on it, and whom every person identified cites. Identifying
 * someone there adds their citation; removing them takes it away; the archive can go back to the gallery.
 * The images are the tree's gallery (model/media.js), apart from the records: a person is linked
 * to an image only by being identified on it, with a marker on their face or not yet.
 */
import { S } from '../state.js';
import { $, esc, setHTML } from '../utils/dom.js';
import { t } from '../i18n.js';
import { P, given, surname, maiden, fullName, lifeYears, mediaLabel, photoSrc, peopleNamedIn, fileTitle, ARCHIVE_KIND } from '../model/people.js';
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
import { ICON_TO_GALLERY, ICON_TRASH } from './icons.js';
import { canFindFaces, findFaces } from '../services/faces.js';

/** Data changed: indexes and page follow (ui/render.js afterData, see ui/connect.js). */
const afterData = () => emit('data');

let current = null;  // { id }: image shown; { draft: index }: an image of the form, not saved yet; { archive: source id }
let pin = null;      // { x, y }: marker waiting for a person
let editing = false; // caption being edited
let sequence = [];    // [id]: the images of the grid it was opened from, in order
let back = false;     // the back of the image is shown (contract, annotated photo)
let askDelete = false; // the deletion of the image waits for its confirmation
let askArchive = false; // moving the image to the archives waits for a confirmation
const guesses = new Map(); // photo -> [{ x, y, id, score }] faces recognised (null while looking)
const dismissed = new Set(); // "photo|id": suggestions dismissed, not made again in this session

const isDraft = () => !!current && current.draft !== undefined;
const isArchive = () => !!current && current.archive !== undefined;
const item = () => {
  if (!current) return null;
  if (isDraft()) return (S.edit && S.edit.media[current.draft] && !S.edit.media[current.draft].removed) ? S.edit.media[current.draft] : null;
  if (isArchive()) return archiveItem(current.archive);
  return S.media.get(current.id) || null;
};
/** Id of the image or archive shown, as in `sequence`. */
const shownId = () => (isArchive() ? current.archive : current.id);
/** Shows image or archive `id`, in the same mode as now. */
const show = (id) => { current = isArchive() ? { archive: id } : { id }; };

const listOf = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);

/** People who cite source `sid`: [id], in the order of the tree. */
const citersOf = (sid) => [...S.people].filter(([, p]) => listOf(p && p.citations).some((c) => c.source === sid)).map(([id]) => id);

/**
 * Archive `sid` as an image of the viewer: { title, note, photo, back, tags }. The people identified
 * are those who cite it, with a marker where its `tags` place them.
 */
function archiveItem(sid) {
  const src = S.sources.get(sid);
  if (!src || src.kind !== ARCHIVE_KIND || !photoSrc(src.photo)) return null;
  const citers = citersOf(sid);
  const placed = tagsOf(src).filter((x) => hasPlace(x) && citers.includes(x.id));
  const unplaced = citers.filter((id) => !placed.some((x) => x.id === id)).map((id) => ({ id }));
  return { title: src.title || '', note: src.note || '', photo: src.photo, ...(src.back ? { back: src.back } : {}), tags: [...placed, ...unplaced] };
}

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

/**
 * Faces recognised on image `m` that are still to confirm: not dismissed, of people not yet placed
 * on it, on faces without a marker. The first time, asks the local server, then shows them.
 */
function guessesOf(m) {
  if (back || isDraft() || !S.canWrite || !canFindFaces(m.photo)) return [];
  const photo = m.photo;
  if (!guesses.has(photo)) {
    guesses.set(photo, null);
    findFaces(photo)
      .then((list) => guesses.set(photo, list))
      .catch(() => guesses.set(photo, []))
      .then(() => {
        // Not while a marker waits for its name or the caption is typed: it would clear the field
        const m2 = item();
        if (m2 && m2.photo === photo && !pin && !editing) renderMedia();
      });
  }
  const placed = tagsOf(m).filter(hasPlace);
  const near = (g) => placed.some((x) => Math.hypot(x.x - g.x, x.y - g.y) < 4);
  return (guesses.get(photo) || []).filter((g) => P(g.id) && !dismissed.has(photo + '|' + g.id)
    && !placed.some((x) => x.id === g.id) && !near(g));
}

/** Suggestions waiting for an answer from the server on image `m`. */
const guessing = (m) => !back && !isDraft() && S.canWrite && canFindFaces(m.photo) && guesses.get(m.photo) === null;

/** The faces recognised: dashed markers on the photo, and below, each name to confirm or dismiss. */
function guessBlock(list) {
  const rows = list.map((g, i) => {
    const p = P(g.id);
    const years = lifeYears(p);
    return `<li class="tag-chip guess-chip" data-guess="${i}">`
      + `<button class="tag-who" type="button" data-act="media-person" data-id="${esc(g.id)}"><b>${esc(fullName(p))}</b>${years ? ` <small>${esc(years)}</small>` : ''} ?</button>`
      + `<button class="guess-yes" type="button" data-act="guess-yes" data-id="${esc(g.id)}" aria-label="${esc(t('med.guessYesWho', fullName(p)))}" title="${esc(t('med.guessYesWho', fullName(p)))}">✓ ${t('med.guessYes')}</button>`
      + `<button class="tag-x" type="button" data-act="guess-no" data-id="${esc(g.id)}" aria-label="${esc(t('med.guessNoWho', fullName(p)))}" title="${esc(t('med.guessNoWho', fullName(p)))}">×</button>`
      + '</li>';
  }).join('');
  const all = list.length > 1 ? ` <button class="link guess-all" type="button" data-act="guess-all">${t('med.guessAll', list.length)}</button>` : '';
  return `<section class="media-people media-guesses"><h3>${t('med.guesses')} <span class="n">${list.length}</span>${all}</h3>`
    + `<p class="hint">${t('med.guessHint')}</p><ul class="tag-list guess-list">${rows}</ul></section>`;
}

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
  // People on the image: boxes as on the record (name, years), × to remove them
  const names = shown.map((x) => {
    const years = lifeYears(P(x.id));
    return `<li class="tag-chip" data-tag="${tags.indexOf(x)}">`
      + `<button class="tag-who" type="button" data-act="media-person" data-id="${esc(x.id)}"><b>${esc(fullName(P(x.id)))}</b>${years ? ` <small>${esc(years)}</small>` : ''}</button>`
      + (S.canWrite ? `<button class="tag-x" type="button" data-act="tag-remove" data-i="${tags.indexOf(x)}" aria-label="${esc(t('med.untagWho', fullName(P(x.id))))}" title="${esc(t('med.untagWho', fullName(P(x.id))))}">×</button>` : '')
      + '</li>';
  }).join('');
  // People named in the caption, without a marker yet, at the top of the list
  const guessed = guessesOf(m);
  const guessMarks = guessed.map((g, i) => `<button class="tag-pin guess${pinSide(g)}" type="button" data-guess="${i}" data-style="left:${g.x}%;top:${g.y}%"`
    + ` data-act="guess-yes" data-id="${esc(g.id)}" aria-label="${esc(t('med.guessYesWho', fullName(P(g.id))))}">${tagLabel(P(g.id))}</button>`).join('');
  const tagged = new Set(tags.filter(hasPlace).map((x) => x.id));
  const named = peopleNamedIn([m.title, m.note].join(' ')).filter((id) => !tagged.has(id));
  const picker = pin
    ? `<div class="tag-pick"><input id="tagFind" type="search" autocomplete="off" placeholder="${t('med.whoSearch')}" aria-label="${t('med.who')}">`
      + `<button class="btn small" type="button" data-act="tag-cancel">${t('cancel')}</button>`
      + `<ul class="tag-hits" id="tagHits">${tagHits('', named, tagged)}</ul></div>`
    : '';
  // The instruction above the image: that's where you click
  const hint = back ? `<p class="hint tag-hint">${t('med.backHint')}</p>`
    : S.canWrite && !pin ? `<p class="hint tag-hint">${t(isArchive() ? 'arc.hint' : 'med.hint')}</p>` : '';
  // Front and back: two sides of the same document
  const sides = photoSrc(m.back)
    ? `<div class="seg media-sides" role="group" aria-label="${t('med.sides')}">`
      + `<button type="button" data-act="media-side" data-back="0" aria-pressed="${!back}">${t('med.front')}</button>`
      + `<button type="button" data-act="media-side" data-back="1" aria-pressed="${back}">${t('med.back')}</button></div>`
    : '';
  // From one image to the next: buttons, and the arrow keys (ui/events.js)
  const at = sequence.indexOf(shownId());
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
    + `<div class="media-pic${S.canWrite && !back ? ' can-tag' : ''}" data-act="media-pic"><img src="${esc(photoSrc(back ? m.back : m.photo))}" alt="${esc(m.title || '')}${back ? ' (' + t('med.back') + ')' : ''}">${marks}${pin ? '' : guessMarks}`
    + (pin ? `<span class="tag-pin new" data-style="left:${pin.x}%;top:${pin.y}%">+</span>` : '') + '</div>'
    + (isDraft() ? `<p class="hint">${t('med.draftHint')}</p>` : caption(m))
    + (names ? `<section class="media-people"><h3>${t('med.onImage')} <span class="n">${shown.length}</span></h3><ul class="tag-list">${names}</ul></section>` : '') + picker
    + (guessed.length && !pin ? guessBlock(guessed) : guessing(m) ? `<p class="hint guessing">${t('med.guessing')}</p>` : '')
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
  if (isArchive()) {
    if (askDelete) {
      return `<div class="confirm media-delete"><p>${t('arc.deleteAsk')}</p>`
        + `<button class="btn small danger" type="button" data-act="media-delete-yes">${t('arc.deleteYes')}</button>`
        + `<button class="btn small" type="button" data-act="media-delete-no">${t('cancel')}</button></div>`;
    }
    return actionBar(`<button class="btn small" type="button" data-act="archive-to-gallery">${ICON_TO_GALLERY}${t('arc.toGallery')}</button>`, 'arc.delete');
  }
  const crop = back ? '' : `<button class="btn small" type="button" data-act="media-crop">${t('med.crop')}</button>`;
  // The back: a contract's second side, a photo's annotated back
  const side = photoSrc(m && m.back)
    ? `<label class="btn small"><input type="file" accept="image/*" class="sr" data-media-back="1">${t('med.backChange')}</label>`
      + `<button class="btn small" type="button" data-act="media-back-remove">${t('med.backRemove')}</button>`
    : `<label class="btn small"><input type="file" accept="image/*" class="sr" data-media-back="1">${t('med.backAdd')}</label>`;
  if (askArchive) {
    return `<div class="confirm media-delete"><p>${t('med.archiveAsk')}</p>`
      + `<button class="btn small primary" type="button" data-act="media-archive-yes">${t('med.archiveYes')}</button>`
      + `<button class="btn small" type="button" data-act="media-archive-no">${t('cancel')}</button></div>`;
  }
  const archive = `<button class="btn small" type="button" data-act="media-archive">${t('med.archive')}</button>`;
  if (!askDelete) return actionBar(crop + side + archive, 'med.delete');
  return `<div class="confirm media-delete"><p>${t('med.deleteAsk')}</p>`
    + `<button class="btn small danger" type="button" data-act="media-delete-yes">${t('med.deleteYes')}</button>`
    + `<button class="btn small" type="button" data-act="media-delete-no">${t('cancel')}</button></div>`;
}

/** The viewer's actions under the image: `buttons` on the left, the deletion apart, discreet, on the right. */
const actionBar = (buttons, deleteLabel) => `<div class="media-actions"><div class="acts">${buttons}</div>`
  + `<button class="btn small quiet" type="button" data-act="media-delete">${ICON_TRASH}${t(deleteLabel)}</button></div>`;

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
/** From the Archives list: the archive opens, its deletion waiting for confirmation under the image. */
export function askArchiveDelete(sid) {
  openArchive(sid);
  if (isArchive() && current.archive === sid) askMediaDelete(true);
}

export function askMediaDelete(on) {
  if (on && (inForm() || (isArchive() && S.edit && citersOf(current.archive).includes(S.edit.id)))) {
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
    show(sequence[Math.max(0, Math.min(at, sequence.length - 1))]);
    back = false;
  } else closeMedia();
  afterData();
  if (current) renderMedia();
}

/**
 * Moves the image shown to the archives: it leaves the gallery and becomes a source of the archives'
 * kind (front, back, title, date and note kept), shown in the Archives view and not among the other
 * sources, cited by the people identified on it, for their whole record. One undoable action. An
 * image identifying no one stays: no record would keep the source.
 */
export async function archiveMedia() {
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
  // The markers on faces go with it: the archive shows them as the gallery did
  const placed = tagsOf(m).filter((x) => hasPlace(x) && citers.includes(x.id));
  const doc = {
    source, fact: '', kind: ARCHIVE_KIND, title: m.title || '',
    note: [m.date, m.note].filter(Boolean).join(' — '), photo: m.photo, ...(photoSrc(m.back) ? { back: m.back } : {}),
    ...(placed.length ? { tags: placed } : {}),
    ...(m.text ? { text: m.text } : {}), ...(m.backText ? { backText: m.backText } : {}),
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
  if (isArchive()) {
    await deleteArchive();
    return;
  }
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

/** Writes that take archive `sid` away from everyone citing it (people and unions); the source then goes. */
async function uncite(sid) {
  for (const [id, p] of [...S.people]) {
    if (listOf(p.citations).some((c) => c.source === sid)) await opSet('people', id, withCitations(p, listOf(p.citations).filter((c) => c.source !== sid)));
  }
  for (const [id, u] of [...S.unions]) {
    if (listOf(u && u.citations).some((c) => c.source === sid)) await opSet('unions', id, withCitations(u, listOf(u.citations).filter((c) => c.source !== sid)));
  }
  if (S.sources.has(sid)) await opDelete('sources', sid);
}

/** Record `x` with `citations`, the field left out when there are none. */
function withCitations(x, citations) {
  const { citations: _, ...rest } = x;
  return citations.length ? { ...rest, citations } : rest;
}

/** Deletes the archive shown: its image and the citations of it. One undoable action. */
async function deleteArchive() {
  const sid = current.archive;
  askDelete = false;
  beginAction('hist.archiveDelete');
  try {
    await inBatch(() => uncite(sid));
  } catch (e) {
    reportError(e);
  } finally {
    commitAction();
  }
  leaveCurrent(sid);
  toast(t('arc.deleted'));
}

/**
 * Puts the archive shown back in the gallery, as it was classed: an image identifying the same
 * people, with their markers, its front, back, title, caption and readings. One undoable action.
 */
export async function archiveToGallery(sid = isArchive() ? current.archive : '') {
  const m = archiveItem(sid);
  if (!m || !S.canWrite) return;
  const src = S.sources.get(sid);
  if (S.edit && citersOf(sid).includes(S.edit.id)) {
    toast(t('finishFirst')); // the record form would cite the archive again when saving
    return;
  }
  const image = {
    photo: m.photo, ...(m.back ? { back: m.back } : {}), title: m.title, date: '', note: m.note, tags: m.tags,
    ...(src.text ? { text: src.text } : {}), ...(src.backText ? { backText: src.backText } : {}), createdAt: Date.now(),
  };
  beginAction('hist.archiveToGallery');
  try {
    await inBatch(async () => {
      await opSet('media', rid('m'), image);
      await uncite(sid);
    });
  } catch (e) {
    reportError(e);
    return;
  } finally {
    commitAction();
  }
  if (isArchive() && current.archive === sid) leaveCurrent(sid);
  else afterData();
  toast(t('arc.backInGallery'));
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
  const row = target.closest('.tag-list [data-tag], .guess-list [data-guess]');
  const sel = (r) => (r.dataset.guess !== undefined ? `.tag-pin[data-guess="${r.dataset.guess}"]` : `.tag-pin[data-tag="${r.dataset.tag}"]`);
  const pin = row ? document.querySelector(sel(row)) : target.closest('.tag-pin[data-tag], .tag-pin[data-guess]');
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
      + (isArchive() ? '' : `<label class="fld"><span>${t('f.date')}</span><input id="mdEditDate" value="${esc(m.date)}"></label>`)
      + `<label class="fld"><span>${t('med.caption')}</span><textarea id="mdEditNote" rows="3">${esc(m.note)}</textarea></label>`
      + `<div class="row-btns"><button class="btn small primary" type="button" data-act="caption-save"${off}>${t('save')}</button>`
      + `<button class="btn small" type="button" data-act="caption-cancel">${t('cancel')}</button></div></div>`;
  }
  const text = [m.date, m.note].filter(Boolean).join(' · ');
  const label = isArchive() ? (text ? 'arc.editCaption' : 'arc.addCaption') : (text ? 'med.editCaption' : 'med.addCaption');
  const change = S.canWrite ? ` <button class="link md-caption-edit" type="button" data-act="caption-edit">${t(label)}</button>` : '';
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
    if (isArchive()) await opUpdate('sources', current.archive, { title: patch.title, note: patch.note });
    else await opUpdate('media', current.id, patch);
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

/** Opens archive `sid` (a source of the archives' kind); the arrows go through the Archives view's list. */
export function openArchive(sid, onBack = false) {
  const m = archiveItem(sid);
  if (!m) return;
  current = { archive: sid };
  sequence = (mediaGroups.get('archives') || []).filter((x) => archiveItem(x));
  back = !!onBack && !!photoSrc(m.back);
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
  const at = sequence.indexOf(shownId());
  if (at < 0) return false;
  show(sequence[(at + d + sequence.length) % sequence.length]);
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
  if (isArchive()) {
    await saveArchiveTags(tags);
    return;
  }
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

/**
 * The people identified on the archive shown become `tags`: the markers go to the source, a person
 * added cites it, a person removed no longer does. The last one stays: without anyone citing it,
 * the archive would disappear (deleting it says so).
 */
async function saveArchiveTags(tags) {
  const sid = current.archive;
  const ids = [...new Set(tags.map((x) => x.id))].filter((id) => P(id));
  if (!ids.length) {
    toast(t('arc.keepOne'), true);
    renderMedia();
    return;
  }
  if (S.edit && ids.concat(citersOf(sid)).includes(S.edit.id)) {
    toast(t('finishFirst')); // the record form would rewrite that person's sources when saving
    renderMedia();
    return;
  }
  const before = citersOf(sid);
  beginAction('hist.tag');
  try {
    await inBatch(async () => {
      const { tags: _, ...src } = S.sources.get(sid);
      const placed = tags.filter((x) => hasPlace(x) && ids.includes(x.id));
      await opSet('sources', sid, placed.length ? { ...src, tags: placed } : src);
      for (const id of ids.filter((x) => !before.includes(x))) {
        const p = P(id);
        await opSet('people', id, withCitations(p, [...listOf(p.citations), { id: rid('c'), source: sid, fact: '' }]));
      }
      for (const id of before.filter((x) => !ids.includes(x))) {
        const p = P(id);
        await opSet('people', id, withCitations(p, listOf(p.citations).filter((c) => c.source !== sid)));
      }
    });
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

/** Confirms the faces recognised of people `ids` (all of them without `ids`): markers placed where they are. */
export async function acceptGuesses(ids) {
  const m = item();
  if (!m || !S.canWrite) return;
  const list = guessesOf(m).filter((g) => !ids || ids.includes(g.id));
  if (!list.length) return;
  const who = new Set(list.map((g) => g.id));
  // A person already on the image without a marker: the marker is theirs now
  const tags = [...tagsOf(m).filter((x) => !who.has(x.id) || hasPlace(x)), ...list.map((g) => ({ id: g.id, x: g.x, y: g.y }))];
  pin = null;
  await saveTags(tags);
}

/** Dismisses the suggestion of person `id` on the image shown. */
export function dismissGuess(id) {
  const m = item();
  if (!m) return;
  dismissed.add(m.photo + '|' + id);
  renderMedia();
}
