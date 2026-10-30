/** En-tête (arbre ouvert, résumé, état de l'enregistrement), bandeau et barre d'outils de l'arbre. */
import { renderRepoBanner } from './repo-link.js';
import { S, isLoading, treeName } from '../state.js';
import { $ } from '../utils/dom.js';
import { yearOf } from '../utils/dates.js';
import { surname } from '../model/people.js';
import { t } from '../i18n.js';
import { canUndo, canRedo } from '../services/history.js';

/** Boutons du nombre de générations et niveau de zoom. */
export function renderControls() {
  const off = S.full || S.fan ? ' disabled' : '';
  $('#segUp').innerHTML = [1, 2, 3, 4, 5, 6, 7].map((n) =>
    `<button type="button" data-act="up" data-n="${n}" aria-pressed="${!off && S.up === n}" aria-label="${t('gen.up', n)}"${off}>${n}</button>`,
  ).join('');
  $('#segDown').innerHTML = [0, 1, 2, 3].map((n) =>
    `<button type="button" data-act="down" data-n="${n}" aria-pressed="${!off && S.down === n}" aria-label="${t('gen.down', n)}"${off}>${n}</button>`,
  ).join('');
  $('#btnFull').setAttribute('aria-pressed', String(S.full && !S.fan));
  $('#btnFan').setAttribute('aria-pressed', String(S.fan));
  $('#btnLine').setAttribute('aria-pressed', String(S.line));
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

function renderBanner() {
  const banner = $('#banner');
  const examples = [...S.people.values()].filter((p) => p.example).length;

  if (examples) {
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
      + `<div class="acts">${actions}</div>`;
  } else if (S.mode === 'local') {
    banner.hidden = false;
    banner.innerHTML = `<p>${t('local.banner')}</p>`;
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
  $('#importSection').hidden = !S.canWrite;
  renderBanner();
  renderRepoBanner();
}
