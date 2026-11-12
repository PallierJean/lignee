/**
 * "file" mode: one file per tree in the project's data/arbres/, written by the
 * local server (node server.js). Same format as the .json backup, but the
 * photos are separate files, in data/arbres/<tree id>/photos/.
 */
import { S, treeName } from '../../state.js';
import { buildBackup, parseBackup, FORMAT_VERSION } from '../backup.js';
import { isPhotoData, isPhotoFile, photoLabel, photoSrc } from '../../model/people.js';
import { pool } from '../../utils/helpers.js';
import { GALLERY_FILE } from '../../model/media.js';
import { say, failure } from '../notify.js';
import { ensureTree, sortTrees } from './trees.js';
import { readLocalTrees, readLocalData } from './local.js';

const API = 'api/trees/';

// The local server knows an older backup format than this page: it was started before
// Lignée was updated. It would drop what it doesn't know (photos of shared sources): read only.
let serverTooOld = false;

async function fetchTrees() {
  const res = await fetch(API, { cache: 'no-store' });
  if (!res.ok) throw new Error(String(res.status));
  serverTooOld = Number(res.headers.get('X-Lignee-Format') || 1) < FORMAT_VERSION;
  const list = await res.json();
  if (!Array.isArray(list)) throw new Error('Réponse inattendue');
  return list;
}

// Version of the open tree, received from the server: a save never overwrites a more
// recent version (another tab, another device, an edit of the file)
let version = null;

async function putFileTree(id, body, keepPhotos, ifMatch) {
  const res = await fetch(API + encodeURIComponent(id) + (keepPhotos ? '?keepPhotos=1' : ''), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(ifMatch ? { 'If-Match': ifMatch } : {}) },
    body,
  });
  if (!res.ok) throw Object.assign(new Error(res.status + ' ' + (await res.text())), { status: res.status });
  return res.headers.get('ETag');
}

const emptyBackup = (name, createdAt) => buildBackup({ name, createdAt, people: new Map(), unions: new Map(), sources: new Map(), media: new Map() });

/**
 * Loads the list of trees in data/arbres/ then the open tree, through the local
 * server. Returns false if the server isn't there (another web server…).
 */
export async function loadFile() {
  let list;
  try {
    list = await fetchTrees();
  } catch (e) {
    return false;
  }
  S.mode = 'file';
  if (serverTooOld) say('st.oldServer', true);

  if (!list.length && !serverTooOld) {
    // First launch: the trees already kept in this browser are taken over, if any
    for (const t of readLocalTrees()) {
      const data = readLocalData(t.id);
      if (!data.people.size && !data.unions.size) continue;
      try {
        await putFileTree(t.id, buildBackup({ name: t.name, createdAt: t.createdAt, ...data }));
        list.push({ id: t.id, name: t.name, createdAt: t.createdAt, count: data.people.size });
      } catch (e) {
        /* copy impossible: the tree stays in the browser */
      }
    }
  }
  S.trees = sortTrees(list.map((t) => [t.id, { name: t.name, createdAt: t.createdAt || 0, count: t.count || 0 }]));
  ensureTree();
  await loadFileTree();
  return true;
}

export async function loadFileTree() {
  await fileQueue; // pending saves go first
  version = null;
  S.people = new Map();
  S.unions = new Map();
  S.sources = new Map();
  S.media = new Map();
  let text;
  try {
    const res = await fetch(API + encodeURIComponent(S.tree), { cache: 'no-store' });
    if (res.status === 404) return; // tree not saved yet
    if (!res.ok) throw new Error(String(res.status));
    version = res.headers.get('ETag');
    text = await res.text();
  } catch (e) {
    say('st.readFailed', true);
    return;
  }
  let data;
  try {
    data = parseBackup(text);
  } catch (e) {
    if (e.code !== 'newer' && e.code !== 'old') throw e;
    // Another format: shown empty and read-only, so that nothing overwrites the file or its photos
    S.canWrite = false;
    say(e.code === 'old' ? 'backup.old' : 'backup.newer', true);
    return;
  }
  S.canWrite = !serverTooOld;
  S.people = new Map(data.people.map((x) => [x.id, x.data]));
  S.unions = new Map(data.unions.map((x) => [x.id, x.data]));
  S.sources = new Map(data.sources.map((x) => [x.id, x.data]));
  S.media = new Map(data.media.map((x) => [x.id, x.data]));
  if (serverTooOld) return; // nothing written, no photo swept, until the server is restarted
  // Photos still embedded in the record (saved before photo files existed): they are moved out.
  // A tree in an older format is saved again in the current one (its gallery leaves the records)
  const older = Number((JSON.parse(text) || {}).version) < FORMAT_VERSION;
  // Gallery files still named after a person (Lignée before 4.0) take the gallery's name
  const changed = (await storePhotos()) + (await renameGalleryFiles());
  if (changed || older) await saveFile().catch(() => {}); // message already shown
  // Photos removed during the previous session: nothing can restore them any more
  fetch(API + encodeURIComponent(S.tree) + '/photos/sweep', { method: 'POST' }).catch(() => {});
}

/* ---------- Photos as files ---------- */

/**
 * Photo to save in record `p`: in file mode, a data URL becomes a
 * file in data/arbres/<tree id>/photos/ and the record keeps "photos/<file>".
 * In the other modes, the photo stays embedded.
 */
export async function storePhoto(photo, p) {
  if (S.mode !== 'file' || !isPhotoData(photo)) return photo;
  try {
    const res = await fetch(API + encodeURIComponent(S.tree) + '/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: photoLabel(p), data: photo }),
    });
    if (!res.ok) throw new Error(res.status + ' ' + (await res.text()));
    return (await res.json()).photo;
  } catch (e) {
    throw failure('st.photoFailed', e);
  }
}

/** Image of a record besides its main one: the back of a source's document or of a gallery image. */
const attached = (p) => [p.back].filter(Boolean);
/** True if the record contains a photo or a document still embedded. */
const hasPhotoData = (p) => isPhotoData(p.photo) || attached(p).some(isPhotoData);

/**
 * Record whose images have gone through `convert`: a person's photo, a shared source's document,
 * a gallery image; and the back of the last two.
 */
export async function convertPhotos(p, convert) {
  const out = Object.assign({}, p);
  if (p.photo) out.photo = await convert(p.photo);
  if (p.back) out.back = await convert(p.back);
  return out;
}

/** Name a shared source's image file starts with: its title, or its kind. */
const sourceLabel = (s) => ({ given: s.title || s.kind || 'source' });

/** Name a gallery image's file starts with: the same for all, not that of a person ("galerie-…"). */
export const GALLERY_LABEL = { given: 'galerie' };

/** Moves the open tree's embedded photos out to files: people's and shared sources'. Returns the number of records changed. */
export async function storePhotos() {
  if (S.mode !== 'file') return 0;
  let n = 0;
  for (const [map, label] of [[S.people, (p) => p], [S.sources, sourceLabel], [S.media, () => GALLERY_LABEL]]) {
    const ids = [...map].filter(([, p]) => hasPhotoData(p)).map(([id]) => id);
    await pool(ids, 4, async (id) => {
      const p = map.get(id);
      try {
        const stored = await convertPhotos(p, (photo) => storePhoto(photo, label(p)));
        if (map.get(id) === p) map.set(id, stored);
        n++;
      } catch (e) {
        /* the photo stays embedded: it still shows, another try on the next load */
      }
    });
  }
  return n;
}

export { GALLERY_FILE };

/**
 * Gallery images whose files are still named after a person (saved before Lignée 4.0, when each
 * image belonged to a record): the file is copied as "galerie-…" and the image cites the copy; the
 * old file goes with the next sweep, unless something else cites it (a record's portrait).
 * Returns the number of images changed; a file that can't be copied keeps its name.
 */
export async function renameGalleryFiles() {
  if (S.mode !== 'file') return 0;
  const copies = new Map(); // old file -> Promise of the copy (a file cited twice is copied once)
  const rename = (photo) => {
    if (!isPhotoFile(photo) || GALLERY_FILE.test(photo)) return photo;
    if (!copies.has(photo)) copies.set(photo, photoData(photo).then((data) => storePhoto(data, GALLERY_LABEL)));
    return copies.get(photo);
  };
  const named = (x) => isPhotoFile(x) && !GALLERY_FILE.test(x);
  let n = 0;
  await pool([...S.media].filter(([, m]) => named(m.photo) || named(m.back)), 4, async ([id, m]) => {
    try {
      const renamed = await convertPhotos(m, rename);
      if (S.media.get(id) === m) {
        S.media.set(id, renamed);
        n++;
      }
    } catch (e) {
      /* file unreadable: the image keeps it, another try on the next load */
    }
  });
  return n;
}

/** Content of a photo file as a data URL. */
async function photoData(photo) {
  const res = await fetch(photoSrc(photo), { cache: 'no-store' });
  if (!res.ok) throw new Error(String(res.status));
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Standalone .json backup: in file mode, photos are embedded in it as data URLs. */
export async function buildPortableBackup() {
  if (S.mode !== 'file') return buildBackup();
  const people = new Map(S.people);
  const sources = new Map(S.sources);
  const media = new Map(S.media);
  const hasFile = (p) => isPhotoFile(p.photo) || attached(p).some(isPhotoFile);
  for (const map of [people, sources, media]) {
    await pool([...map].filter(([, p]) => hasFile(p)), 4, async ([id, p]) => {
      // File not found: the record goes without this photo
      const portable = await convertPhotos(p, (photo) => (isPhotoFile(photo) ? photoData(photo).catch(() => '') : photo));
      if (!portable.photo) delete portable.photo;
      if (!portable.photo || !portable.back) delete portable.back; // a back alone means nothing
      // A gallery image not found: it goes
      if (map === media && !portable.photo) map.delete(id);
      else map.set(id, portable);
    });
  }
  return buildBackup({ name: treeName(), createdAt: (S.trees.get(S.tree) || {}).createdAt, people, unions: S.unions, sources, media });
}

/* ---------- Saving and tree management ---------- */

// Saves go one after the other, each with the whole tree at the time of the call
let fileQueue = Promise.resolve();

/** Saves the tree; the promise fails if nothing was written, so the action doesn't claim otherwise. */
export function saveFile() {
  const id = S.tree;
  const body = buildBackup();
  const run = fileQueue.then(async () => {
    try {
      // Removed photos stay on disk: Undo may still need them
      version = await putFileTree(id, body, true, version);
    } catch (e) {
      throw failure(e.status === 409 ? 'st.conflict' : 'st.fileFailed', e);
    }
  });
  fileQueue = run.catch(() => {}); // a failure doesn't block the following saves
  return run;
}

export async function createFileTree(id, tree) {
  try {
    await putFileTree(id, emptyBackup(tree.name, tree.createdAt));
  } catch (e) {
    throw failure('st.createFailed', e);
  }
}

/** New name (already set in S.trees) saved in the tree's file. */
export async function renameFileTree(id, tree) {
  if (id === S.tree) return saveFile();
  const res = await fetch(API + encodeURIComponent(id), { cache: 'no-store' });
  const o = res.ok ? await res.json() : JSON.parse(emptyBackup(tree.name, tree.createdAt));
  o.name = tree.name;
  await putFileTree(id, JSON.stringify(o, null, 2));
}

export async function deleteFileTree(id) {
  try {
    const res = await fetch(API + encodeURIComponent(id), { method: 'DELETE' });
    if (!res.ok) throw new Error(String(res.status));
  } catch (e) {
    throw failure('st.deleteFailed', e);
  }
}
