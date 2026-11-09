/**
 * "file" mode: one file per tree in the project's data/arbres/, written by the
 * local server (node server.js). Same format as the .json backup, but the
 * photos are separate files, in data/arbres/<tree id>/photos/.
 */
import { S, treeName } from '../../state.js';
import { buildBackup, parseBackup } from '../backup.js';
import { sourcesOf, mediaList, isPhotoData, isPhotoFile, photoLabel, photoSrc } from '../../model/people.js';
import { pool } from '../../utils/helpers.js';
import { say, failure } from '../notify.js';
import { ensureTree, sortTrees } from './trees.js';
import { readLocalTrees, readLocalData } from './local.js';

const API = 'api/trees/';

async function fetchTrees() {
  const res = await fetch(API, { cache: 'no-store' });
  if (!res.ok) throw new Error(String(res.status));
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

const emptyBackup = (name, createdAt) => buildBackup({ name, createdAt, people: new Map(), unions: new Map() });

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

  if (!list.length) {
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
  const data = parseBackup(text);
  S.people = new Map(data.people.map((x) => [x.id, x.data]));
  S.unions = new Map(data.unions.map((x) => [x.id, x.data]));
  // Photos still embedded in the record (saved before photo files existed): they are moved out
  if (await storePhotos()) await saveFile().catch(() => {}); // message already shown
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

/** True if the record contains a photo or a document still embedded. */
const attached = (p) => [...sourcesOf(p), ...mediaList(p)];
const hasPhotoData = (p) => isPhotoData(p.photo) || attached(p).some((x) => isPhotoData(x.photo));

/** Record whose photo and source documents have gone through `convert`. */
export async function convertPhotos(p, convert) {
  const out = Object.assign({}, p);
  if (p.photo) out.photo = await convert(p.photo);
  for (const [key, list] of [['sources', sourcesOf(p)], ['media', mediaList(p)]]) {
    if (!list.length) continue;
    out[key] = [];
    for (const x of list) out[key].push(x.photo ? { ...x, photo: await convert(x.photo) } : x);
  }
  return out;
}

/** Moves the open tree's embedded photos out to files. Returns the number of records changed. */
export async function storePhotos() {
  if (S.mode !== 'file') return 0;
  const ids = [...S.people].filter(([, p]) => hasPhotoData(p)).map(([id]) => id);
  let n = 0;
  await pool(ids, 4, async (id) => {
    const p = S.people.get(id);
    try {
      const stored = await convertPhotos(p, (photo) => storePhoto(photo, p));
      if (S.people.get(id) === p) S.people.set(id, stored);
      n++;
    } catch (e) {
      /* the photo stays embedded: it still shows, another try on the next load */
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
  const hasFile = (p) => isPhotoFile(p.photo) || attached(p).some((x) => isPhotoFile(x.photo));
  await pool([...people].filter(([, p]) => hasFile(p)), 4, async ([id, p]) => {
    // File not found: the record goes without this photo
    const portable = await convertPhotos(p, (photo) => (isPhotoFile(photo) ? photoData(photo).catch(() => '') : photo));
    if (!portable.photo) delete portable.photo;
    if (portable.media) portable.media = portable.media.filter((m) => m.photo); // image not found
    people.set(id, portable);
  });
  return buildBackup({ name: treeName(), createdAt: (S.trees.get(S.tree) || {}).createdAt, people, unions: S.unions });
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
