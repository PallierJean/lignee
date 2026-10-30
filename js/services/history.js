/**
 * Historique annuler / rétablir de l'arbre ouvert, en mémoire : il disparaît au
 * rechargement de la page et au changement d'arbre.
 *
 * Une action regroupe les documents qu'elle a modifiés : { label, focus, changes }, avec
 * pour chacun l'état avant et après. Ne garder que ces documents évite, en base partagée,
 * d'écraser ce que d'autres personnes ont modifié ailleurs dans l'arbre.
 */
import { S } from '../state.js';

const MAX = 50;

let done = [];     // actions annulables, la plus récente à la fin
let undone = [];   // actions annulées, rétablissables
let current = null;

export const mapOfCollection = (collection) => (collection === 'people' ? S.people : S.unions);

/** Ouvre une action : les écritures suivantes en font partie jusqu'à commitAction(). */
export function beginAction(label) {
  current = { label, focus: S.focus, changes: new Map() };
}

/** À appeler avant d'écrire : retient l'état du document avant l'action. */
export function track(collection, id) {
  if (!current) return;
  const key = collection + '/' + id;
  if (!current.changes.has(key)) current.changes.set(key, { collection, id, before: mapOfCollection(collection).get(id) });
}

/** Ferme l'action et l'ajoute à l'historique, si elle a changé quelque chose. */
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
}

export const canUndo = () => done.length > 0;
export const canRedo = () => undone.length > 0;

/** Retire de l'historique la dernière action à annuler ou à rétablir. */
export const takeUndo = () => done.pop() || null;
export const takeRedo = () => undone.pop() || null;

/** Range une action une fois annulée ou rétablie, ou la remet en place après un échec. */
export const pushDone = (action) => done.push(action);
export const pushUndone = (action) => undone.push(action);

export function resetHistory() {
  done = [];
  undone = [];
  current = null;
}
