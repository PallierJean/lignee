/**
 * Lecture d'un dépôt GitHub depuis le navigateur : une sauvegarde Lignée (.json) et ses photos.
 * Dépôt public : fichiers lus sur raw.githubusercontent.com, sans limite de 60 requêtes par heure.
 * Dépôt privé : fichiers lus par l'API avec un jeton, le seul accès qui l'accepte depuis une page.
 * Le jeton n'est jamais enregistré ; il ne part que vers api.github.com.
 */
import { convertPhotos } from './storage.js';
import { parseBackup } from './backup.js';
import { isPhotoFile } from '../model/people.js';
import { pool } from '../utils/helpers.js';

const API = 'https://api.github.com/repos/';
const RAW = 'https://raw.githubusercontent.com/';
const MAX_BACKUPS = 20; // fichiers .json lus au plus pour trouver les sauvegardes
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

const fail = (code) => Object.assign(new Error(code), { code });

function checked(res) {
  if (res.ok) return res;
  const codes = { 401: 'badToken', 403: 'forbidden', 404: 'notFound', 409: 'empty', 429: 'forbidden' };
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

/** Accès aux fichiers du dépôt : api(chemin) et read(fichier) renvoient une réponse valide. */
function client({ owner, repo }, token) {
  const api = async (path, accept) => checked(await fetch(`${API}${owner}/${repo}/${path}`, {
    cache: 'no-store',
    headers: { Accept: accept, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  }));
  const read = async (file) => {
    if (token) return api(`git/blobs/${file.sha}`, 'application/vnd.github.raw+json');
    const path = file.path.split('/').map(encodeURIComponent).join('/');
    return checked(await fetch(`${RAW}${owner}/${repo}/HEAD/${path}`, { cache: 'no-store' }));
  };
  return { api, read };
}

/**
 * Cherche les sauvegardes Lignée du dépôt, à la racine d'abord. Renvoie
 * { name, read, files, backups: [{ path, name, people, unions }] }.
 * Échoue avec une erreur portant `code` : invalid, notFound, badToken, forbidden, empty, noBackup ou failed.
 */
export async function openRepo(input, token) {
  const target = parseRepo(input);
  if (!target) throw fail('invalid');
  const { api, read } = client(target, token);
  const { tree } = await (await api('git/trees/HEAD?recursive=1', 'application/vnd.github+json')).json();

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
  if (!backups.length) throw fail('noBackup');
  backups.sort((a, b) => a.path.localeCompare(b.path));

  // Les noms de fichiers peuvent différer par la forme de leurs accents
  const files = new Map(blobs.map((x) => [x.path.normalize('NFC'), x]));
  return { name: target.repo, read, files, backups };
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
 * Renvoie { found, missing } ; une autre erreur (réseau, accès) interrompt la lecture.
 */
export async function attachPhotos(repo, backup) {
  const base = backup.path.replace(/\.json$/i, '/');
  const dir = backup.path.replace(/[^/]*$/, '');
  const find = (photo) => repo.files.get((base + photo).normalize('NFC')) || repo.files.get((dir + photo).normalize('NFC'));
  const count = { found: 0, missing: 0 };

  const load = async (photo) => {
    if (!isPhotoFile(photo)) return photo;
    const file = find(photo);
    try {
      if (!file) throw fail('notFound');
      const data = await dataUrl(await repo.read(file), photo);
      count.found++;
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
