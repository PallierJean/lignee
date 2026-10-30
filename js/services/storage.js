/**
 * Enregistrement des données.
 *
 * L'application gère une collection d'arbres ; un seul est ouvert à la fois
 * (S.tree), ses personnes et unions sont dans S.people et S.unions.
 * Trois modes, chacun dans son module de storage/ :
 *
 * - « db » (storage/db.js) : base de données en ligne fournie par claude.ai ;
 * - « file » (storage/file.js) : un fichier par arbre dans data/arbres/, via server.js ;
 * - « local » (storage/local.js) : stockage du navigateur.
 *
 * Ce module choisit le bon mode pour chaque écriture et chaque opération sur les arbres.
 */
import { S } from '../state.js';
import { t } from '../i18n.js';
import { rid, pool } from '../utils/helpers.js';
import { toast } from '../ui/toast.js';
import { loadLocalTree, saveBrowserTree, deleteBrowserTree, saveTreesList } from './storage/local.js';
import { loadFileTree, saveFile, createFileTree, renameFileTree, deleteFileTree } from './storage/file.js';
import { dbSet, dbUpdate, dbDelete, refreshDb, setDbTree, deleteDbTree } from './storage/db.js';
import { track, resetHistory, takeUndo, takeRedo, pushDone, pushUndone } from './history.js';

export { loadLocal, seedExample } from './storage/local.js';
export { loadFile, storePhoto, storePhotos, convertPhotos, buildPortableBackup } from './storage/file.js';
export { dbSet, withRetry, subscribe } from './storage/db.js';
export { beginAction, commitAction, track, canUndo, canRedo } from './history.js';

/** Enregistre l'arbre hors base en ligne : dans le fichier (mode file) ou le navigateur. */
export function saveLocal() {
  const tree = S.trees.get(S.tree);
  if (tree) tree.count = S.people.size;
  if (S.mode === 'file') return saveFile();
  saveBrowserTree();
}

/* ---------- Écritures (tous les modes) ---------- */

export const mapOf = (collection) => (collection === 'people' ? S.people : S.unions);

/** Crée ou remplace un document. */
export async function opSet(collection, id, data) {
  track(collection, id);
  mapOf(collection).set(id, data);
  if (S.mode === 'db') await dbSet(collection, id, data);
  else await saveLocal();
}

/** Modifie certains champs d'un document existant. */
export async function opUpdate(collection, id, patch) {
  const map = mapOf(collection);
  const current = map.get(id);
  if (!current) return;
  track(collection, id);
  map.set(id, Object.assign({}, current, patch));
  if (S.mode === 'db') await dbUpdate(collection, id, patch);
  else await saveLocal();
}

export async function opDelete(collection, id) {
  track(collection, id);
  mapOf(collection).delete(id);
  if (S.mode === 'db') await dbDelete(collection, id);
  else await saveLocal();
}

/* ---------- Annuler / rétablir ---------- */

/** Remet chaque document dans l'état `side` ('before' ou 'after') de l'action. */
async function applyAction(action, side) {
  for (const c of action.changes) {
    const data = c[side];
    if (data) mapOf(c.collection).set(c.id, data);
    else mapOf(c.collection).delete(c.id);
  }
  if (S.mode !== 'db') {
    await saveLocal();
    return;
  }
  await pool(action.changes, 3, (c) => (c[side] ? dbSet(c.collection, c.id, c[side]) : dbDelete(c.collection, c.id)));
}

/** Annule la dernière action. Renvoie l'action, ou null s'il n'y en a pas. */
export async function undoAction() {
  const action = takeUndo();
  if (!action) return null;
  try {
    await applyAction(action, 'before');
  } catch (e) {
    pushDone(action);
    throw e;
  }
  pushUndone(action);
  return action;
}

/** Rétablit la dernière action annulée. */
export async function redoAction() {
  const action = takeRedo();
  if (!action) return null;
  try {
    await applyAction(action, 'after');
  } catch (e) {
    pushUndone(action);
    throw e;
  }
  pushDone(action);
  return action;
}

/* ---------- Gestion des arbres (tous les modes) ---------- */

/** Ouvre un autre arbre de la collection. */
export async function openTree(id) {
  if (!S.trees.has(id)) return;
  S.tree = id;
  resetHistory();
  // Ce qui désigne des personnes de l'arbre quitté
  if (S.kinShow) S.full = S.kinWasFull;
  S.kinShow = false;
  S.kinA = '';
  S.kinB = '';
  S.dupIgnored = new Set();
  if (S.mode === 'db') refreshDb();
  else if (S.mode === 'file') await loadFileTree();
  else loadLocalTree();
}

/** Crée un arbre vide et renvoie son identifiant (sans l'ouvrir). */
export async function createTree(name) {
  const id = rid('t');
  const tree = { name, createdAt: Date.now(), count: 0 };
  if (S.mode === 'db') await setDbTree(id, tree);
  else if (S.mode === 'file') await createFileTree(id, tree);
  S.trees.set(id, tree);
  if (S.mode === 'local') saveTreesList();
  return id;
}

export async function renameTree(id, name) {
  const tree = S.trees.get(id);
  if (!tree) return;
  const before = tree.name;
  tree.name = name;
  try {
    if (S.mode === 'db') await setDbTree(id, tree);
    else if (S.mode === 'file') await renameFileTree(id, tree);
    else saveTreesList();
  } catch (e) {
    tree.name = before;
    if (S.mode === 'file') toast(t('st.renameFailed'), true);
    throw e;
  }
}

/** Supprime un arbre et toutes ses fiches. Ouvre un autre arbre si c'était l'arbre ouvert. */
export async function deleteTree(id) {
  if (!S.trees.has(id) || S.trees.size < 2) return;
  if (S.mode === 'db') await deleteDbTree(id);
  else if (S.mode === 'file') await deleteFileTree(id);
  else deleteBrowserTree(id);
  S.trees.delete(id);
  if (S.mode === 'local') saveTreesList();
  if (id === S.tree) await openTree(S.trees.keys().next().value);
}
