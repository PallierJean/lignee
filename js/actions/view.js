/** Display actions: focus person, tabs, generations, zoom, panel, theme, language, undo / redo. */
import { ZOOMS, narrow } from '../config.js';
import { S, savePrefs } from '../state.js';
import { $ } from '../utils/dom.js';
import { undoAction, redoAction } from '../services/storage.js';
import { renderTree, scrollToFocus, treeMargins } from '../tree/render.js';
import { renderAll, renderSide, afterData, renderStageGallery } from '../ui/render.js';
import { renderControls } from '../ui/header.js';
import { captureDraft } from '../ui/form.js';
import { toast, reportError } from '../ui/toast.js';
import { t, getLang, setLang } from '../i18n.js';
import { updatePrintInfo } from '../ui/print.js';
import { applyTheme } from '../ui/theme.js';
import { askLeave } from '../ui/leave-dlg.js';

/** On a phone, opens the side panel over the tree; the Back button closes it. */
export function showSide() {
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
/** Shows the whole gallery in place of the tree, or the tree again. */
export function toggleStageGallery() {
  S.gallery = !S.gallery;
  renderControls();
  renderStageGallery();
}

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

/** Shows the tree as round photos, the name on hover, or as full cards. */
export function togglePhotos() {
  S.photos = !S.photos;
  S.scrollPending = true;
  savePrefs();
  renderControls();
  renderTree();
}

/** Turns tree filter `kind` on ('living', 'certificate'), or off if it is already on: the other cards fade. */
export function toggleFilter(kind) {
  S.filter = S.filter === kind ? '' : kind;
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
