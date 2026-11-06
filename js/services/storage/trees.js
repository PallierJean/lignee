/** Tree collection: rules shared by the three storage modes. */
import { S } from '../../state.js';
import { DEFAULT_TREE } from '../../config.js';
import { t } from '../../i18n.js';

/** Ensures at least one tree, and an open tree that exists. */
export function ensureTree() {
  if (!S.trees.size) S.trees.set(DEFAULT_TREE, { name: t('ts.default'), createdAt: 0, count: 0 });
  if (!S.trees.has(S.tree)) S.tree = S.trees.keys().next().value;
}

/** Sorted list: oldest first. */
export const sortTrees = (entries) => new Map([...entries].sort((a, b) =>
  (a[1].createdAt || 0) - (b[1].createdAt || 0) || a[1].name.localeCompare(b[1].name)));
