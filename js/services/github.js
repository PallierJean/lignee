/**
 * Reading a GitHub repository from the browser: a Lignée backup (.json) and its photos.
 * Public repository: files read from raw.githubusercontent.com, with no 60-requests-per-hour limit.
 * Private repository: files read through the API with a token, the only access that allows it from a page.
 * With an authorised token, the tree and its photos go back to the repository in a single commit.
 * The token is never stored; it is only sent to api.github.com.
 */
import { convertPhotos } from './storage.js';
import { parseBackup } from './backup.js';
import { isPhotoFile, isPhotoData, photoLabel } from '../model/people.js';
import { pool, sleep } from '../utils/helpers.js';

const API = 'https://api.github.com/repos/';
const RAW = 'https://raw.githubusercontent.com/';
const MAX_BACKUPS = 20; // .json files read at most to find the backups
const HEAD_READS = 6; // reads of the last commit before concluding that it changed
const HEAD_WAIT = 400; // ms entre deux lectures
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

const EMPTY_BACKUP = '{"format":"lignee","version":1,"people":[],"unions":[]}\n';

const fail = (code) => Object.assign(new Error(code), { code });

function checked(res) {
  if (res.ok) return res;
  const codes = { 401: 'badToken', 403: 'forbidden', 404: 'notFound', 409: 'empty', 422: 'conflict', 429: 'forbidden' };
  throw fail(codes[res.status] || 'failed');
}

/** Reads "owner/repo", its https or ssh address. Returns { owner, repo }, or null. */
export function parseRepo(input) {
  const m = String(input || '').trim().match(
    /^(?:https?:\/\/(?:www\.)?github\.com\/|(?:ssh:\/\/)?git@github\.com[:/])?([A-Za-z0-9-]{1,39})\/([\w.-]{1,100}?)(?:\.git)?\/?(?:[/?#].*)?$/,
  );
  if (!m || /^\.+$/.test(m[2])) return null;
  return { owner: m[1], repo: m[2] };
}

/** Repository access: api(path) and send(method, path, body) through the API, raw(file, commit) to read a file. */
function client({ owner, repo }, token) {
  const base = `${API}${owner}/${repo}`;
  const api = async (path, accept = 'application/vnd.github+json', init = {}) => checked(await fetch(base + path, {
    cache: 'no-store',
    ...init,
    headers: { Accept: accept, ...init.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  }));
  const send = async (method, path, body) => (await api(path, undefined, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })).json();
  const raw = async (file, commit) => {
    if (token) return api(`/git/blobs/${file.sha}`, 'application/vnd.github.raw+json');
    const path = file.path.split('/').map(encodeURIComponent).join('/');
    return checked(await fetch(`${RAW}${owner}/${repo}/${commit}/${path}`, { cache: 'no-store' }));
  };
  return { api, send, raw };
}

const headCommit = async (api) => (await (await api('/commits/HEAD', 'application/vnd.github.sha')).text()).trim();

/** True if the repository is still at `commit`. GitHub may read back the old commit right after a push: retry a little. */
async function stillAt(api, commit) {
  for (let i = 0; i < HEAD_READS; i++) {
    if (i) await sleep(HEAD_WAIT);
    if (await headCommit(api) === commit) return true;
  }
  return false;
}

/**
 * True if the token can write. GitHub doesn't report the permissions of a fine-grained token:
 * we ask for a reference with an invalid name, which can't create anything. 422 (409 on an empty repository):
 * request examined, so write permission; 403 or 404: refused before that. When in doubt: read-only.
 */
async function canWrite(send) {
  try {
    await send('POST', '/git/refs', { ref: 'lignee-test-droits', sha: '0'.repeat(40) });
    return false;
  } catch (e) {
    return e.code === 'conflict' || e.code === 'empty';
  }
}

/**
 * Looks for the repository's Lignée backups, at the root first. Returns { name, read, files,
 * backups: [{ path, name, people, unions }], write, head, branch, api, send }.
 * With `forSave`, an empty repository or one with no backup is fine: head and backups are then empty.
 * Fails with an error carrying `code`: invalid, notFound, badToken, forbidden, empty, noBackup or failed.
 */
export async function openRepo(input, token, forSave = false) {
  const target = parseRepo(input);
  if (!target) throw fail('invalid');
  const { api, send, raw } = client(target, token);
  const head = await headCommit(api).catch((e) => {
    if (forSave && e.code === 'empty') return '';
    throw e;
  });
  const read = (file) => raw(file, head);
  const { tree } = head ? await (await api(`/git/trees/${head}?recursive=1`)).json() : { tree: [] };

  const blobs = tree.filter((x) => x.type === 'blob');
  const depth = (x) => x.path.split('/').length;
  const candidates = blobs.filter((x) => /\.json$/i.test(x.path) && !/(^|\/)package(-lock)?\.json$/.test(x.path))
    .sort((a, b) => depth(a) - depth(b) || a.path.localeCompare(b.path))
    .slice(0, MAX_BACKUPS);

  const backups = [];
  await pool(candidates, 4, async (file) => {
    const text = await (await read(file)).text();
    let backup = null;
    try {
      backup = parseBackup(text);
    } catch (e) {
      /* another .json file in the repository */
    }
    if (backup && backup.people.length) backups.push({ path: file.path, ...backup });
  });
  if (!backups.length && !forSave) throw fail('noBackup');
  backups.sort((a, b) => a.path.localeCompare(b.path));

  // File names may differ in the form of their accents
  const files = new Map(blobs.map((x) => [x.path.normalize('NFC'), x]));
  const write = !!token && await canWrite(send);
  const branch = write ? (await (await api('')).json()).default_branch : '';
  return { name: `${target.owner}/${target.repo}`, read, files, backups, write, head, branch, api, send };
}

async function dataUrl(res, photo) {
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${MIME[photo.split('.').pop()]};base64,${btoa(binary)}`;
}

/**
 * Replaces the backup's "photos/…" paths with the repository's images, looked up in
 * <backup name>/photos/ then next to the file. A missing image is removed from the record.
 * Returns { found, missing, photos }; photos maps each image to its file, for sending back.
 * Any other error (network, access) interrupts the read.
 */
export async function attachPhotos(repo, backup) {
  const base = backup.path.replace(/\.json$/i, '/');
  const dir = backup.path.replace(/[^/]*$/, '');
  const find = (photo) => repo.files.get((base + photo).normalize('NFC')) || repo.files.get((dir + photo).normalize('NFC'));
  const count = { found: 0, missing: 0, photos: new Map() };

  const load = async (photo) => {
    if (!isPhotoFile(photo)) return photo;
    const file = find(photo);
    try {
      if (!file) throw fail('notFound');
      const data = await dataUrl(await repo.read(file), photo);
      count.found++;
      count.photos.set(data, { ref: photo, path: file.path });
      return data;
    } catch (e) {
      if (e.code !== 'notFound') throw e;
      count.missing++;
      return '';
    }
  };

  await pool(backup.people, 4, async (x) => {
    const p = await convertPhotos(x.data, load);
    if (!p.photo) delete p.photo;
    if (p.media) p.media = p.media.filter((m) => m.photo);
    x.data = p;
  });
  return count;
}

/**
 * Sends backup `text` (photos as data URLs) to target.path, in one commit on the default
 * branch. Only new photos are transferred; those the tree no longer cites leave the
 * repository, while staying in its history. Refuses to overwrite a repository changed since it was read (`conflict`).
 * An empty repository first gets an initial commit, the only write the API accepts on it.
 */
export async function pushBackup(repo, target, text, message) {
  if (!repo.head) {
    const path = target.path.split('/').map(encodeURIComponent).join('/');
    const { commit } = await repo.send('PUT', `/contents/${path}`, { message, content: btoa(EMPTY_BACKUP) });
    repo.head = commit.sha;
  } else if (!await stillAt(repo.api, repo.head)) {
    throw fail('conflict');
  }
  const backup = JSON.parse(text);
  const folder = target.path.replace(/\.json$/i, '/');
  const photos = new Map();
  const entries = [];

  const store = async (photo, p) => {
    if (!isPhotoData(photo)) return photo;
    if (!photos.has(photo)) {
      let known = target.photos.get(photo);
      if (!known) {
        const [, type, content] = photo.match(/^data:(image\/\w+);base64,(.*)$/s);
        const ref = `photos/${photoLabel(p)}-${crypto.randomUUID()}.${EXT[type]}`;
        const { sha } = await repo.send('POST', '/git/blobs', { content, encoding: 'base64' });
        known = { ref, path: folder + ref };
        entries.push({ path: known.path, mode: '100644', type: 'blob', sha });
      }
      photos.set(photo, known);
    }
    return photos.get(photo).ref;
  };

  const people = [];
  for (const p of backup.people) people.push(await convertPhotos(p, (photo) => store(photo, p)));
  backup.people = people;

  const kept = new Set([...photos.values()].map((x) => x.path));
  for (const { path } of target.photos.values()) {
    if (!kept.has(path)) entries.push({ path, mode: '100644', type: 'blob', sha: null });
  }
  entries.push({ path: target.path, mode: '100644', type: 'blob', content: JSON.stringify(backup, null, 2) });

  const { tree: { sha: baseTree } } = await (await repo.api(`/git/commits/${repo.head}`)).json();
  const { sha: tree } = await repo.send('POST', '/git/trees', { base_tree: baseTree, tree: entries });
  const { sha } = await repo.send('POST', '/git/commits', { message, tree, parents: [repo.head] });
  await repo.send('PATCH', `/git/refs/heads/${repo.branch.split('/').map(encodeURIComponent).join('/')}`, { sha });
  repo.head = sha;
  target.photos = photos;
}
