/**
 * What the user dismissed, kept in this browser, per tree: { [tree]: [key, …] }.
 * Pairs of records marked "Not a duplicate" ("idA|idB"), and consistency warnings
 * marked "Ignore" ("code|id|id…"); death certificates already requested ({ [record]: day }).
 */
import { DUP_KEY, CHK_KEY, REQ_KEY } from '../config.js';
import { S } from '../state.js';

function readAll(storeKey) {
  try {
    return JSON.parse(localStorage.getItem(storeKey) || '{}') || {};
  } catch (e) {
    return {};
  }
}

function write(storeKey, all) {
  try {
    localStorage.setItem(storeKey, JSON.stringify(all));
  } catch (e) {
    /* storage full or refused: the dismissal is lost on the next load */
  }
}

const list = (storeKey) => new Set(readAll(storeKey)[S.tree] || []);

function add(storeKey, key) {
  const all = readAll(storeKey);
  all[S.tree] = [...new Set([...(all[S.tree] || []), key])];
  write(storeKey, all);
}

/** Dismissed pairs in the open tree. */
export const ignoredPairs = () => list(DUP_KEY);

/** Permanently dismisses the pair `key` ("idA|idB") in the open tree. */
export const ignorePair = (key) => add(DUP_KEY, key);

/** Key of a consistency issue: its code and the records it names. */
export const issueKey = (x) => [x.code, ...x.ids].join('|');

/** Dismissed consistency issues in the open tree. */
export const ignoredIssues = () => list(CHK_KEY);

/** Permanently dismisses the issue `key` in the open tree. */
export const ignoreIssue = (key) => add(CHK_KEY, key);

/** Shows again every dismissed issue of the open tree. */
export function restoreIssues() {
  const all = readAll(CHK_KEY);
  delete all[S.tree];
  write(CHK_KEY, all);
}

/**
 * Death certificates marked as requested in this browser, before they were kept in the records:
 * { [record]: "DD/MM/YYYY" }. Still shown, and moved into the records at the next change.
 */
export const browserRequested = () => readAll(REQ_KEY)[S.tree] || {};

/** Marks the certificates of `ids` as requested on `day` in this browser (read-only tree), or with `day` empty, as still to request. */
export function setBrowserRequested(ids, day) {
  const all = readAll(REQ_KEY);
  const tree = { ...(all[S.tree] || {}) };
  for (const id of ids) {
    if (day) tree[id] = day;
    else delete tree[id];
  }
  all[S.tree] = tree;
  write(REQ_KEY, all);
}

/** Forgets the requests kept in this browser for the open tree, once they are in the records. */
export function forgetBrowserRequested() {
  const all = readAll(REQ_KEY);
  delete all[S.tree];
  write(REQ_KEY, all);
}
