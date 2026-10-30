/** Rendu général : en-tête, arbre et panneau latéral. */
import { S, isLoading } from '../state.js';
import { $ } from '../utils/dom.js';
import { t } from '../i18n.js';
import { P, reindex, defaultFocus } from '../model/people.js';
import { renderTree, scrollToFocus } from '../tree/render.js';
import { renderHeader, renderControls } from './header.js';
import { ficheHTML } from './fiche.js';
import { formHTML } from './form.js';
import { renderRegistre } from './registre.js';
import { renderAnalyse } from './analyse.js';
import { refreshFind } from './search.js';
import { renderTrees } from './trees.js';
import { renderPersonDlg } from './person-dlg.js';
import { renderMedia } from './media.js';

/**
 * Onglet « Fiche » : formulaire en cours, ou fiche de la personne centrale.
 * Le formulaire n'est pas reconstruit (pour ne pas perdre la saisie) sauf si `force`.
 */
export function renderFiche(force) {
  const pane = $('#paneFiche');

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
      ? `<p class="nofocus">${t('fiche.pick')}</p>`
      : `<p class="nofocus">${t('fiche.intro')}</p>`;
    return;
  }
  pane.innerHTML = ficheHTML(S.focus);
}

export function renderSide(force) {
  for (const [tab, id] of [['fiche', 'Fiche'], ['registre', 'Registre'], ['analyse', 'Analyse']]) {
    $('#tab-' + tab).setAttribute('aria-selected', String(S.tab === tab));
    $('#pane' + id).hidden = S.tab !== tab;
  }
  $('#regCount').textContent = S.people.size ? String(S.people.size) : '';
  renderRegistre();
  renderAnalyse();
  renderFiche(force);
}

export function renderAll(force) {
  renderHeader();
  renderControls();
  renderTree();
  renderSide(force);
  refreshFind();
  if (!S.treeEdit) renderTrees(); // pas pendant une saisie dans la fenêtre « Mes arbres »
  renderPersonDlg();
  renderMedia();
  if (S.scrollPending) requestAnimationFrame(scrollToFocus);
}

/** À appeler après tout changement des données : recalcule les index puis redessine. */
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
