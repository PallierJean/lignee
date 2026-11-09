/**
 * User actions: navigating the tree, adding, editing and
 * deleting people, display.
 */
import { ZOOMS, narrow } from './config.js';
import { S, savePrefs } from './state.js';
import { $ } from './utils/dom.js';
import { rid } from './utils/helpers.js';
import { P, photoOf, photoSrc, partnersOf, childrenOf, unionDeathEnd, currentSituation, reindex, birthSurname, eventsOf, sourcesOf, mediaList, unionType, isDead } from './model/people.js';
import { opSet, opUpdate, opDelete, inBatch, beginAction, commitAction, undoAction, redoAction } from './services/storage.js';
import { savePerson, closeUnionsAtDeath } from './services/person-save.js';
import { draftError } from './model/draft.js';
import { relationship } from './model/kinship.js';
import { mergedData } from './model/duplicates.js';
import { renamePatches } from './model/places.js';
import { deathDifferences } from './model/insee.js';
import { inseeMatch, ignoreInsee, confirmInsee } from './services/insee.js';
import { ignorePair } from './services/dup-ignore.js';
import { renderTree, scrollToFocus, scrollToPerson, treeMargins } from './tree/render.js';
import { renderAll, renderSide, renderRecord, afterData } from './ui/render.js';
import { renderHeader, renderControls } from './ui/header.js';
import { blankDraft, captureDraft, focusFirstField } from './ui/form.js';
import { toast, reportError } from './ui/toast.js';
import { t, getLang, setLang } from './i18n.js';
import { updatePrintInfo } from './ui/print.js';
import { applyTheme } from './ui/theme.js';
import { renderPersonDlg } from './ui/person-dlg.js';
import { photoFromFile, DOCUMENT_SIDE } from './utils/image.js';
import { cropPhoto } from './ui/crop.js';
import { askLeave, closeLeave } from './ui/leave-dlg.js';

/** On a phone, opens the side panel over the tree; the Back button closes it. */
function showSide() {
  if (!narrow() || S.sheet) return;
  S.sheet = true;
  history.pushState({ sheet: true }, '');
  renderControls();
}

/** Closes the side panel opened over the tree on a phone. `fromHistory`: the Back button already went back. */
export function closeSheet(fromHistory) {
  if (!S.sheet) return;
  S.sheet = false;
  if (!fromHistory && history.state && history.state.sheet) history.back();
  renderControls();
}

/* ---------- Navigation and display ---------- */

export function setFocus(id, fromList) {
  if (!S.people.has(id)) return;
  if (S.edit) {
    if (S.edit.id === id) setTab('record');
    else askLeave(id, () => setFocus(id, fromList));
    return;
  }
  const same = id === S.focus;
  S.focus = id;
  S.confirmDel = false;
  S.tab = 'record';
  savePrefs();
  if (!same) S.scrollPending = true;
  renderAll();
  if (fromList) showSide();
}

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

export function setTab(tab) {
  S.tab = tab;
  if (narrow()) showSide();
  else if (!S.panel) togglePanel();
  renderSide();
  if (tab === 'register' && !narrow()) {
    const search = $('#q');
    if (search) search.focus({ preventScroll: true });
  }
}

/** Number of generations shown: kind = 'up' (ancestors) or 'down' (descendants). */
export function setGenerations(kind, n) {
  S[kind] = n;
  savePrefs();
  S.scrollPending = true;
  renderControls();
  renderTree();
  requestAnimationFrame(scrollToFocus);
}

/** Zoom in (+1) or out (-1), keeping the centre of the view. */
export function zoomBy(step) {
  const canvas = $('#canvas');
  // Tree point at the centre of the view, kept there after zooming
  let m = treeMargins();
  const cx = (canvas.scrollLeft + canvas.clientWidth / 2 - m.x) / S.zoom;
  const cy = (canvas.scrollTop + canvas.clientHeight / 2 - m.y) / S.zoom;
  const i = Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(S.zoom) + step));
  S.zoom = ZOOMS[i];
  savePrefs();
  renderControls();
  renderTree();
  m = treeMargins();
  canvas.scrollLeft = m.x + cx * S.zoom - canvas.clientWidth / 2;
  canvas.scrollTop = m.y + cy * S.zoom - canvas.clientHeight / 2;
}

/** Switches between the view centred on a person and the whole tree, flat. */
export function toggleFull() {
  S.full = S.fan ? true : !S.full;
  S.fan = false;
  savePrefs();
  S.scrollPending = true;
  renderControls();
  renderTree();
  requestAnimationFrame(scrollToFocus);
}

/** Switches between the tree and the fan chart. */
export function toggleFan() {
  S.fan = !S.fan;
  savePrefs();
  S.scrollPending = true;
  renderControls();
  renderTree();
  requestAnimationFrame(scrollToFocus);
}

/** Shows or removes the direct-line halo. */
export function toggleLine() {
  S.line = !S.line;
  savePrefs();
  renderControls();
  renderTree();
}

/** Shows or hides the record/register panel: the tree takes the full width. */
export function togglePanel() {
  if (narrow()) {
    if (S.sheet) closeSheet();
    else showSide();
    return;
  }
  S.panel = !S.panel;
  savePrefs();
  renderControls();
  renderTree(); // its margins follow the canvas width
  requestAnimationFrame(recenter);
}

export function recenter() {
  S.scrollPending = true;
  scrollToFocus();
}

/** Changes the colour theme; redraws what reads colours at display time (map…). */
export function setTheme(theme) {
  S.theme = theme;
  savePrefs();
  applyTheme();
  renderAll(true);
}

/** Changes the interface text size; the panels re-layout. */
export function setTextSize(size) {
  S.textSize = size;
  savePrefs();
  applyTheme();
  renderAll(true);
}

/** Switches the interface between French and English, without losing the input in progress. */
export function toggleLang() {
  captureDraft();
  setLang(getLang() === 'fr' ? 'en' : 'fr');
  renderAll(true);
  if (!$('#printDlg').hidden) updatePrintInfo();
}

/* ---------- Undo / redo ---------- */

async function runHistory(run, doneKey) {
  if (S.busy) return;
  if (S.edit) {
    toast(t('finishFirst'));
    return;
  }
  S.busy = true;
  let action = null;
  try {
    action = await run();
  } catch (e) {
    reportError(e);
  }
  S.busy = false;
  if (action) {
    const focus = doneKey === 'hist.undone' ? action.focus : action.after;
    if (focus && S.people.has(focus)) S.focus = focus;
    S.scrollPending = true;
    savePrefs();
    toast(t(doneKey, t(action.label)));
  }
  afterData();
}

export const undo = () => runHistory(undoAction, 'hist.undone');
export const redo = () => runHistory(redoAction, 'hist.redone');

/* ---------- Analysis ---------- */

export function setAnalysisView(view) {
  S.analysis = view;
  renderSide();
}

export function setTimeScope(family) {
  S.timeFamily = family;
  renderSide();
}

/** Anniversaries: previous (-1) or next (+1) month. */
export function shiftMonth(step) {
  const current = S.calMonth || new Date().getMonth() + 1;
  S.calMonth = ((current - 1 + step + 12) % 12) + 1;
  renderSide();
}

/** Opens the kinship view, with person `id` first. */
export function openKin(id) {
  S.kinA = id;
  S.analysis = 'kin';
  S.tab = 'analysis';
  renderSide();
  showSide();
}

export function setKin(side, id) {
  S[side] = id;
  if (S.kinShow) renderTree();
  renderSide();
}

/** Highlights the path in the whole tree, the only view where it is surely visible in full. */
export function showKin() {
  const { path } = relationship(S.kinA, S.kinB);
  if (!path.length) return;
  if (!S.kinShow) S.kinWasFull = S.full;
  S.kinShow = true;
  S.full = true;
  S.fan = false;
  renderControls();
  renderTree();
  renderSide();
  requestAnimationFrame(() => scrollToPerson(path[Math.floor(path.length / 2)]));
}

export function hideKin() {
  S.kinShow = false;
  S.full = S.kinWasFull;
  S.scrollPending = true;
  renderControls();
  renderTree();
  renderSide();
  requestAnimationFrame(scrollToFocus);
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
    photo: photoSrc(x.photo) ? x.photo : '', removed: false,
  }));
  const media = mediaList(p).filter((x) => photoSrc(x.photo))
    .map((x) => ({ tags: [], ...x, ...texts(x, ['title', 'date', 'note']), removed: false }));
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
      added.push({ id: rid('m'), photo: await photoFromFile(file, DOCUMENT_SIDE), title: file.name.replace(/\.[^.]+$/, ''), date: '', note: '', tags: [], removed: false });
    } catch (err) {
      toast(err.message, true);
    }
  }
  if (!S.edit || S.edit.token !== token) return;
  captureDraft();
  S.edit.media.push(...added);
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

/* ---------- Duplicates ---------- */

/** "Not a duplicate": the pair is no longer suggested, even after a reload. */
export function ignoreDuplicate(key) {
  ignorePair(key);
  renderSide();
}

/** Merges `drop` into `keep`: links, unions and children move to `keep`, then `drop` disappears. */
export async function mergePeople(keep, drop) {
  if (!S.canWrite || S.busy || !S.people.has(keep) || !S.people.has(drop)) return;
  if (S.edit) {
    toast(t('finishFirst'));
    return;
  }
  S.busy = true;
  beginAction('hist.merge');
  try {
    await inBatch(async () => {
      const unionIds = new Map();
      for (const [uid, u] of [...S.unions]) {
        if (u.a !== drop && u.b !== drop) continue;
        const other = u.a === drop ? u.b : u.a;
        const twin = [...S.unions].find(([k, x]) => k !== uid && ((x.a === keep && x.b === other) || (x.a === other && x.b === keep)));
        if (other === keep) await opDelete('unions', uid);
        else if (twin) {
          const [tid, tu] = twin;
          unionIds.set(uid, tid);
          await opUpdate('unions', tid, {
            type: tu.type || u.type || '', date: tu.date || u.date || '', place: tu.place || u.place || '',
            end: tu.end || u.end || '', endDate: tu.endDate || u.endDate || '',
            cause: tu.cause || u.cause || '', formerId: tu.formerId || u.formerId || '',
          });
          await opDelete('unions', uid);
        } else await opUpdate('unions', uid, u.a === drop ? { a: keep } : { b: keep });
      }
      for (const [uid, u] of [...S.unions]) {
        if (u.formerId === drop) await opUpdate('unions', uid, { formerId: keep });
      }
      for (const [id, p] of [...S.people]) {
        if (id === drop || id === keep) continue;
        const patch = {};
        if (p.fatherId === drop) patch.fatherId = keep;
        if (p.motherId === drop) patch.motherId = keep;
        // Identifications on photos: they follow the person kept
        const tagged = (m) => (Array.isArray(m.tags) ? m.tags : []);
        if (mediaList(p).some((m) => tagged(m).some((x) => x.id === drop))) {
          patch.media = mediaList(p).map((m) => ({ ...m, tags: tagged(m).map((x) => (x.id === drop ? { ...x, id: keep } : x)) }));
        }
        // Marriage sources carried by a spouse: they follow the union kept
        const moved = (s) => String(s.fact || '').startsWith('union:') && unionIds.has(s.fact.slice(6));
        if (sourcesOf(p).some(moved)) {
          patch.sources = sourcesOf(p).map((s) => (moved(s) ? { ...s, fact: 'union:' + unionIds.get(s.fact.slice(6)) } : s));
        }
        if (Object.keys(patch).length) await opUpdate('people', id, patch);
      }
      const merged = mergedData(P(keep), P(drop), unionIds);
      merged.updatedAt = Date.now();
      for (const key of ['fatherId', 'motherId']) if (merged[key] === keep || merged[key] === drop) merged[key] = null;
      await opSet('people', keep, merged);
      await opDelete('people', drop);
    });
    if (S.focus === drop) S.focus = keep;
    commitAction();
    S.busy = false;
    S.scrollPending = true;
    savePrefs();
    afterData();
    toast(t('dup.merged'));
  } catch (e) {
    reportError(e);
    commitAction();
    S.busy = false;
    afterData();
  }
}

/**
 * Renames a place everywhere it is cited (births, deaths, events, unions); undone in one go.
 * A record being edited follows too: saving it doesn't bring the old place back.
 */
export async function renamePlace(from, to) {
  to = String(to || '').trim();
  if (!S.canWrite || S.busy) return;
  if (!to || to === from) {
    toast(t('pl.unchanged'));
    return;
  }
  const patches = renamePatches(from, to);
  if (!patches.length) return;
  if (S.edit) {
    captureDraft(); // the form stays in the page, hidden: its input first, then the new place
    const same = (x) => String(x || '').trim() === from;
    const d = S.edit.draft;
    if (same(d.birthPlace)) d.birthPlace = to;
    if (same(d.deathPlace)) d.deathPlace = to;
    for (const x of [...S.edit.unions, ...S.edit.events]) if (same(x.place)) x.place = to;
  }
  S.busy = true;
  beginAction('hist.place');
  try {
    await inBatch(async () => {
      for (const x of patches) await opUpdate(x.collection, x.id, x.patch);
    });
  } catch (e) {
    reportError(e);
    return;
  } finally {
    commitAction();
    S.busy = false;
    afterData();
    if (S.edit) renderRecord(true); // the hidden form takes its draft back, with the new place
  }
  toast(t('pl.renamed', patches.length));
}

/* ---------- INSEE deaths ---------- */

/** Reportable differences between a record and its INSEE certificate (sure or likely match). */
export function inseeDifferences(id) {
  const m = inseeMatch(id);
  return m && m.level !== 'lead' ? deathDifferences(id, m.act) : [];
}

/** Reports difference no. `i` of its INSEE certificate into the record, or all of them (no `i`). */
export async function applyInsee(id, i) {
  if (!S.canWrite || S.busy) return;
  if (S.edit) {
    toast(t('finishFirst'));
    return;
  }
  const diffs = inseeDifferences(id).filter((x, k) => x.patch && (i === undefined || k === i));
  if (!diffs.length) return;
  const patch = Object.assign({}, ...diffs.map((x) => x.patch));
  const dies = patch.deceased && !isDead(P(id));
  S.busy = true;
  beginAction('hist.insee');
  try {
    await inBatch(async () => {
      await opUpdate('people', id, patch);
      if (dies || patch.deathDate) await closeUnionsAtDeath(id);
    });
  } catch (e) {
    reportError(e);
    return;
  } finally {
    commitAction();
    S.busy = false;
    afterData();
  }
  toast(t('ins.applied', diffs.length));
}

/** "That's them": this record's INSEE lead becomes its certificate. */
export function confirmInseeOf(id) {
  confirmInsee(id);
  renderSide();
}

/** Stops showing this record's INSEE differences. */
export function ignoreInseeOf(id) {
  ignoreInsee(id);
  renderSide();
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
