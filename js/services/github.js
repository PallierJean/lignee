/**
 * Lecture d'un dépôt GitHub depuis le navigateur : une sauvegarde Lignée (.json) et ses photos.
 * Dépôt public : fichiers lus sur raw.githubusercontent.com, sans limite de 60 requêtes par heure.
 * Dépôt privé : fichiers lus par l'API avec un jeton, le seul accès qui l'accepte depuis une page.
 * Avec un jeton autorisé, l'arbre et ses photos repartent vers le dépôt en un seul commit.
 * Le jeton n'est jamais enregistré ; il ne part que vers api.github.com.
 */
import { convertPhotos } from './storage.js';
import { parseBackup } from './backup.js';
import { isPhotoFile, isPhotoData, photoLabel } from '../model/people.js';
import { pool } from '../utils/helpers.js';

const API = 'https://api.github.com/repos/';
const RAW = 'https://raw.githubusercontent.com/';
const MAX_BACKUPS = 20; // fichiers .json lus au plus pour trouver les sauvegardes
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

const EMPTY_BACKUP = '{"format":"lignee","version":1,"people":[],"unions":[]}\n';

const fail = (code) => Object.assign(new Error(code), { code });

function checked(res) {
  if (res.ok) return res;
  const codes = { 401: 'badToken', 403: 'forbidden', 404: 'notFound', 409: 'empty', 422: 'conflict', 429: 'forbidden' };
  throw fail(codes[res.status] || 'failed');
}

/** Lit « owner/depot », son adresse https ou ssh. Renvoie { owner, repo }, ou null. */
export function parseRepo(input) {
  const m = String(input || '').trim().match(
    /^(?:https?:\/\/(?:www\.)?github\.com\/|(?:ssh:\/\/)?git@github\.com[:/])?([A-Za-z0-9-]{1,39})\/([\w.-]{1,100}?)(?:\.git)?\/?(?:[/?#].*)?$/,
  );
  if (!m || /^\.+$/.test(m[2])) return null;
  return { owner: m[1], repo: m[2] };
}

/** Accès au dépôt : api(chemin) et send(méthode, chemin, corps) par l'API, raw(fichier, commit) pour lire un fichier. */
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

/**
 * Vrai si le jeton peut écrire. GitHub ne donne pas les droits d'un jeton à accès limité :
 * on demande une référence au nom invalide, qui ne peut rien créer. 422 (409 sur un dépôt vide) :
 * demande examinée, donc droit d'écriture ; 403 ou 404 : refusée avant cela. Dans le doute : lecture seule.
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
 * Cherche les sauvegardes Lignée du dépôt, à la racine d'abord. Renvoie { name, read, files,
 * backups: [{ path, name, people, unions }], write, head, branch, api, send }.
 * Avec `forSave`, un dépôt vide ou sans sauvegarde convient : head et backups sont alors vides.
 * Échoue avec une erreur portant `code` : invalid, notFound, badToken, forbidden, empty, noBackup ou failed.
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
      /* autre fichier .json du dépôt */
    }
    if (backup && backup.people.length) backups.push({ path: file.path, ...backup });
  });
  if (!backups.length && !forSave) throw fail('noBackup');
  backups.sort((a, b) => a.path.localeCompare(b.path));

  // Les noms de fichiers peuvent différer par la forme de leurs accents
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
 * Remplace les chemins « photos/… » de la sauvegarde par les images du dépôt, cherchées dans
 * <nom de la sauvegarde>/photos/ puis à côté du fichier. Une image absente est retirée de la fiche.
 * Renvoie { found, missing, photos } ; photos associe chaque image à son fichier, pour le renvoi.
 * Une autre erreur (réseau, accès) interrompt la lecture.
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
 * Envoie la sauvegarde `text` (photos en data URL) vers target.path, en un commit sur la branche par
 * défaut. Seules les nouvelles photos sont transférées ; celles que l'arbre ne cite plus quittent le
 * dépôt, en restant dans son historique. Refuse d'écraser un dépôt modifié depuis sa lecture (`conflict`).
 * Un dépôt vide reçoit d'abord un premier commit, seule écriture que l'API accepte sur lui.
 */
export async function pushBackup(repo, target, text, message) {
  if (!repo.head) {
    const path = target.path.split('/').map(encodeURIComponent).join('/');
    const { commit } = await repo.send('PUT', `/contents/${path}`, { message, content: btoa(EMPTY_BACKUP) });
    repo.head = commit.sha;
  } else if (await headCommit(repo.api) !== repo.head) {
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
