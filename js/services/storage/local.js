/**
 * Mode « local » : stockage du navigateur (localStorage), quand l'application
 * est ouverte ailleurs (par exemple avec python3 -m http.server).
 */
import { S } from '../../state.js';
import { LOCAL_KEY, TREES_KEY, TREE_KEY, DEFAULT_TREE } from '../../config.js';
import { t } from '../../i18n.js';
import { toast } from '../../ui/toast.js';
import { ensureTree, sortTrees } from './trees.js';

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null; // données illisibles ou stockage bloqué
  }
}

/** Arbres gardés dans ce navigateur : [{ id, name, createdAt }]. */
export function readLocalTrees() {
  const list = readJSON(TREES_KEY);
  if (Array.isArray(list)) return list.filter((t) => t && typeof t.id === 'string');
  // Ancien format (un seul arbre) : il devient l'arbre de départ
  const old = readJSON(LOCAL_KEY);
  if (!old) return [];
  try {
    localStorage.setItem(TREE_KEY + DEFAULT_TREE, JSON.stringify(old));
  } catch (e) {
    /* stockage plein ou bloqué : l'ancien arbre reste lisible à son ancienne clé */
  }
  return [{ id: DEFAULT_TREE, name: t('ts.default'), createdAt: 0 }];
}

/** Données d'un arbre du navigateur, en Map. */
export function readLocalData(id) {
  const data = readJSON(TREE_KEY + id) || (id === DEFAULT_TREE && readJSON(LOCAL_KEY)) || {};
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

/** Enregistre l'arbre ouvert dans le navigateur. */
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
    /* stockage bloqué */
  }
}

export function saveTreesList() {
  try {
    writeLocalTrees();
  } catch (e) {
    toast(t('st.browserRefused'), true);
  }
}
