/** En-tête (arbre ouvert, résumé, état de l'enregistrement), bandeau et barre d'outils de l'arbre. */
import { renderRepoBanner } from './repo-link.js';
import { S, isLoading, treeName } from '../state.js';
import { $ } from '../utils/dom.js';
import { yearOf } from '../utils/dates.js';
import { P, surname, descendantDepth } from '../model/people.js';
import { generationSpan } from '../tree/full-layout.js';
import { t } from '../i18n.js';
import { canUndo, canRedo } from '../services/history.js';

const UP_MIN = 2; // au moins : les emplacements « ajouter un parent » vont jusque-là
const DOWN_MIN = 1; // au moins : l'emplacement « ajouter un enfant » est à la première génération
const SHOWN = 4; // valeurs visibles à la fois

/**
 * Boutons de 0 à `max` pour le réglage `kind` ('up' ou 'down'), valeur choisie `value`.
 * Fenêtre glissante : part de 0 et se décale quand le choix atteint son bord ; « … » avance ou recule d'un cran.
 */
function generationButtons(kind, value, max, off) {
  const cur = Math.min(value, max); // le réglage reste tel quel : il resservira dans un arbre plus profond
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

/** Boutons du nombre de générations et niveau de zoom. */
export function renderControls() {
  const off = S.full || S.fan ? ' disabled' : '';
  // Ascendants : jusqu'à l'écart de générations de tout l'arbre ; descendants : jusqu'au dernier de la personne choisie
  $('#segUp').innerHTML = generationButtons('up', S.up, Math.max(generationSpan(), UP_MIN), off);
  $('#segDown').innerHTML = generationButtons('down', S.down, Math.max(P(S.focus) ? descendantDepth(S.focus) : 0, DOWN_MIN), off);
  $('#btnFull').setAttribute('aria-pressed', String(S.full && !S.fan));
  $('#btnFan').setAttribute('aria-pressed', String(S.fan));
  $('#btnLine').setAttribute('aria-pressed', String(S.line));
  $('#btnPanel').setAttribute('aria-pressed', String(S.panel));
  $('#main').className = S.panel ? 'main' : 'main side-off';
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
  const closeBtn = (kind) => `<button class="icon-btn" type="button" data-act="banner-close" data-kind="${kind}" aria-label="${t('close')}" title="${t('close')}">×</button>`;

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
  } else if (S.mode === 'local' && !S.closed.local) {
    banner.hidden = false;
    banner.innerHTML = `<p>${t('local.banner')}</p><div class="acts">${closeBtn('local')}</div>`;
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
