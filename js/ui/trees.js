/**
 * Fenêtre « Mes arbres » : collection d'arbres généalogiques.
 * Ouvrir un autre arbre, en créer un, le renommer ou le supprimer.
 */
import { S, savePrefs, treeName } from '../state.js';
import { $, esc } from '../utils/dom.js';
import { openTree, createTree, renameTree, deleteTree } from '../services/storage.js';
import { afterData } from './render.js';
import { renderHeader } from './header.js';
import { toast } from './toast.js';
import { t } from '../i18n.js';


/** Nombre de personnes d'un arbre (à jour pour l'arbre ouvert). */
const countOf = (id) => (id === S.tree ? S.people.size : (S.trees.get(id) || {}).count || 0);

/* ---------- Ouverture / fermeture ---------- */

export function openTrees() {
  S.treeEdit = null;
  $('#treesDlg').hidden = false;
  $('#newTreeName').value = '';
  renderTrees();
  setTimeout(() => {
    const close = $('#treesDlg .icon-btn');
    if (close) close.focus();
  }, 20);
}

export function closeTrees() {
  $('#treesDlg').hidden = true;
  S.treeEdit = null;
}

/* ---------- Rendu ---------- */

function rowHTML(id, tree) {
  const cur = id === S.tree;
  const edit = S.treeEdit && S.treeEdit.id === id ? S.treeEdit.kind : null;
  const n = countOf(id);

  if (edit === 'rename') {
    return `<li class="tree-row editing"><form class="tree-rename" id="renameForm" data-id="${esc(id)}">`
      + `<label class="sr" for="renameInput">${t('ts.renameLabel')}</label>`
      + `<input id="renameInput" type="text" maxlength="80" required autocomplete="off" value="${esc(tree.name)}">`
      + `<button class="btn small primary" type="submit">${t('save')}</button>`
      + `<button class="btn small" type="button" data-act="tree-cancel">${t('cancel')}</button>`
      + '</form></li>';
  }
  if (edit === 'delete') {
    return '<li class="tree-row editing"><div class="tree-confirm">'
      + `<p>${t('ts.deleteAsk', esc(tree.name), n)}</p>`
      + '<div class="row-btns">'
      + `<button class="btn small danger" type="button" data-act="tree-delete-yes" data-id="${esc(id)}">${t('delete')}</button>`
      + `<button class="btn small" type="button" data-act="tree-cancel">${t('cancel')}</button>`
      + '</div></div></li>';
  }

  let acts = '';
  if (S.canWrite) {
    acts = '<div class="tree-acts">'
      + `<button class="btn small" type="button" data-act="tree-rename" data-id="${esc(id)}">${t('ts.rename')}</button>`
      + (S.trees.size > 1
        ? `<button class="btn small quiet" type="button" data-act="tree-delete" data-id="${esc(id)}">${t('delete')}</button>`
        : '')
      + '</div>';
  }
  return `<li class="tree-row${cur ? ' cur' : ''}">`
    + `<button class="tree-open" type="button" data-act="tree-open" data-id="${esc(id)}"${cur ? ' aria-current="true"' : ''}>`
    + `<span class="nm">${esc(tree.name)}</span>`
    + `<span class="ct">${t('ts.count', n)}${cur ? ' · ' + t('ts.open') : ''}</span>`
    + '</button>'
    + acts
    + '</li>';
}

export function renderTrees() {
  if ($('#treesDlg').hidden) return;
  $('#treeList').innerHTML = [...S.trees].map(([id, tree]) => rowHTML(id, tree)).join('');
  $('#newTreeSection').hidden = !S.canWrite;
  const input = $('#renameInput');
  if (input) {
    input.focus();
    input.select();
  }
}

/* ---------- Actions ---------- */

/** Ouvre l'arbre `id` à la place de l'arbre actuel. */
export async function switchTree(id) {
  if (id === S.tree || !S.trees.has(id)) {
    closeTrees();
    return;
  }
  if (S.edit) {
    toast(t('finishFirst'));
    return;
  }
  savePrefs(); // garde la personne centrale de l'arbre quitté
  await openTree(id);
  S.focus = S.foci[id] || null;
  S.confirmDel = false;
  S.confirmEx = false;
  S.scrollPending = true;
  closeTrees();
  afterData();
  savePrefs();
  toast(t('ts.opened', treeName()));
}

/** Crée un arbre vide nommé `name` et l'ouvre. Renvoie son identifiant, ou null. */
export async function newTree(name) {
  name = String(name || '').trim().slice(0, 80);
  if (!name) {
    toast(t('ts.needName'));
    return null;
  }
  if (S.edit) {
    toast(t('finishFirst'));
    return null;
  }
  let id;
  try {
    id = await createTree(name);
  } catch (e) {
    return null;
  }
  await switchTree(id);
  return id;
}

export function askTree(kind, id) {
  S.treeEdit = { kind, id };
  renderTrees();
}

export function cancelTreeEdit() {
  S.treeEdit = null;
  renderTrees();
}

export async function submitRename(id, name) {
  name = String(name || '').trim().slice(0, 80);
  if (!name) return;
  try {
    await renameTree(id, name);
  } catch (e) {
    /* message déjà affiché */
  }
  S.treeEdit = null;
  renderTrees();
  renderHeader();
}

export async function confirmDeleteTree(id) {
  if (id === S.tree && S.edit) {
    toast(t('finishFirst'));
    return;
  }
  const name = (S.trees.get(id) || {}).name || '';
  const wasOpen = id === S.tree;
  try {
    await deleteTree(id);
  } catch (e) {
    renderTrees();
    return;
  }
  delete S.foci[id];
  S.treeEdit = null;
  if (wasOpen) {
    S.focus = S.foci[S.tree] || null;
    S.scrollPending = true;
    afterData();
  } else {
    renderHeader();
  }
  savePrefs();
  renderTrees();
  toast(t('ts.deleted', name));
}
