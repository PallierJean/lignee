/**
 * Lignée backup (.json): full copy of the tree, restorable as is.
 * Format 2: { format: 'lignee', version: 2, name, exportedAt, people: [{id, ...}], unions: [{id, ...}],
 * sources: [{id, ...}] } (name: tree name, optional). People and unions cite the shared sources
 * (model/sources.js). Another version, older or newer, is refused.
 */
import { S, treeName } from '../state.js';
import { t } from '../i18n.js';

// Version of the backup format this Lignée writes and reads; any other is refused
export const FORMAT_VERSION = 2;

const SAFE_ID = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
const isSafeId = (s) => typeof s === 'string' && SAFE_ID.test(s) && s !== '.' && s !== '..';

/** Backup of the open tree, or of tree `src` ({ name, createdAt, people, unions, sources } as Maps). */
export function buildBackup(src) {
  const t = src || {
    name: treeName(),
    createdAt: (S.trees.get(S.tree) || {}).createdAt,
    people: S.people,
    unions: S.unions,
    sources: S.sources,
  };
  const list = (map) => [...(map || [])].map(([id, x]) => Object.assign({ id }, x));
  return JSON.stringify({
    format: 'lignee',
    version: FORMAT_VERSION,
    name: t.name,
    createdAt: t.createdAt || undefined,
    exportedAt: new Date().toISOString(),
    people: list(t.people),
    unions: list(t.unions),
    sources: list(t.sources),
  }, null, 2);
}

/** True if `o` (a parsed backup) was written by a newer Lignée, in a format this one doesn't know. */
export const isNewerFormat = (o) => !!o && o.format === 'lignee' && Number(o.version) > FORMAT_VERSION;

/** True if `o` was written by a Lignée older than 2.0 (format 1), which this one no longer reads. */
export const isOlderFormat = (o) => !!o && o.format === 'lignee' && !(Number(o.version) >= FORMAT_VERSION);

/**
 * Reads a backup and returns { name, people: [{id, data}], unions: [{id, data}], sources: [{id, data}] }.
 * A backup in another format is refused (error code `newer` or `old`): read here, part of it would be lost.
 */
export function parseBackup(text) {
  const o = JSON.parse(text);
  if (!o || o.format !== 'lignee') throw new Error(t('backup.invalid'));
  if (isNewerFormat(o)) throw Object.assign(new Error(t('backup.newer')), { code: 'newer' });
  if (isOlderFormat(o)) throw Object.assign(new Error(t('backup.old')), { code: 'old' });
  const convert = (list) => (Array.isArray(list) ? list : [])
    .filter((x) => x && isSafeId(x.id))
    .map((x) => {
      const data = Object.assign({}, x);
      delete data.id;
      return { id: x.id, data };
    });
  const name = typeof o.name === 'string' ? o.name.trim().slice(0, 80) : '';
  return { name, people: convert(o.people), unions: convert(o.unions), sources: convert(o.sources) };
}
