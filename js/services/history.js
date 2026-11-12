/**
 * Undo / redo history of the open tree, in memory: it disappears on
 * page reload and when switching trees.
 *
 * An action groups the documents it changed: { label, focus, changes }, with
 * the before and after state of each. Keeping only those documents avoids, in a shared database,
 * overwriting what other people changed elsewhere in the tree.
 */
import { S } from '../state.js';
import { emit } from './notify.js';

const MAX = 50;

let done = [];     // undoable actions, the most recent at the end
let undone = [];   // undone actions, redoable
let current = null;

export const mapOfCollection = (collection) => ({ people: S.people, unions: S.unions, sources: S.sources, media: S.media })[collection];

/** Opens an action: the following writes belong to it until commitAction(). */
export function beginAction(label) {
  current = { label, focus: S.focus, changes: new Map() };
}

/** Call before writing: remembers the document's state before the action. */
export function track(collection, id) {
  if (!current) return;
  const key = collection + '/' + id;
  if (!current.changes.has(key)) current.changes.set(key, { collection, id, before: mapOfCollection(collection).get(id) });
}

/** Closes the action and adds it to the history, if it changed something. */
export function commitAction() {
  const action = current;
  current = null;
  if (!action) return;
  const changes = [...action.changes.values()]
    .map((c) => ({ ...c, after: mapOfCollection(c.collection).get(c.id) }))
    .filter((c) => c.before !== c.after);
  if (!changes.length) return;
  done.push({ label: action.label, focus: action.focus, after: S.focus, changes });
  if (done.length > MAX) done.shift();
  undone = [];
  emit('changed', action.label);
}

export const canUndo = () => done.length > 0;
export const canRedo = () => undone.length > 0;

/** Removes the last action to undo or redo from the history. */
export const takeUndo = () => done.pop() || null;
export const takeRedo = () => undone.pop() || null;

/** Stores an action once undone or redone, or puts it back after a failure. */
export const pushDone = (action) => done.push(action);
export const pushUndone = (action) => undone.push(action);

export function resetHistory() {
  done = [];
  undone = [];
  current = null;
}
