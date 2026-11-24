/**
 * Where a photo file is kept, in the tree's photos folder (on this computer and in a GitHub
 * repository): a person's portrait and documents in a folder named after them ("DUPONT_Jean"),
 * a marriage's documents in the couple's folder ("DUPONT_Jean_X_FAURE_Marie", the man first),
 * everything else (gallery images, documents nobody cites) in "galerie".
 * A record keeps "photos/<folder>/<file>"; one saved before keeps "photos/<file>" until it is filed.
 */
import { given, surname, photoLabel } from './people.js';
import { yearOf } from '../utils/dates.js';

export const GALLERY_FOLDER = 'galerie';

const part = (s) => String(s || '').normalize('NFC').replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-|-$/g, '');

/** "DUPONT_Jean" ("FAURE_Marie" with only a maiden name), '' with no name at all. */
export function nameFolder(p) {
  const last = part(surname(p) || String((p && p.maidenName) || '').trim().toUpperCase());
  const first = part(given(p));
  return [last, first].filter(Boolean).join('_');
}

/**
 * Folder of person `p` among `people` (Map id -> person): "DUPONT_Jean", "DUPONT_Jean_1850" when
 * someone else of the tree has the same name (the year of birth tells them apart), "sans-nom".
 */
export function personFolder(p, people, id = null) {
  const base = nameFolder(p);
  if (!base) return 'sans-nom';
  const year = yearOf(p.birthDate);
  const twin = [...people].some(([pid, x]) => x !== p && pid !== id && !(p.createdAt && x.createdAt === p.createdAt) && nameFolder(x) === base);
  return twin && year ? `${base}_${year}` : base;
}

/** Folder of a photo reference ("photos/DUPONT_Jean/x.jpg" → "DUPONT_Jean"), '' for one not filed. */
export const folderOfRef = (ref) => (/^photos\/([^/]+)\//.exec(String(ref || '')) || [])[1] || '';

// A file Lignée named: "<label>-<uuid>.<ext>"
const NAMED_FILE = /-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp|gif))$/;

/**
 * Where photo `ref` belongs: "photos/<folder>/<file>". With a `label` ("DUPONT-Jean"), a file Lignée
 * named takes it in place of the one it was saved under (a person renamed), the same uuid after it.
 */
export function filedRef(ref, folder, label = '') {
  const file = String(ref || '').split('/').pop();
  const m = label ? NAMED_FILE.exec(file) : null;
  return `photos/${folder}/${m ? label.slice(0, 80) + '-' + m[1] : file}`;
}

/**
 * Folders of a tree's records: { person(id), source(id), couple(union id), media() }. A document a
 * union cites (its marriage certificate) goes to the couple's folder, the man's name first. Any
 * other shared document goes with the person it is about (the first citing it with no other part
 * in it), else the first who cites it; between two people it is about equally, the man. One
 * nobody cites goes to the gallery. `label(kind, id, ref)`: the name file `ref` of a person's folder
 * takes ("DUPONT-Jean", the person's name of today), '' to keep its own: in a couple's folder or the
 * gallery, or a document named after its source.
 */
export function photoFolders({ people, unions = new Map(), sources = new Map() }) {
  const folders = new Map();
  const person = (id) => {
    if (!folders.has(id)) folders.set(id, people.has(id) ? personFolder(people.get(id), people, id) : GALLERY_FOLDER);
    return folders.get(id);
  };
  const man = (id) => (people.get(id) || {}).sex === 'M';
  const couple = (uid) => {
    const u = unions.get(uid) || {};
    const ids = [u.a, u.b].filter((id) => id && people.has(id));
    if (!ids.length) return GALLERY_FOLDER;
    if (ids.length > 1 && man(ids[1]) && !man(ids[0])) ids.reverse();
    return ids.map(person).join('_X_').slice(0, 80); // as long as the server keeps a folder name
  };
  const owner = new Map(); // source id -> { id, rank } (a person) or { union, rank: -1 }
  const claim = (source, id, rank) => {
    const was = owner.get(source);
    if (!sources.has(source) || !people.has(id)) return;
    if (!was || rank < was.rank || (rank === was.rank && man(id) && !man(was.id))) owner.set(source, { id, rank });
  };
  for (const [id, p] of people) {
    for (const c of Array.isArray(p && p.citations) ? p.citations : []) {
      if (c && c.source) claim(c.source, id, c.role && c.role !== 'subject' ? 1 : 0);
    }
  }
  for (const [uid, u] of unions) {
    for (const c of Array.isArray(u && u.citations) ? u.citations : []) {
      const was = c && owner.get(c.source);
      if (c && c.source && sources.has(c.source) && !(was && was.union) && [u.a, u.b].some((id) => people.has(id))) owner.set(c.source, { union: uid, rank: -1 });
    }
  }
  const source = (id) => {
    const o = owner.get(id);
    if (!o) return GALLERY_FOLDER;
    return o.union ? couple(o.union) : person(o.id);
  };
  const label = (kind, id, ref = '') => {
    const o = kind === 'source' ? owner.get(id) : null;
    const pid = kind === 'person' ? id : o && !o.union ? o.id : '';
    if (!pid || !people.has(pid)) return '';
    if (kind === 'source') {
      // A document named after its source (its title, its kind) keeps that name
      const s = sources.get(id) || {};
      const file = String(ref || '').split('/').pop();
      const titled = photoLabel({ given: s.title || s.kind || 'source' });
      // Cut at 80 characters on this computer, whole in a GitHub repository
      if (file.startsWith(titled + '-') || file.startsWith(titled.slice(0, 80) + '-')) return '';
    }
    return photoLabel(people.get(pid));
  };
  return { person, source, couple, media: () => GALLERY_FOLDER, label };
}
