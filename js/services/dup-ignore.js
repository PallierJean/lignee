/**
 * Pairs of records dismissed with "Not a duplicate", kept in this browser,
 * per tree: { [tree]: ['idA|idB', …] }.
 */
import { DUP_KEY } from '../config.js';
import { S } from '../state.js';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(DUP_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}

/** Dismissed pairs in the open tree. */
export const ignoredPairs = () => new Set(readAll()[S.tree] || []);

/** Permanently dismisses the pair `key` ("idA|idB") in the open tree. */
export function ignorePair(key) {
  const all = readAll();
  all[S.tree] = [...new Set([...(all[S.tree] || []), key])];
  try {
    localStorage.setItem(DUP_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage full or refused: the pair will reappear on the next load */
  }
}
