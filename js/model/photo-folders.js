/**
 * Where a photo file is kept, in the tree's photos folder (on this computer and in a GitHub
 * repository): a person's portrait and documents in a folder named after them ("DUPONT_Jean"),
 * everything else (gallery images, documents nobody cites) in "galerie".
 * A record keeps "photos/<folder>/<file>"; one saved before keeps "photos/<file>" until it is filed.
 */
import { given, surname } from './people.js';
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

/**
 * Folders of a tree's records: { person(id), source(id), media() }. A shared document goes with the
 * person it is about (the first citing it with no other part in it), else the first who cites
 * it, else the first spouse of a union citing it; one nobody cites goes to the gallery.
 */
export function photoFolders({ people, unions = new Map(), sources = new Map() }) {
  const folders = new Map();
  const person = (id) => {
    if (!folders.has(id)) folders.set(id, people.has(id) ? personFolder(people.get(id), people, id) : GALLERY_FOLDER);
    return folders.get(id);
  };
  const owner = new Map(); // source id -> { id, rank }
  const claim = (source, id, rank) => {
    const was = owner.get(source);
    if (sources.has(source) && people.has(id) && (!was || rank < was.rank)) owner.set(source, { id, rank });
  };
  for (const [id, p] of people) {
    for (const c of Array.isArray(p && p.citations) ? p.citations : []) {
      if (c && c.source) claim(c.source, id, c.role && c.role !== 'subject' ? 1 : 0);
    }
  }
  for (const [, u] of unions) {
    for (const c of Array.isArray(u && u.citations) ? u.citations : []) {
      if (c && c.source) claim(c.source, u.a || u.b, 2);
    }
  }
  return {
    person,
    source: (id) => (owner.has(id) ? person(owner.get(id).id) : GALLERY_FOLDER),
    media: () => GALLERY_FOLDER,
  };
}
