/**
 * "Local" mode: browser storage (localStorage), when the application
 * is opened elsewhere (for example with python3 -m http.server).
 */
import { S } from '../../state.js';
import { TREES_KEY, TREE_KEY, DEFAULT_TREE, EXAMPLE_FILE } from '../../config.js';
import { t } from '../../i18n.js';
import { toast } from '../../ui/toast.js';
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

/** Data of a browser tree, as Maps. */
export function readLocalData(id) {
  const data = readJSON(TREE_KEY + id) || {};
  return {
    people: new Map(Object.entries(data.people || {})),
    unions: new Map(Object.entries(data.unions || {})),
  };
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
    const { name, people, unions } = parseBackup(await res.text());
    const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x.data]));
    localStorage.setItem(TREE_KEY + DEFAULT_TREE, JSON.stringify({ people: byId(people), unions: byId(unions) }));
    localStorage.setItem(TREES_KEY, JSON.stringify([{ id: DEFAULT_TREE, name, createdAt: 0 }]));
  } catch (e) {
    /* file missing or storage blocked: the application starts with an empty tree */
  }
}

export function loadLocal() {
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
}

/** Saves the open tree in the browser. */
export function saveBrowserTree() {
  try {
    localStorage.setItem(TREE_KEY + S.tree, JSON.stringify({
      people: Object.fromEntries(S.people),
      unions: Object.fromEntries(S.unions),
    }));
    writeLocalTrees();
  } catch (e) {
    toast(t('st.browserRefused'), true);
  }
}

export function deleteBrowserTree(id) {
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
    toast(t('st.browserRefused'), true);
  }
}
