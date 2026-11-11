/** Overall rendering: header, tree and side panel. */
import { S, isLoading } from '../state.js';
import { $, setHTML } from '../utils/dom.js';
import { t } from '../i18n.js';
import { P, reindex, defaultFocus, allMedia } from '../model/people.js';
import { renderTree, scrollToFocus } from '../tree/render.js';
import { renderHeader, renderControls } from './header.js';
import { recordHTML } from './record.js';
import { formHTML } from './form.js';
import { renderRegister } from './register.js';
import { renderAnalysis, galleryHTML } from './analysis.js';
import { refreshFind } from './search.js';
import { renderTrees } from './trees.js';
import { renderPersonDlg } from './person-dlg.js';
import { renderMedia } from './media.js';
import { renderReading } from './reading.js';

/**
 * "Record" tab: the form being edited, or the record of the focus person.
 * The form is not rebuilt (so as not to lose input) unless `force`.
 */
export function renderRecord(force) {
  const pane = $('#paneRecord');

  if (S.edit) {
    if (!force && pane.dataset.token === S.edit.token) return;
    pane.innerHTML = formHTML();
    pane.dataset.token = S.edit.token;
    return;
  }
  pane.dataset.token = '';

  if (isLoading()) {
    pane.innerHTML = `<p class="nofocus">${t('loading')}</p>`;
    return;
  }
  if (!P(S.focus)) {
    pane.innerHTML = S.people.size
      ? `<p class="nofocus">${t('record.pick')}</p>`
      : `<p class="nofocus">${t('record.intro')}</p>`;
    return;
  }
  pane.innerHTML = recordHTML(S.focus);
}

export function renderSide(force) {
  for (const [tab, id] of [['record', 'Record'], ['register', 'Register'], ['analysis', 'Analysis']]) {
    $('#tab-' + tab).setAttribute('aria-selected', String(S.tab === tab));
    $('#pane' + id).hidden = S.tab !== tab;
  }
  $('#regCount').textContent = S.people.size ? String(S.people.size) : '';
  renderRegister();
  renderAnalysis();
  renderRecord(force);
}

/** The whole gallery over the tree (toolbar button): the tree stays drawn underneath, where it was. */
export function renderStageGallery() {
  const el = $('#stageGallery');
  const show = S.gallery && !isLoading();
  el.hidden = !show;
  $('#canvas').hidden = show;
  if (!show) {
    el.innerHTML = '';
    return;
  }
  const n = allMedia().filter(({ m }) => m && m.photo).length;
  setHTML(el, `<div class="sg-head"><h2>${t('ctl.gallery')} <span class="n">${n}</span></h2>`
    + `<button class="btn small" type="button" data-act="stage-gallery">${t('sg.back')}</button></div>${galleryHTML('stage')}`);
}

export function renderAll(force) {
  renderHeader();
  renderControls();
  renderTree();
  renderStageGallery();
  renderSide(force);
  refreshFind();
  if (!S.treeEdit) renderTrees(); // not while typing in the "My trees" dialog
  renderPersonDlg();
  renderMedia();
  renderReading();
  if (S.scrollPending) requestAnimationFrame(scrollToFocus);
}

/** Call after any data change: recomputes the indexes, then redraws. */
export function afterData() {
  reindex();
  if (!isLoading()) {
    if (!S.focus || !S.people.has(S.focus)) {
      S.focus = defaultFocus();
      S.scrollPending = true;
    }
    if (S.edit && S.edit.id && !S.people.has(S.edit.id)) S.edit = null;
  }
  renderAll();
}
