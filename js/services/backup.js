/**
 * Lignée backup (.json): full copy of the tree, restorable as is.
 * Format 2: { format: 'lignee', version: 2, name, exportedAt, people: [{id, ...}], unions: [{id, ...}],
 * sources: [{id, ...}] } (name: tree name, optional). People cite the shared sources (model/sources.js).
 * Format 1, read and converted: no `sources` list, each person carrying copies of their documents.
 */
import { S, treeName } from '../state.js';
import { t } from '../i18n.js';
import { migratePeople, inlineSources } from '../model/sources.js';

// Version of the backup format this Lignée writes and reads; a newer file is refused
export const FORMAT_VERSION = 2;

const SAFE_ID = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
const isSafeId = (s) => typeof s === 'string' && SAFE_ID.test(s) && s !== '.' && s !== '..';

/**
 * Backup of the open tree, or of tree `src` ({ name, createdAt, people, unions, sources } as Maps).
 * Records still in format 1 (online database) are converted on the way. With `v1`, the format 1
 * backup older Lignée read: each person carries copies of the documents they cite.
 */
export function buildBackup(src, { v1 = false } = {}) {
  const t = src || {
    name: treeName(),
    createdAt: (S.trees.get(S.tree) || {}).createdAt,
    people: S.people,
    unions: S.unions,
    sources: S.sources,
  };
  const { people, sources } = migratePeople(t.people, new Map(t.sources || []));
  const list = (map) => [...map].map(([id, x]) => Object.assign({ id }, x));
  return JSON.stringify({
    format: 'lignee',
    version: v1 ? 1 : FORMAT_VERSION,
    name: t.name,
    createdAt: t.createdAt || undefined,
    exportedAt: new Date().toISOString(),
    people: list(v1 ? inlineSources(people, sources) : people),
    unions: list(t.unions),
    ...(v1 ? {} : { sources: list(sources) }),
  }, null, 2);
}

/** True if `o` (a parsed backup) was written by a newer Lignée, in a format this one doesn't know. */
export const isNewerFormat = (o) => !!o && o.format === 'lignee' && Number(o.version) > FORMAT_VERSION;

/**
 * Reads a backup and returns { name, people: [{id, data}], unions: [{id, data}], sources: [{id, data}] }.
 * Format 1 is converted: its documents become shared sources, cited by the people.
 * A backup from a newer format is refused (error code `newer`): read here, part of it would be lost.
 */
export function parseBackup(text) {
  const o = JSON.parse(text);
  if (!o || o.format !== 'lignee') throw new Error(t('backup.invalid'));
  if (isNewerFormat(o)) throw Object.assign(new Error(t('backup.newer')), { code: 'newer' });
  const convert = (list) => (Array.isArray(list) ? list : [])
    .filter((x) => x && isSafeId(x.id))
    .map((x) => {
      const data = Object.assign({}, x);
      delete data.id;
      return { id: x.id, data };
    });
  const name = typeof o.name === 'string' ? o.name.trim().slice(0, 80) : '';
  const known = new Map(convert(o.sources).map((x) => [x.id, x.data]));
  const { people, sources } = migratePeople(new Map(convert(o.people).map((x) => [x.id, x.data])), known);
  const entries = (map) => [...map].map(([id, data]) => ({ id, data }));
  return { name, people: entries(people), unions: convert(o.unions), sources: entries(sources) };
}
