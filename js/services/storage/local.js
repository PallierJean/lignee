/**
 * "Local" mode: browser storage, when the application is opened elsewhere (GitHub Pages, or
 * python3 -m http.server).
 *
 * The data of each tree goes to IndexedDB, which takes hundreds of megabytes: a tree with its
 * photos and documents as data URLs doesn't fit in localStorage (about 5 million characters per
 * site). IndexedDB is read once at opening into `cache`, so reads stay synchronous; trees left in
 * localStorage by older versions move there at that moment. Without IndexedDB (blocked, or Node
 * in the tests), everything stays in localStorage. The list of trees always stays there: it's small.
 */
import { S } from '../../state.js';
import { TREES_KEY, TREE_KEY, DEFAULT_TREE, EXAMPLE_FILE } from '../../config.js';
import { t } from '../../i18n.js';
import { say, failure } from '../notify.js';
import { parseBackup } from '../backup.js';
import { ensureTree, sortTrees } from './trees.js';

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null; // unreadable data or blocked storage
  }
}

/** Trees kept in this browser: [{ id, name, createdAt }]. */
export function readLocalTrees() {
  const list = readJSON(TREES_KEY);
  return Array.isArray(list) ? list.filter((t) => t && typeof t.id === 'string') : [];
}

/* ---------- IndexedDB ---------- */

const DB_NAME = 'lignee';
const STORE = 'trees'; // key: tree id, value: { people, unions, sources, media } as objects

let db = null;            // IDBDatabase once opened; null: localStorage is used
let opening = null;       // Promise of the opening, made once
let opened = false;       // the opening is over (whatever its outcome)
const cache = new Map();  // tree id -> its data read from IndexedDB, or last saved there

/** The result of an IndexedDB request, as a Promise. */
const done = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

/** Runs `fn(store)` in a transaction; resolves once the transaction is written to disk. */
function inStore(mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const out = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

function openDb() {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(STORE);
  return done(req);
}

/**
 * Opens IndexedDB and reads every tree into the cache, moving there the trees still kept in
 * localStorage. Done once; if IndexedDB can't be opened, localStorage stays in use.
 */
export function openBrowserStore() {
  if (!opening) opening = (typeof indexedDB === 'undefined' ? Promise.resolve() : loadDb()).finally(() => { opened = true; });
  return opening;
}

async function loadDb() {
  try {
    const opened = await openDb();
    let keys = [];
    let values = [];
    await new Promise((resolve, reject) => {
      const tx = opened.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      done(store.getAllKeys()).then((k) => { keys = k; });
      done(store.getAll()).then((v) => { values = v; });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db = opened;
    keys.forEach((k, i) => cache.set(String(k), values[i]));
  } catch (e) {
    db = null; // blocked (private browsing in some browsers…): localStorage
    return;
  }
  for (const { id } of readLocalTrees()) {
    const old = readJSON(TREE_KEY + id);
    if (!old) continue;
    try {
      if (!cache.has(id)) {
        await inStore('readwrite', (store) => store.put(old, id));
        cache.set(id, old);
      }
      localStorage.removeItem(TREE_KEY + id); // frees localStorage once the copy is written
    } catch (e) {
      /* copy refused: this tree stays where it was, read from localStorage */
    }
  }
  // Asks the browser not to clear these data when the disk gets full (granted silently or not at all)
  try {
    navigator.storage.persist().catch(() => {});
  } catch (e) {
    /* no StorageManager */
  }
}

/** For the tests: forgets the opened database, as a new page would. */
export function forgetBrowserStore() {
  db = null;
  opening = null;
  opened = false;
  cache.clear();
}

/** Data of a browser tree, as Maps. */
export function readLocalData(id) {
  const data = (db && cache.get(id)) || readJSON(TREE_KEY + id) || {};
  const map = (o) => new Map(Object.entries(o && typeof o === 'object' ? o : {}));
  return { people: map(data.people), unions: map(data.unions), sources: map(data.sources), media: map(data.media) };
}

function writeLocalTrees() {
  localStorage.setItem(TREES_KEY, JSON.stringify(
    [...S.trees].map(([id, t]) => ({ id, name: t.name, createdAt: t.createdAt || 0 })),
  ));
}

/** First visit, no tree in this browser: stores the example family there. */
export async function seedExample() {
  if (readLocalTrees().length) return;
  try {
    const res = await fetch(EXAMPLE_FILE, { cache: 'no-store' });
    if (!res.ok) return;
    const { name, people, unions, sources, media } = parseBackup(await res.text());
    const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x.data]));
    localStorage.setItem(TREE_KEY + DEFAULT_TREE, JSON.stringify({ people: byId(people), unions: byId(unions), sources: byId(sources), media: byId(media) }));
    localStorage.setItem(TREES_KEY, JSON.stringify([{ id: DEFAULT_TREE, name, createdAt: 0 }]));
  } catch (e) {
    /* file missing or storage blocked: the application starts with an empty tree */
  }
}

/** Reads the browser's trees and opens the current one (after opening IndexedDB, once). */
export function loadLocal() {
  if (opened || typeof indexedDB === 'undefined') {
    showLocal(); // nothing to wait for: right away
    return Promise.resolve();
  }
  return openBrowserStore().then(showLocal);
}

function showLocal() {
  S.trees = sortTrees(readLocalTrees().map((x) => [x.id, {
    name: x.name || t('ts.default'),
    createdAt: x.createdAt || 0,
    count: readLocalData(x.id).people.size,
  }]));
  ensureTree();
  loadLocalTree();
}

export function loadLocalTree() {
  const data = readLocalData(S.tree);
  S.people = data.people;
  S.unions = data.unions;
  S.sources = data.sources;
  S.media = data.media;
}

// Browsers keep about 5 million characters per site: past this size, the user is warned once
export const NEARLY_FULL = 4_000_000;
let warnedFull = false;

const isQuotaError = (e) => !!e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);

/**
 * Saves the open tree in the browser. Throws (or rejects, with IndexedDB) if the browser
 * refused it, so the action doesn't claim the change was saved.
 */
export function saveBrowserTree() {
  const data = {
    people: Object.fromEntries(S.people),
    unions: Object.fromEntries(S.unions),
    sources: Object.fromEntries(S.sources),
    media: Object.fromEntries(S.media),
  };
  if (db) return saveInDb(S.tree, data);
  const json = JSON.stringify(data);
  try {
    localStorage.setItem(TREE_KEY + S.tree, json);
    writeLocalTrees();
  } catch (e) {
    throw failure(isQuotaError(e) ? 'st.browserFull' : 'st.browserRefused', e);
  }
  if (json.length > NEARLY_FULL && !warnedFull) {
    warnedFull = true;
    say('st.browserNearlyFull', true);
  }
}

async function saveInDb(id, data) {
  try {
    await inStore('readwrite', (store) => store.put(data, id));
  } catch (e) {
    throw failure(isQuotaError(e) ? 'st.browserFull' : 'st.browserRefused', e);
  }
  cache.set(id, data);
  try {
    writeLocalTrees();
  } catch (e) {
    /* the list keeps its previous state; the data are saved */
  }
}

export function deleteBrowserTree(id) {
  cache.delete(id);
  if (db) inStore('readwrite', (store) => store.delete(id)).catch(() => {});
  try {
    localStorage.removeItem(TREE_KEY + id);
  } catch (e) {
    /* storage blocked */
  }
}

export function saveTreesList() {
  try {
    writeLocalTrees();
  } catch (e) {
    say('st.browserRefused', true);
  }
}
