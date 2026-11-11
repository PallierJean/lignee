/** Editing actions: the form and its draft, saving, deleting, the example family. */
import { S, savePrefs } from '../state.js';
import { $ } from '../utils/dom.js';
import { rid } from '../utils/helpers.js';
import { P, photoOf, photoSrc, partnersOf, childrenOf, unionDeathEnd, currentSituation, reindex, birthSurname, eventsOf, sourcesOf, mediaList, unionType } from '../model/people.js';
import { opUpdate, opDelete, inBatch, beginAction, commitAction } from '../services/storage.js';
import { savePerson } from '../services/person-save.js';
import { draftError } from '../model/draft.js';
import { renderTree } from '../tree/render.js';
import { renderSide, renderRecord, afterData } from '../ui/render.js';
import { renderHeader } from '../ui/header.js';
import { blankDraft, captureDraft, focusFirstField } from '../ui/form.js';
import { toast, reportError } from '../ui/toast.js';
import { t } from '../i18n.js';
import { renderPersonDlg } from '../ui/person-dlg.js';
import { photoFromFile, DOCUMENT_SIDE } from '../utils/image.js';
import { cropPhoto } from '../ui/crop.js';
import { askLeave, closeLeave } from '../ui/leave-dlg.js';
import { showSide, setFocus, setTab } from './view.js';
import { openMedia } from '../ui/media.js';
import { mediaGroups } from '../ui/record.js';

/** Edits person `id` from outside their record (person dialog). */
export function editPerson(id) {
  if (S.edit && S.edit.id !== id) return askLeave(id, () => editPerson(id), true);
  setFocus(id);
  if (!S.edit) startEdit(id);
}

/** Answer to the "record being edited" dialog: back to the form, or discard it and go on. */
export function leaveEdit(drop) {
  const go = closeLeave(drop);
  if (!go) return setTab('record');
  cancelEdit();
  go();
}

/* ---------- Form ---------- */

function openEdit(edit) {
  S.edit = Object.assign({ token: rid('e'), error: '' }, edit);
  S.tab = 'record';
  S.confirmDel = false;
  renderSide(true);
  showSide();
  focusFirstField();
}

/** Empty union row of the form. */
function draftUnion(other) {
  return { uid: null, other, type: '', date: '', place: '', end: '', endDate: '', cause: '', formerId: '', removed: false };
}

export function startNew() {
  if (!S.canWrite) return;
  if (S.edit) {
    toast(t('finishFirst'));
    return;
  }
  openEdit({ id: null, rel: null, of: null, draft: blankDraft(), unions: [], events: [], sources: [], media: [] });
}

/**
 * Adding a relative of person `of`: rel = 'father' | 'mother' | 'child' | 'spouse' | 'sibling'.
 * For a child, `withId` is the other parent; by default, the last spouse.
 */
export function startAdd(rel, of, withId) {
  if (!S.canWrite || !S.people.has(of)) return;
  if (S.edit) {
    toast(t('finishFirst'));
    return;
  }
  const o = P(of);
  const d = blankDraft();
  const unions = [];

  if (rel === 'father') {
    d.sex = 'M';
    d.surname = o.surname || '';
  } else if (rel === 'mother') {
    d.sex = 'F';
  } else if (rel === 'spouse') {
    d.sex = o.sex === 'M' ? 'F' : o.sex === 'F' ? 'M' : 'U';
    unions.push(draftUnion(of));
  } else if (rel === 'child') {
    const last = partnersOf(of).pop();
    const partner = withId || (last ? last.id : '');
    if (o.sex === 'F') {
      d.motherId = of;
      d.fatherId = partner;
    } else {
      d.fatherId = of;
      d.motherId = partner;
    }
    d.surname = birthSurname(d.fatherId, d.motherId);
  } else if (rel === 'sibling') {
    // Sibling: same parents as the person (editable for a half-sibling)
    d.fatherId = o.fatherId && S.people.has(o.fatherId) ? o.fatherId : '';
    d.motherId = o.motherId && S.people.has(o.motherId) ? o.motherId : '';
    // Shared birth surname (not a married sister's married name)
    d.surname = birthSurname(d.fatherId, d.motherId) || (o.sex === 'F' ? o.maidenName || o.surname : o.surname) || '';
  }
  openEdit({ id: null, rel, of, draft: d, unions, events: [], sources: [], media: [] });
}

export function startEdit(id) {
  const p = P(id);
  if (!p || !S.canWrite) return;
  const d = blankDraft();
  for (const key of Object.keys(d)) {
    if (key !== 'deceased' && key !== 'sex') d[key] = p[key] == null ? '' : String(p[key]);
  }
  d.sex = p.sex || 'U';
  d.photo = photoOf(p) ? p.photo : '';
  d.deceased = !!p.deceased && !String(p.deathDate || '').trim();
  if (d.sex === 'F' && !d.maidenName.trim()) d.maidenName = birthSurname(d.fatherId, d.motherId);
  const unions = partnersOf(id)
    .filter((x) => x.uid && S.unions.has(x.uid))
    .map((x) => {
      const u = S.unions.get(x.uid);
      // By default, the union stops at the death of the first spouse
      const death = unionDeathEnd(p, P(x.id));
      const end = u.end || (death === null ? '' : 'death');
      return {
        uid: x.uid, other: x.id, type: unionType(u), date: u.date || '', place: u.place || '',
        end, endDate: u.endDate || (end === 'death' && death) || '', cause: u.cause || '', formerId: u.formerId || '', removed: false,
        orig: { type: u.type || '', date: u.date || '', place: u.place || '', end: u.end || '', endDate: u.endDate || '', cause: u.cause || '', formerId: u.formerId || '' },
      };
    });
  // The record shows the current situation: the unions', if it has changed since
  d.situation = currentSituation(id);
  // Strings, even if the record comes from a malformed imported file
  const texts = (x, keys) => Object.fromEntries(keys.map((k) => [k, x[k] == null ? '' : String(x[k])]));
  const events = eventsOf(p).map((x) => ({ ...x, ...texts(x, ['date', 'place', 'note']), removed: false }));
  const sources = sourcesOf(p).map((x) => ({
    ...x, kind: 'other', ...texts(x, ['fact', 'title', 'place', 'ref', 'note']), ...(x.kind ? { kind: String(x.kind) } : {}),
    photo: photoSrc(x.photo) ? x.photo : '', back: photoSrc(x.photo) && photoSrc(x.back) ? x.back : '', removed: false,
  }));
  const media = mediaList(p).filter((x) => photoSrc(x.photo))
    .map((x) => ({ tags: [], ...x, ...texts(x, ['title', 'date', 'note']), back: photoSrc(x.back) ? x.back : '', removed: false }));
  openEdit({ id, rel: null, of: null, draft: d, unions, events, sources, media });
}

export function cancelEdit() {
  S.edit = null;
  S.busy = false;
  renderSide(true);
}

export function addDraftUnion(otherId) {
  if (!S.edit) return;
  captureDraft();
  S.edit.unions.push(draftUnion(otherId));
  renderSide(true);
}

export function removeDraftUnion(i) {
  captureDraft();
  if (S.edit && S.edit.unions[i]) S.edit.unions[i].removed = true;
  renderSide(true);
}

/** Images chosen in the form: added to the draft's gallery. */
export async function addDraftMedia(files) {
  if (!S.edit) return;
  const token = S.edit.token;
  const added = [];
  for (const file of files) {
    try {
      added.push({ id: rid('m'), photo: await photoFromFile(file, DOCUMENT_SIDE), back: '', title: file.name.replace(/\.[^.]+$/, ''), date: '', note: '', tags: [], removed: false });
    } catch (err) {
      toast(err.message, true);
    }
  }
  if (!S.edit || S.edit.token !== token) return;
  captureDraft();
  S.edit.media.push(...added);
  renderSide(true);
}

/** Back of gallery image `i` in the form: a contract's second side, a photo's annotated back. */
export async function setDraftMediaBack(i, file) {
  if (!S.edit || !S.edit.media[i]) return;
  const token = S.edit.token;
  let back;
  try {
    back = await photoFromFile(file, DOCUMENT_SIDE);
  } catch (err) {
    toast(err.message, true);
    return;
  }
  if (!S.edit || S.edit.token !== token || !S.edit.media[i]) return;
  captureDraft();
  S.edit.media[i].back = back;
  renderSide(true);
}

export function removeDraftMediaBack(i) {
  if (!S.edit || !S.edit.media[i]) return;
  captureDraft();
  S.edit.media[i].back = '';
  renderSide(true);
}

export function removeDraftMedia(i) {
  captureDraft();
  if (S.edit && S.edit.media[i]) S.edit.media[i].removed = true;
  renderSide(true);
}

export function addDraftEvent() {
  if (!S.edit) return;
  captureDraft();
  S.edit.events.push({ id: rid('e'), type: 'baptism', date: '', place: '', note: '', removed: false });
  renderSide(true);
}

export function removeDraftEvent(i) {
  captureDraft();
  if (S.edit && S.edit.events[i]) S.edit.events[i].removed = true;
  renderSide(true);
}

export function addDraftSource() {
  if (!S.edit) return;
  captureDraft();
  S.edit.sources.push({ id: rid('s'), fact: '', kind: 'birth', title: '', place: '', ref: '', note: '', photo: '', removed: false });
  renderSide(true);
}

/** Cites a source already in the tree (shared): its document is the same for every record citing it. */
export function citeDraftSource(sid) {
  const src = S.sources.get(sid);
  if (!S.edit || !src) return;
  captureDraft();
  const text = (k) => (src[k] == null ? '' : String(src[k]));
  S.edit.sources.push({
    id: rid('s'), source: sid, fact: '', kind: src.kind || 'other', title: text('title'), place: text('place'),
    ref: text('ref'), note: text('note'), photo: src.photo || '', back: src.photo && src.back ? src.back : '', removed: false,
  });
  renderSide(true);
}

export function removeDraftSource(i) {
  captureDraft();
  if (S.edit && S.edit.sources[i]) S.edit.sources[i].removed = true;
  renderSide(true);
}

/** Redraws the form: an event label changed in the list of facts. */
export function refreshDraft() {
  captureDraft();
  renderSide(true);
}

/** A source's document (photo of a certificate): downscaled less than a portrait, to stay readable. */
export async function setDraftSourcePhoto(i, file) {
  if (!S.edit || !file) return;
  const token = S.edit.token;
  let photo;
  try {
    photo = await photoFromFile(file, DOCUMENT_SIDE);
  } catch (err) {
    toast(err.message, true);
    return;
  }
  if (!S.edit || S.edit.token !== token) return;
  captureDraft();
  S.edit.sources[i].photo = photo;
  renderSide(true);
}

export function removeDraftSourcePhoto(i) {
  if (!S.edit) return;
  captureDraft();
  S.edit.sources[i].photo = '';
  S.edit.sources[i].back = ''; // a back alone means nothing
  renderSide(true);
}

/** Back of source `i`'s document: the second side of a marriage contract or of a certificate. */
export async function setDraftSourceBack(i, file) {
  if (!S.edit || !S.edit.sources[i] || !file) return;
  const token = S.edit.token;
  let back;
  try {
    back = await photoFromFile(file, DOCUMENT_SIDE);
  } catch (err) {
    toast(err.message, true);
    return;
  }
  if (!S.edit || S.edit.token !== token || !S.edit.sources[i]) return;
  captureDraft();
  S.edit.sources[i].back = back;
  renderSide(true);
}

export function removeDraftSourceBack(i) {
  if (!S.edit || !S.edit.sources[i]) return;
  captureDraft();
  S.edit.sources[i].back = '';
  renderSide(true);
}

/** Photo chosen in the form: cropped to portrait, then kept in the draft. */
export async function setDraftPhoto(file) {
  if (!S.edit || !file) return;
  const token = S.edit.token;
  let photo;
  try {
    photo = await cropPhoto(file);
  } catch (err) {
    toast(err.message, true);
    return;
  }
  if (!photo) return; // crop cancelled
  if (!S.edit || S.edit.token !== token) return; // form closed in the meantime
  captureDraft();
  S.edit.draft.photo = photo;
  renderSide(true);
}

export function removeDraftPhoto() {
  if (!S.edit) return;
  captureDraft();
  S.edit.draft.photo = '';
  renderSide(true);
}

export async function submitEdit() {
  if (S.busy || !S.edit) return;
  captureDraft();
  const e = S.edit;
  const error = draftError(e);
  if (error) {
    e.error = error;
    renderSide(true);
    if (error === 'f.errName') focusFirstField();
    return;
  }

  S.busy = true;
  const button = $('#f-submit');
  if (button) {
    button.disabled = true;
    button.textContent = t('f.saving');
  }

  // Images added in this form: once saved, the viewer opens on them to identify the people
  const had = new Set(e.id ? mediaList(P(e.id)).map((m) => m.id) : []);
  const added = e.media.filter((x) => !x.removed && !had.has(x.id)).map((x) => x.id);

  beginAction(e.id ? 'hist.edit' : 'hist.add');
  try {
    const id = await inBatch(() => savePerson(e));

    S.focus = e.rel && S.people.has(e.of) ? e.of : id;
    commitAction();
    S.edit = null;
    S.busy = false;
    S.scrollPending = true;
    savePrefs();
    afterData();
    toast(t(e.id ? 'f.saved' : 'f.added'));
    if (added.length && S.canWrite && mediaList(P(id)).some((m) => m.id === added[0])) {
      mediaGroups.set('new:' + id, added.map((m) => ({ owner: id, id: m })));
      openMedia(id, added[0], 'new:' + id);
    }
  } catch (err) {
    reportError(err);
    commitAction();
    S.busy = false;
    const b = $('#f-submit');
    if (b) {
      b.disabled = false;
      b.textContent = t('save');
    }
    reindex();
    renderTree();
  }
}

/* ---------- Deletion ---------- */

/** Shows (or removes) the delete confirmation for record `id`: panel or person dialog. */
export function confirmDelete(show, id = S.focus) {
  S.confirmDel = show ? id : false;
  renderRecord();
  renderPersonDlg();
}

/** Deletes record `id` (focus person or not, even while being edited). */
export async function doDelete(id) {
  if (!S.canWrite || !S.people.has(id)) return;
  if (S.edit && S.edit.id === id) S.edit = null; // deleted from its own form: the input is abandoned
  const p = P(id);
  const kids = childrenOf(id).slice();
  const partners = partnersOf(id);
  const next = [p.fatherId, p.motherId, kids[0], partners[0] && partners[0].id]
    .find((x) => x && x !== id && S.people.has(x)) || null;

  beginAction('hist.delete');
  try {
    await inBatch(async () => {
      for (const k of kids) {
      const c = P(k);
      if (!c) continue;
      const patch = {};
      if (c.fatherId === id) patch.fatherId = null;
      if (c.motherId === id) patch.motherId = null;
        await opUpdate('people', k, patch);
      }
      for (const [uid, u] of [...S.unions]) {
        if (u.a === id || u.b === id) await opDelete('unions', uid);
      }
      await opDelete('people', id);
    });
    S.confirmDel = false;
    if (S.focus === id) S.focus = next; // another record deleted: the focus person stays
    commitAction();
    S.scrollPending = true;
    savePrefs();
    afterData();
    toast(t('deleted'));
  } catch (e) {
    reportError(e);
    commitAction();
    S.confirmDel = false;
    afterData();
  }
}

/* ---------- Example family ---------- */

/** Closes an information banner in this browser: for good, or for a few days for the local mode warning. */
export function closeBanner(kind) {
  S.closed[kind] = kind === 'local' ? Date.now() : true;
  savePrefs();
  renderHeader();
}

export function confirmRemoveExamples(show) {
  S.confirmEx = show;
  renderHeader();
}

export async function removeExamples() {
  const examples = new Set([...S.people].filter(([, p]) => p.example).map(([k]) => k));
  const unionIds = [...S.unions]
    .filter(([, u]) => u.example || examples.has(u.a) || examples.has(u.b))
    .map(([k]) => k);
  const linkedPeople = [...S.people]
    .filter(([k, p]) => !examples.has(k) && (examples.has(p.fatherId) || examples.has(p.motherId)));
  S.confirmEx = false;

  beginAction('hist.examples');
  try {
    await inBatch(async () => {
      for (const [k, p] of linkedPeople) {
        const patch = {};
        if (examples.has(p.fatherId)) patch.fatherId = null;
        if (examples.has(p.motherId)) patch.motherId = null;
        await opUpdate('people', k, patch);
      }
      for (const uid of unionIds) await opDelete('unions', uid);
      for (const id of examples) await opDelete('people', id);
    });
    S.focus = null;
    commitAction();
    afterData();
    toast(t('ex.removed'));
  } catch (e) {
    reportError(e);
    commitAction();
    afterData();
  }
}
