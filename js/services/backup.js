/**
 * Sauvegarde Lignée (.json) : copie complète de l'arbre, restaurable à l'identique.
 * Format : { format: 'lignee', version: 1, name, exportedAt, people: [{id, ...}], unions: [{id, ...}] }
 * (name : nom de l'arbre, facultatif)
 */
import { S, treeName } from '../state.js';
import { t } from '../i18n.js';

const SAFE_ID = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
const isSafeId = (s) => typeof s === 'string' && SAFE_ID.test(s) && s !== '.' && s !== '..';

/** Sauvegarde de l'arbre ouvert, ou de l'arbre `src` ({ name, createdAt, people, unions } en Map). */
export function buildBackup(src) {
  const t = src || {
    name: treeName(),
    createdAt: (S.trees.get(S.tree) || {}).createdAt,
    people: S.people,
    unions: S.unions,
  };
  return JSON.stringify({
    format: 'lignee',
    version: 1,
    name: t.name,
    createdAt: t.createdAt || undefined,
    exportedAt: new Date().toISOString(),
    people: [...t.people].map(([id, p]) => Object.assign({ id }, p)),
    unions: [...t.unions].map(([id, u]) => Object.assign({ id }, u)),
  }, null, 2);
}

/** Lit une sauvegarde et renvoie { name, people: [{id, data}], unions: [{id, data}] }. */
export function parseBackup(text) {
  const o = JSON.parse(text);
  if (!o || o.format !== 'lignee') throw new Error(t('backup.invalid'));
  const convert = (list) => (Array.isArray(list) ? list : [])
    .filter((x) => x && isSafeId(x.id))
    .map((x) => {
      const data = Object.assign({}, x);
      delete data.id;
      return { id: x.id, data };
    });
  const name = typeof o.name === 'string' ? o.name.trim().slice(0, 80) : '';
  return { name, people: convert(o.people), unions: convert(o.unions) };
}
