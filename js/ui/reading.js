/**
 * Reading a document: its image on the left, the text read on the right, line by line. Hovering a
 * line (or editing it) lights it up on the image. The text comes from the reading done on this
 * computer (services/htr.js); each line can be corrected, and a corrected line counts as checked.
 * Elsewhere than on the computer that reads, the text read earlier is shown and corrected the same.
 */
import { S } from '../state.js';
import { $, esc, setHTML } from '../utils/dom.js';
import { t } from '../i18n.js';
import { photoSrc, SOURCE_KINDS } from '../model/people.js';
import { readingOf } from '../model/sources.js';
import { opUpdate, beginAction, commitAction } from '../services/storage.js';
import { checkHtr, canRead, readPhoto } from '../services/htr.js';
import { emit } from '../services/notify.js';
import { toast, reportError } from './toast.js';

/** A line the model wasn't sure of: shown "to check" until corrected. */
export const DOUBT = 0.6;

let cur = null; // { sid, back, busy }

const sourceOf = () => (cur ? S.sources.get(cur.sid) : null);
const keyOf = (back) => (back ? 'backText' : 'text');
const imageOf = (src, back) => (src ? src[back ? 'back' : 'photo'] : '');

/** Lines read, as they will be saved. */
const cleanLines = (lines) => lines.map((l) => ({ box: l.box, text: String(l.text || ''), conf: l.conf, ...(l.ok ? { ok: true } : {}) }));

export function renderReading() {
  if (!cur) return;
  // Not while a line is being typed: the cursor would be lost
  const active = document.activeElement;
  if (active && active.dataset && active.dataset.rdLine !== undefined && !cur.busy && $('#readCard').contains(active)) return;
  const src = sourceOf();
  if (!src || !photoSrc(imageOf(src, cur.back))) {
    closeReading();
    return;
  }
  const ref = imageOf(src, cur.back);
  const reading = readingOf(src, cur.back);
  const lines = reading ? reading.lines : [];
  const title = src.title || t('src.' + (SOURCE_KINDS.includes(src.kind) ? src.kind : 'other'));
  const sides = photoSrc(src.back)
    ? `<div class="seg" role="group" aria-label="${t('med.sides')}">`
      + `<button type="button" data-act="read-side" data-back="0" aria-pressed="${!cur.back}">${t('med.front')}</button>`
      + `<button type="button" data-act="read-side" data-back="1" aria-pressed="${cur.back}">${t('med.back')}</button></div>`
    : '';
  // Each line read, as an invisible frame on the image: it lights up with its line of text
  const boxes = lines.map((l, i) => `<span class="rd-box" data-line="${i}" data-style="left:${l.box[0] * 100}%;top:${l.box[1] * 100}%;width:${l.box[2] * 100}%;height:${l.box[3] * 100}%"></span>`).join('');
  const reader = S.canWrite && canRead(ref);
  let text;
  if (cur.busy) {
    text = `<p class="rd-busy" role="status">${t('htr.busy')}</p>`;
  } else if (reading) {
    const doubt = lines.filter((l) => !l.ok && l.conf < DOUBT).length;
    text = `<p class="hint">${t('htr.about', lines.length, doubt)}</p>`
      + `<ol class="rd-lines">${lines.map((l, i) => {
        const cls = l.ok ? 'ok' : l.conf < DOUBT ? 'doubt' : '';
        return `<li data-line="${i}"${cls ? ` class="${cls}"` : ''}><input type="text" data-rd-line="${i}" value="${esc(l.text)}" aria-label="${esc(t('htr.line', i + 1))}"${S.canWrite ? '' : ' readonly'} spellcheck="false"></li>`;
      }).join('')}</ol>`
      + (reader ? `<p class="rd-again"><button class="link" type="button" data-act="read-run">${t('htr.again')}</button></p>` : '');
  } else if (reader) {
    text = `<p>${t('htr.none')}</p><p><button class="btn primary" type="button" data-act="read-run">${t('htr.run')}</button></p><p class="hint">${t('htr.runHint')}</p>`;
  } else {
    text = `<p class="hint">${t('htr.unavailable')}</p>`;
  }
  setHTML($('#readCard'), `<div class="sheet-head"><h2 id="rdTitle">${esc(title)}</h2>${sides}`
    + `<button class="icon-btn" type="button" data-act="read-close" aria-label="${t('close')}">×</button></div>`
    + `<div class="rd-body"><div class="rd-pic"><img src="${esc(photoSrc(ref))}" alt="${esc(title)}">${boxes}</div>`
    + `<div class="rd-text">${text}</div></div>`);
}

/** Opens the reading of source `sid`, on its front (or its back if `back`). */
export function openReading(sid, back = false) {
  if (!S.sources.has(sid)) return;
  cur = { sid, back: Boolean(back), busy: false };
  $('#readDlg').hidden = false;
  renderReading();
  // Whether this computer can read is known after asking the server once
  checkHtr().then(() => renderReading());
}

export function closeReading() {
  cur = null;
  $('#readDlg').hidden = true;
}

/** Front or back. */
export function readingSide(back) {
  if (!cur || cur.busy) return;
  cur.back = Boolean(back);
  renderReading();
}

/** Lights up line `i` on the image and in the list (-1: none). */
export function lightLine(i) {
  for (const el of document.querySelectorAll('#readCard [data-line]')) el.classList.toggle('on', +el.dataset.line === i);
}

/**
 * Reads side `back` of source `sid` on this computer and saves the text (one undoable action).
 * Returns the number of lines read, or -1 if it failed.
 */
export async function readSource(sid, back) {
  const src = S.sources.get(sid);
  const ref = imageOf(src, back);
  if (!src || !S.canWrite || !canRead(ref)) return -1;
  let res;
  try {
    res = await readPhoto(ref);
  } catch (e) {
    toast(e.message, true);
    return -1;
  }
  const now = S.sources.get(sid);
  if (!now || imageOf(now, back) !== ref) return -1; // the document changed during the reading
  beginAction('hist.htrRead');
  try {
    await opUpdate('sources', sid, { [keyOf(back)]: { of: ref, model: res.model, date: new Date().toISOString().slice(0, 10), lines: cleanLines(res.lines || []) } });
  } catch (e) {
    reportError(e);
    return -1;
  } finally {
    commitAction();
    emit('data');
  }
  return (res.lines || []).length;
}

/** "Read the text": the document shown. */
export async function runReading() {
  if (!cur || cur.busy) return;
  const { sid, back } = cur;
  cur.busy = true;
  renderReading();
  const n = await readSource(sid, back);
  if (cur && cur.sid === sid) {
    cur.busy = false;
    renderReading();
  }
  if (n >= 0) toast(t('htr.done', n));
}

/** A line corrected: saved, and counted as checked (one undoable action). */
export async function editLine(i, value) {
  const src = sourceOf();
  const reading = readingOf(src, cur.back);
  if (!reading || !S.canWrite || !reading.lines[i]) return;
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text === reading.lines[i].text && reading.lines[i].ok) return;
  const lines = reading.lines.map((l, k) => (k === i ? { ...l, text, ok: true } : l));
  beginAction('hist.htrEdit');
  try {
    await opUpdate('sources', cur.sid, { [keyOf(cur.back)]: { ...reading, lines: cleanLines(lines) } });
  } catch (e) {
    reportError(e);
  } finally {
    commitAction();
  }
  // The list isn't redrawn: the cursor stays where it is; only the line's mark changes
  const li = document.querySelector(`#readCard li[data-line="${i}"]`);
  if (li) li.className = 'ok on';
  emit('data');
}

/* ---------- Reading every document not read yet ---------- */

let batch = null; // { done, total, stop }

/** Sides of documents that this computer can read and that have no text yet: [[sid, back]]. */
export function unread() {
  const out = [];
  for (const [sid, src] of S.sources) {
    for (const back of [false, true]) if (canRead(imageOf(src, back)) && !readingOf(src, back)) out.push([sid, back]);
  }
  return out;
}

/** State of the reading of every document: null, or { done, total }. */
export const batchState = () => (batch ? { done: batch.done, total: batch.total } : null);

/** Reads every document not read yet, one after the other; `stopBatch()` stops after the current one. */
export async function readAll() {
  if (batch || !S.canWrite) return;
  const todo = unread();
  if (!todo.length) return;
  batch = { done: 0, total: todo.length, stop: false };
  emit('data');
  let read = 0;
  for (const [sid, back] of todo) {
    if (batch.stop) break;
    if (await readSource(sid, back) >= 0) read++;
    batch.done++;
    emit('data');
  }
  batch = null;
  emit('data');
  toast(t('htr.allDone', read));
}

export function stopBatch() {
  if (batch) batch.stop = true;
}

export const readingOpen = () => !!cur;

/**
 * Link to the reading of document `src` (source `sid`), for a record or the Sources view: "Text"
 * when a side was read, "Read the text" when this computer can read it, nothing otherwise.
 */
export function readLink(sid, src) {
  if (!sid || !src || !photoSrc(src.photo)) return '';
  const read = readingOf(src) ? 0 : readingOf(src, true) ? 1 : -1;
  if (read >= 0) return `<button class="link rd-link" type="button" data-act="read-open" data-source="${esc(sid)}" data-back="${read}">${t('htr.show')}</button>`;
  if (S.canWrite && (canRead(src.photo) || canRead(src.back))) return `<button class="link rd-link" type="button" data-act="read-open" data-source="${esc(sid)}" data-back="0">${t('htr.open')}</button>`;
  return '';
}

/** Text read of document `src`, both sides, for searching. */
export const readText = (src) => [readingOf(src), readingOf(src, true)].filter(Boolean).flatMap((r) => r.lines.map((l) => l.text)).join(' ');
