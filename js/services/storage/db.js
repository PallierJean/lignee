/**
 * Mode « db » : base de données en ligne fournie par claude.ai (window.claude).
 * Collection « trees » (nom de chaque arbre), « people » et « unions » : chaque
 * document porte le champ `tree` (absent = arbre de départ). Synchronisées en direct.
 */
import { S, services } from '../../state.js';
import { DEFAULT_TREE } from '../../config.js';
import { t } from '../../i18n.js';
import { sleep, pool } from '../../utils/helpers.js';
import { toast } from '../../ui/toast.js';
import { renderAll, afterData } from '../../ui/render.js';
import { ensureTree, sortTrees } from './trees.js';

/**
 * Exécute une écriture en base, avec nouvelle tentative sur les erreurs passagères
 * et un message clair sur les autres.
 */
export async function withRetry(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const code = e && e.code;
      if (code === 'unavailable' && attempt < 1) {
        await sleep(300 + Math.random() * 600);
        continue;
      }
      if (code === 'resource_exhausted' && attempt < 5) {
        await sleep(1200 * (attempt + 1));
        continue;
      }
      if (code === 'invalid_argument' && !S.writeKnown) {
        S.canWrite = false;
        S.edit = null;
        renderAll(true);
        toast(t('st.readonly'), true);
      } else if (code === 'quota_exceeded') {
        toast(t('st.full'), true);
      } else if (code === 'revoked' || code === 'not_granted') {
        S.canWrite = false;
        renderAll(true);
      } else {
        toast(t('st.failed'), true);
      }
      throw e;
    }
  }
}

const doc = (collection, id) => services.db.collection(collection).doc(id);

/** Écrit un document de l'arbre ouvert dans la base en ligne. */
export const dbSet = (collection, id, data) => withRetry(
  () => doc(collection, id).set(Object.assign({}, data, { tree: S.tree })),
);

export const dbUpdate = (collection, id, patch) => withRetry(() => doc(collection, id).update(patch));

export const dbDelete = (collection, id) => withRetry(() => doc(collection, id).delete());

/* ---------- Synchronisation en direct ---------- */

// Tous les documents reçus, tous arbres confondus
const docs = { people: new Map(), unions: new Map(), trees: new Map() };
const treeOf = (d) => d.tree || DEFAULT_TREE;

function withoutTree(d) {
  const o = Object.assign({}, d);
  delete o.tree;
  return o;
}

/** Recalcule la liste des arbres et les personnes / unions de l'arbre ouvert. */
export function refreshDb() {
  const counts = new Map();
  for (const d of docs.people.values()) counts.set(treeOf(d), (counts.get(treeOf(d)) || 0) + 1);
  const trees = new Map();
  for (const [id, x] of docs.trees) trees.set(id, { name: x.name || t('ts.default'), createdAt: x.createdAt || 0 });
  // Arbre de départ : données d'avant la gestion de plusieurs arbres, ou base vide
  if (!trees.has(DEFAULT_TREE) && (counts.has(DEFAULT_TREE) || !trees.size)) {
    trees.set(DEFAULT_TREE, { name: t('ts.default'), createdAt: 0 });
  }
  for (const [id, t] of trees) t.count = counts.get(id) || 0;
  S.trees = sortTrees(trees);
  if (S.loadedT) ensureTree();

  const pick = (map) => new Map([...map].filter(([, d]) => treeOf(d) === S.tree).map(([id, d]) => [id, withoutTree(d)]));
  S.people = pick(docs.people);
  S.unions = pick(docs.unions);
}

export function subscribe() {
  const loaded = { people: 'loadedP', unions: 'loadedU', trees: 'loadedT' };
  const listen = (collection) => services.db.collection(collection).onSnapshot(
    (snap) => {
      const map = new Map();
      for (const doc of snap.docs) map.set(doc.id, doc.data());
      docs[collection] = map;
      S[loaded[collection]] = true;
      refreshDb();
      afterData();
    },
    (err) => {
      const code = err && err.code;
      if (code === 'unavailable') setTimeout(() => listen(collection), 1500 + Math.random() * 1500);
      else if (code === 'revoked') {
        S.canWrite = false;
        renderAll();
      }
    },
  );
  listen('people');
  listen('unions');
  listen('trees');
}

/* ---------- Gestion des arbres ---------- */

/** Crée ou renomme un arbre dans la base. */
export async function setDbTree(id, tree) {
  const d = { name: tree.name, createdAt: tree.createdAt || 0 };
  await withRetry(() => doc('trees', id).set(d));
  docs.trees.set(id, d); // sans attendre la synchronisation, pour pouvoir l'ouvrir tout de suite
}

/** Supprime un arbre et toutes ses fiches de la base. */
export async function deleteDbTree(id) {
  for (const collection of ['unions', 'people']) {
    const ids = [...docs[collection]].filter(([, d]) => treeOf(d) === id).map(([k]) => k);
    await pool(ids, 3, async (k) => {
      await dbDelete(collection, k);
      docs[collection].delete(k);
    });
  }
  if (docs.trees.has(id)) await dbDelete('trees', id);
  docs.trees.delete(id);
}
