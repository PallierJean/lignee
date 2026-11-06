/**
 * Data storage.
 *
 * The application manages a collection of trees; only one is open at a time
 * (S.tree), its people and unions are in S.people and S.unions.
 * Three modes, each in its own module under storage/:
 *
 * - "db" (storage/db.js): online database provided by claude.ai;
 * - "file" (storage/file.js): one file per tree in data/arbres/, via server.js;
 * - "local" (storage/local.js): browser storage.
 *
 * This module picks the right mode for each write and each tree operation.
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

/** Saves the tree outside the online database: to the file (file mode) or the browser. */
export function saveLocal() {
  const tree = S.trees.get(S.tree);
  if (tree) tree.count = S.people.size;
  if (S.mode === 'file') return saveFile();
  saveBrowserTree();
}

/* ---------- Writes (all modes) ---------- */

export const mapOf = (collection) => (collection === 'people' ? S.people : S.unions);

/** Creates or replaces a document. */
export async function opSet(collection, id, data) {
  track(collection, id);
  mapOf(collection).set(id, data);
  if (S.mode === 'db') await dbSet(collection, id, data);
  else await saveLocal();
}

/** Changes some fields of an existing document. */
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

/* ---------- Undo / redo ---------- */

/** Puts each document back in the action's `side` state ('before' or 'after'). */
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

/** Undoes the last action. Returns the action, or null if there is none. */
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

/** Redoes the last undone action. */
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

/* ---------- Tree management (all modes) ---------- */

/** Opens another tree of the collection. */
export async function openTree(id) {
  if (!S.trees.has(id)) return;
  S.tree = id;
  resetHistory();
  // What refers to people of the tree being left
  if (S.kinShow) S.full = S.kinWasFull;
  S.kinShow = false;
  S.kinA = '';
  S.kinB = '';
  if (S.mode === 'db') refreshDb();
  else if (S.mode === 'file') await loadFileTree();
  else loadLocalTree();
}

/** Creates an empty tree and returns its id (without opening it). */
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

/** Deletes a tree and all its records. Opens another tree if it was the open one. */
export async function deleteTree(id) {
  if (!S.trees.has(id) || S.trees.size < 2) return;
  if (S.mode === 'db') await deleteDbTree(id);
  else if (S.mode === 'file') await deleteFileTree(id);
  else deleteBrowserTree(id);
  S.trees.delete(id);
  if (S.mode === 'local') saveTreesList();
  if (id === S.tree) await openTree(S.trees.keys().next().value);
}
