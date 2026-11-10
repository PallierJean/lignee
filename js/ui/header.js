/** Header (open tree, summary, save status), banner and tree toolbar. */
import { renderRepoBanner, savedRepo } from './repo-link.js';
import { lastExport } from '../services/exported.js';
import { EXPORT_STALE, BANNER_SNOOZE, narrow } from '../config.js';
import { S, isLoading, treeName } from '../state.js';
import { $ } from '../utils/dom.js';
import { yearOf } from '../utils/dates.js';
import { P, surname, ancestorDepth, descendantDepth } from '../model/people.js';
import { t } from '../i18n.js';
import { canUndo, canRedo } from '../services/history.js';

const UP_MIN = 2; // at least: the "add a parent" slots go up to there
const DOWN_MIN = 1; // at least: the "add a child" slot is in the first generation
const SHOWN = 4; // values visible at once

/**
 * Buttons from 0 to `max` for setting `kind` ('up' or 'down'), chosen value `value`.
 * Sliding window: starts at 0 and shifts when the choice reaches its edge; "…" moves one step forward or back.
 */
function generationButtons(kind, value, max, off) {
  const cur = Math.min(value, max); // the setting stays as is: it will be used again in a deeper tree
  const count = Math.min(SHOWN, max + 1);
  const first = Math.min(Math.max(cur - count + 2, 0), max - count + 1);
  const last = first + count - 1;
  const button = (n, label, cls = '') =>
    `<button type="button"${cls} data-act="${kind}" data-n="${n}" aria-pressed="${!off && cur === n}" aria-label="${t('gen.' + kind, n)}"${off}>${label}</button>`;
  const shown = Array.from({ length: count }, (_, i) => button(first + i, first + i));
  if (first > 0) shown.unshift(button(cur - 1, '…', ' class="seg-more"'));
  if (last < max) shown.push(button(cur + 1, '…', ' class="seg-more"'));
  return shown.join('');
}

/** Generation-count buttons and zoom level. */
export function renderControls() {
  const off = S.full || S.fan ? ' disabled' : '';
  // Up to the farthest ancestor and the last descendant of the chosen person
  const focus = P(S.focus) ? S.focus : null;
  $('#segUp').innerHTML = generationButtons('up', S.up, Math.max(focus ? ancestorDepth(focus) : 0, UP_MIN), off);
  $('#segDown').innerHTML = generationButtons('down', S.down, Math.max(focus ? descendantDepth(focus) : 0, DOWN_MIN), off);
  $('#btnFull').setAttribute('aria-pressed', String(S.full && !S.fan));
  $('#btnFan').setAttribute('aria-pressed', String(S.fan));
  $('#btnLine').setAttribute('aria-pressed', String(S.line));
  $('#btnLiving').setAttribute('aria-pressed', String(S.filter === 'living'));
  $('#btnCertificate').setAttribute('aria-pressed', String(S.filter === 'certificate'));
  $('#btnPanel').setAttribute('aria-pressed', String(narrow() ? S.sheet : S.panel));
  $('#main').className = 'main' + (S.panel ? '' : ' side-off') + (S.sheet ? ' sheet' : '');
  $('#zoomVal').textContent = t('percent', Math.round(S.zoom * 100));
  $('#undoCtl').hidden = !S.canWrite;
  $('#btnUndo').disabled = !canUndo();
  $('#btnRedo').disabled = !canRedo();
}

function renderSummary() {
  const el = $('#summary');
  const n = S.people.size;
  if (isLoading()) {
    el.textContent = t('loading');
    return;
  }
  if (!n) {
    el.textContent = t('sum.empty');
    return;
  }
  const surnames = new Set();
  const births = [];
  for (const p of S.people.values()) {
    const s = surname(p);
    if (s) surnames.add(s);
    const y = yearOf(p.birthDate);
    if (y) births.push(y);
  }
  const parts = [t('sum.people', n), t('sum.surnames', surnames.size)];
  if (births.length) parts.push(t('sum.since', Math.min(...births)));
  el.textContent = parts.join(' · ');
}

function renderStatus() {
  const el = $('#status');
  let cls = 'pill';
  let text = t('status.connecting');
  let tip = '';
  if (S.mode === 'db' && S.canWrite) {
    cls += ' ok';
    text = t('status.db');
    tip = t('status.dbTip');
  } else if (S.mode === 'db') {
    text = t('status.readonly');
    tip = t('status.readonlyTip');
  } else if (S.mode === 'file') {
    cls += ' ok';
    text = t('status.file');
    tip = t('status.fileTip');
  } else if (S.mode === 'local') {
    cls += ' warn';
    text = t('status.local');
    tip = t('status.localTip');
  }
  el.className = cls;
  el.title = tip;
  el.lastElementChild.textContent = text;
}

const DAY = 86400000;

/**
 * Local mode warning: the tree only lives in this browser. Shown while the tree has people of its
 * own, isn't linked to a GitHub repository, and wasn't exported in the last EXPORT_STALE days;
 * closing it hides it for BANNER_SNOOZE days. Returns the number of days since the last export
 * (0: never), or null when there is nothing to remind.
 */
export function localWarning(now = Date.now()) {
  if (S.mode !== 'local' || ![...S.people.values()].some((p) => !p.example)) return null;
  if ((S.repoLink && S.repoLink.tree === S.tree) || savedRepo()) return null;
  const last = lastExport();
  if (last && now - last < EXPORT_STALE * DAY) return null;
  const closed = S.closed.local;
  if (typeof closed === 'number' && now - closed < BANNER_SNOOZE * DAY) return null;
  return last ? Math.max(1, Math.floor((now - last) / DAY)) : 0;
}

function renderBanner() {
  const banner = $('#banner');
  const examples = [...S.people.values()].filter((p) => p.example).length;
  const closeBtn = (kind) => `<button class="icon-btn" type="button" data-act="banner-close" data-kind="${kind}" aria-label="${t('close')}" title="${t('close')}">×</button>`;
  const days = localWarning();

  if (days !== null) {
    banner.hidden = false;
    banner.className = 'banner warn';
    banner.innerHTML = `<p>${t('local.banner')} ${days ? t('local.last', days) : t('local.never')}</p>`
      + `<div class="acts"><button class="btn small primary" type="button" data-act="export-open">${t('local.export')}</button>`
      + `<button class="btn small" type="button" data-act="repo-link-open">${t('local.github')}</button>${closeBtn('local')}</div>`;
    return;
  }
  banner.className = 'banner';
  if (examples && !S.closed.ex) {
    let actions = '';
    if (S.canWrite) {
      actions = S.confirmEx
        ? `<span>${t('ex.ask', examples)}</span>`
          + `<button class="btn danger" type="button" data-act="ex-yes">${t('ex.yes')}</button>`
          + `<button class="btn" type="button" data-act="ex-no">${t('cancel')}</button>`
        : `<button class="btn" type="button" data-act="ex-ask">${t('ex.remove')}</button>`;
    }
    banner.hidden = false;
    banner.innerHTML = `<p>${t('ex.banner')}</p>`
      + `<div class="acts">${actions}${closeBtn('ex')}</div>`;
  } else {
    banner.hidden = true;
  }
}

function renderTreeName() {
  const name = isLoading() ? '' : treeName();
  $('#treeName').textContent = name || '…';
  document.title = name ? name + ' · Lignée' : 'Lignée';
}

export function renderHeader() {
  renderTreeName();
  renderSummary();
  renderStatus();
  $('#btnNew').hidden = !S.canWrite;
  $('#btnImport').hidden = !S.canWrite;
  renderBanner();
  renderRepoBanner();
}
