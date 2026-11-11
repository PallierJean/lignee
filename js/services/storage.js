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
import { rid, pool, markReported } from '../utils/helpers.js';
import { failure } from './notify.js';
import { dataChanged } from '../model/people.js';
import { planSources, orphanSources } from '../model/sources.js';
import { canonical } from './merge.js';
import { loadLocalTree, saveBrowserTree, deleteBrowserTree, saveTreesList } from './storage/local.js';
import { loadFileTree, saveFile, createFileTree, renameFileTree, deleteFileTree } from './storage/file.js';
import { dbSet, dbUpdate, dbDelete, refreshDb, setDbTree, deleteDbTree, holdSync } from './storage/db.js';
import { track, resetHistory, takeUndo, takeRedo, pushDone, pushUndone } from './history.js';

export { loadLocal, seedExample } from './storage/local.js';
export { loadFile, storePhoto, storePhotos, convertPhotos, keptMedia, buildPortableBackup } from './storage/file.js';
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

export const mapOf = (collection) => ({ people: S.people, unions: S.unions, sources: S.sources })[collection];

// Writes grouped by inBatch(): collection/id -> { collection, id, before, after, patch, replaced }
let batch = null;

/** Puts each document of `entries` back to its state before the batch. */
function restore(entries) {
  dataChanged();
  for (const c of entries) {
    const map = mapOf(c.collection);
    if (c.before) map.set(c.id, c.before);
    else map.delete(c.id);
  }
}

/** Database write of a batched document: a patch when only fields changed, so others' edits stay. */
function dbWrite(c) {
  if (!c.after) return c.before ? dbDelete(c.collection, c.id) : null;
  if (c.before && !c.replaced) return dbUpdate(c.collection, c.id, c.patch);
  return dbSet(c.collection, c.id, c.after);
}

/** Writes the batched documents: a single save outside the database. */
async function persist(entries) {
  if (S.mode !== 'db') {
    await saveLocal();
    return;
  }
  const written = [];
  try {
    await pool(entries, 3, async (c) => {
      await dbWrite(c);
      written.push(c);
    });
  } catch (e) {
    // Best effort: the documents already written go back, so the action is all or nothing
    await pool(written, 3, (c) => dbWrite({ ...c, before: c.after, after: c.before, replaced: true })).catch(() => {});
    throw e;
  }
}

/**
 * Runs `fn`, whose writes are applied in memory right away (later rules read them)
 * but stored together at the end. If `fn` or the save fails, every document goes back
 * to its previous state: the action is saved whole or not at all.
 */
export async function inBatch(fn) {
  if (batch) return fn();
  batch = new Map();
  if (S.mode === 'db') holdSync(true);
  let entries = [];
  try {
    const result = await fn();
    entries = [...batch.values()].filter((c) => c.before !== c.after);
    batch = null;
    await persist(entries);
    return result;
  } catch (e) {
    restore(batch ? [...batch.values()] : entries);
    throw e;
  } finally {
    batch = null;
    if (S.mode === 'db') holdSync(false);
  }
}

/**
 * Applies `next` (a document, or undefined to delete it) in memory, then runs `write`.
 * In a batch, the write waits for the end of the batch. If the write fails, the document
 * goes back to its previous state: what is shown stays what is stored.
 */
async function writeDoc(collection, id, next, write, patch) {
  dataChanged();
  const map = mapOf(collection);
  const before = map.get(id);
  track(collection, id);
  if (batch) {
    const key = collection + '/' + id;
    const c = batch.get(key) || { collection, id, before, patch: {}, replaced: false };
    if (patch && !c.replaced) Object.assign(c.patch, patch);
    else c.replaced = true;
    c.after = next;
    batch.set(key, c);
  }
  if (next) map.set(id, next);
  else map.delete(id);
  if (batch) return;
  try {
    await write();
  } catch (e) {
    dataChanged();
    if (map.get(id) === next) {
      if (before) map.set(id, before);
      else map.delete(id);
    }
    throw e;
  }
}

/** Creates or replaces a document. */
export function opSet(collection, id, data) {
  if (collection === 'people' && data && 'sources' in data) return setWithSources(id, data);
  return writeDoc(collection, id, data, () => (S.mode === 'db' ? dbSet(collection, id, data) : saveLocal()));
}

/** Changes some fields of an existing document. */
export async function opUpdate(collection, id, patch) {
  const current = mapOf(collection).get(id);
  if (!current) return;
  if (collection === 'people' && 'sources' in patch) {
    await setWithSources(id, Object.assign({}, current, patch));
    return;
  }
  await writeDoc(collection, id, Object.assign({}, current, patch), () => (S.mode === 'db' ? dbUpdate(collection, id, patch) : saveLocal()), patch);
}

/**
 * Saves a person whose `sources` are documents (version 1 style, as the form produces them):
 * the documents go to the shared sources, the person keeps citations of them, and the marriage
 * documents of their unions go to those unions (see planSources; `unionSources`: the unions whose
 * documents the caller showed in full). Sources nobody cites any more are deleted. All in one
 * batch: saved whole or not at all.
 */
function setWithSources(id, data) {
  return inBatch(async () => {
    const { sources, unionSources, ...person } = data;
    const before = mapOf('people').get(id);
    const { citations, unions, writes } = planSources(id, sources, unionSources || []);
    const candidates = listOf(before && before.citations).map((c) => c.source);
    for (const [sid, doc] of writes) await opSet('sources', sid, doc);
    if (citations.length) person.citations = citations;
    else delete person.citations;
    await opSet('people', id, person);
    for (const [uid, list] of unions) {
      const u = mapOf('unions').get(uid);
      if (!u) continue;
      candidates.push(...listOf(u.citations).map((c) => c.source));
      const next = { ...u };
      if (list.length) next.citations = list;
      else delete next.citations;
      if (canonical(next.citations || []) !== canonical(u.citations || [])) await opSet('unions', uid, next);
    }
    for (const sid of orphanSources(candidates)) await opDelete('sources', sid);
  });
}

const listOf = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);

/**
 * Deletes a document. The sources of a person or a union that nobody else cites go with
 * them, unless `raw` (a merge that sets every collection itself).
 */
export function opDelete(collection, id, { raw = false } = {}) {
  const doc = !raw && (collection === 'people' || collection === 'unions') ? mapOf(collection).get(id) : null;
  if (doc && listOf(doc.citations).length) {
    return inBatch(async () => {
      await writeDoc(collection, id, undefined, () => (S.mode === 'db' ? dbDelete(collection, id) : saveLocal()));
      for (const sid of orphanSources(listOf(doc.citations).map((c) => c.source))) await opDelete('sources', sid);
    });
  }
  return writeDoc(collection, id, undefined, () => (S.mode === 'db' ? dbDelete(collection, id) : saveLocal()));
}

/* ---------- Undo / redo ---------- */

/** Puts each document back in the action's `side` state ('before' or 'after'). */
async function applyAction(action, side) {
  dataChanged();
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
    if (S.mode === 'file' && !(e && e.reported)) throw failure('st.renameFailed', e);
    throw markReported(e);
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
