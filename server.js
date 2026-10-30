/**
 * Serveur local de Lignée : sert l'application et enregistre chaque arbre
 * dans data/arbres/<id>.json (format de sauvegarde Lignée, avec son nom).
 * Les photos de l'arbre sont des fichiers dans data/arbres/<id>/photos/,
 * nommés NOM-Prénom-<uuid>.jpg ; la fiche garde « photos/<fichier> ».
 *
 *   node server.js            → http://localhost:8000
 *   PORT=9000 node server.js  → autre port
 *
 * GET    /api/trees                 : liste des arbres [{ id, name, count }]
 * GET    /api/trees/:id             : contenu d'un arbre (404 s'il n'existe pas encore)
 * PUT    /api/trees/:id             : crée ou remplace l'arbre (écriture atomique) ;
 *                                     supprime les photos qu'il n'utilise plus, sauf avec
 *                                     ?keepPhotos=1 (l'application peut encore les rétablir)
 * DELETE /api/trees/:id             : supprime l'arbre et ses photos
 * POST   /api/trees/:id/photos      : enregistre une photo { label, data (data URL) }
 *                                     et renvoie { photo: 'photos/<fichier>' }
 * POST   /api/trees/:id/photos/sweep : efface les photos que l'arbre enregistré n'utilise pas
 * GET    /api/trees/:id/photos/:f   : une photo de l'arbre
 *
 * GET renvoie un ETag ; PUT avec If-Match refuse d'écraser (409) un arbre modifié entre-temps.
 *
 * Aucune dépendance. Le serveur n'écoute que sur cet ordinateur (127.0.0.1) et refuse les
 * requêtes venues d'un autre site (en-têtes Host et Origin).
 * Importé comme module, il fournit createServer() (utilisé par les tests).
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_BODY = 20 * 1024 * 1024; // 20 Mo

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.ged': 'text/plain; charset=utf-8',
};

// Ce que la page a le droit de charger : ses propres fichiers, les polices, le service de localisation
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
  + "font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://nominatim.openstreetmap.org https://api.github.com https://raw.githubusercontent.com; "
  + "object-src 'none'; base-uri 'none'; form-action 'none'";

function send(res, status, body, type = 'text/plain; charset=utf-8', headers = {}) {
  res.writeHead(status, {
    'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': CSP, 'Referrer-Policy': 'no-referrer', ...headers,
  });
  res.end(body);
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Vrai si la requête vient bien de cet ordinateur et de l'application. Sans cela, un site
 * ouvert dans le navigateur pourrait viser le serveur : Host déjoue le « DNS rebinding »
 * (lecture des arbres), Origin les envois d'un autre site (écriture de fichiers).
 */
function allowed(req) {
  const host = String(req.headers.host || '');
  if (!LOCAL_HOSTS.has(host.replace(/:\d+$/, ''))) return false;
  const { origin } = req.headers;
  if (!origin) return true;
  try {
    return new URL(origin).host === host;
  } catch (e) {
    return false;
  }
}

/** Empreinte du contenu d'un arbre : sa version. */
const versionOf = (text) => '"' + createHash('sha256').update(text).digest('hex').slice(0, 32) + '"';

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('Fichier trop volumineux'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/* ---------- Photos ---------- */

const PHOTO_REF = /^photos\/([^/\\]+\.(?:jpg|png|webp|gif))$/;
const PHOTO_EXT = { jpeg: '.jpg', png: '.png', webp: '.webp', gif: '.gif' };

/** Texte utilisable comme nom de fichier ou de dossier (sans / \ : * ? " < > |). */
export function safeName(s, fallback) {
  const t = String(s || '').normalize('NFC')
    .replace(/[\u0000-\u001f/\\:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s-]+|[.\s]+$/g, '')
    .slice(0, 80);
  return t || fallback;
}

/** Fichiers photo cités par les fiches d'un arbre : portraits, documents des sources, galerie. */
function photoRefs(o) {
  const refs = new Set();
  const add = (photo) => {
    const m = PHOTO_REF.exec(String(photo || ''));
    if (m) refs.add(m[1]);
  };
  for (const p of (o && Array.isArray(o.people) ? o.people : [])) {
    if (!p) continue;
    add(p.photo);
    for (const s of [...(Array.isArray(p.sources) ? p.sources : []), ...(Array.isArray(p.media) ? p.media : [])]) if (s) add(s.photo);
  }
  return refs;
}

/** Supprime des photos, puis les dossiers devenus vides. */
async function removePhotos(dir, files) {
  for (const f of files) await fs.rm(path.join(dir, f), { force: true });
  for (const d of [dir, path.dirname(dir)]) {
    try {
      await fs.rmdir(d);
    } catch (e) {
      break; // dossier absent ou pas vide
    }
  }
}

/* ---------- Données : un fichier par arbre dans dataDir ---------- */

function paths(dataDir) {
  const treeFile = (id) => path.join(dataDir, id + '.json');
  const photoDir = (id) => path.join(dataDir, id, 'photos');

  /** Contenu enregistré d'un arbre, ou null. */
  async function readTree(id) {
    try {
      return JSON.parse(await fs.readFile(treeFile(id), 'utf8'));
    } catch (e) {
      return null;
    }
  }

  /** Identifiants des arbres présents dans dataDir. */
  async function treeIds() {
    let names = [];
    try {
      names = await fs.readdir(dataDir);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
    return names.filter((f) => f.endsWith('.json') && SAFE_ID.test(f.slice(0, -5))).map((f) => f.slice(0, -5));
  }

  return { treeFile, photoDir, readTree, treeIds };
}

/**
 * Serveur HTTP de Lignée (sans l'écoute) : l'application dans `root`,
 * les arbres dans `dataDir`.
 */
export function createServer({ root = ROOT, dataDir = path.join(root, 'data', 'arbres') } = {}) {
  const { treeFile, photoDir, readTree, treeIds } = paths(dataDir);

  // Les écritures passent l'une après l'autre, dans l'ordre d'arrivée
  let queue = Promise.resolve();
  const enqueue = (fn) => (queue = queue.then(fn, fn));

  /** Liste des arbres : [{ id, name, count }]. */
  async function listTrees(res) {
    const trees = [];
    for (const id of await treeIds()) {
      const o = await readTree(id);
      if (!o) continue; // fichier illisible : ignoré
      trees.push({ id, name: o.name || id, count: Array.isArray(o.people) ? o.people.length : 0, createdAt: o.createdAt || 0 });
    }
    trees.sort((a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name));
    send(res, 200, JSON.stringify(trees), TYPES['.json']);
  }

  async function getTree(res, id) {
    try {
      const text = await fs.readFile(treeFile(id), 'utf8');
      send(res, 200, text, TYPES['.json'], { ETag: versionOf(text) });
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      send(res, 404, 'Arbre introuvable');
    }
  }

  async function putTree(req, res, id, keepPhotos) {
    const text = await readBody(req);
    let o;
    try {
      o = JSON.parse(text);
    } catch (e) {
      send(res, 400, 'JSON illisible');
      return;
    }
    if (!o || o.format !== 'lignee' || !Array.isArray(o.people) || !Array.isArray(o.unions)) {
      send(res, 400, 'Ce contenu n’est pas une sauvegarde Lignée');
      return;
    }
    const json = JSON.stringify(o, null, 2) + '\n';
    const expected = req.headers['if-match'];
    let conflict = false;
    await enqueue(async () => {
      if (expected) {
        const current = await fs.readFile(treeFile(id), 'utf8').catch(() => null);
        if (current !== null && versionOf(current) !== expected) {
          conflict = true;
          return;
        }
      }
      const before = await readTree(id);
      const tmp = treeFile(id) + '.tmp';
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(tmp, json, 'utf8');
      await fs.rename(tmp, treeFile(id));
      // Photos retirées des fiches : supprimées
      const kept = photoRefs(o);
      if (before && !keepPhotos) await removePhotos(photoDir(id), [...photoRefs(before)].filter((f) => !kept.has(f)));
    });
    if (conflict) send(res, 409, 'Arbre modifié entre-temps');
    else send(res, 204, '', undefined, { ETag: versionOf(json) });
  }

  async function deleteTree(res, id) {
    await enqueue(async () => {
      await fs.rm(treeFile(id), { force: true });
      await fs.rm(path.dirname(photoDir(id)), { recursive: true, force: true }); // photos gardées pour Annuler comprises
    });
    send(res, 204, '');
  }

  async function postPhoto(req, res, id) {
    let o;
    try {
      o = JSON.parse(await readBody(req));
    } catch (e) {
      if (e.status) throw e;
      send(res, 400, 'JSON illisible');
      return;
    }
    const m = /^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(String((o && o.data) || ''));
    if (!m) {
      send(res, 400, 'Ce contenu n’est pas une image');
      return;
    }
    const file = safeName(o.label, 'photo') + '-' + randomUUID() + PHOTO_EXT[m[1]];
    await enqueue(async () => {
      await fs.mkdir(photoDir(id), { recursive: true });
      await fs.writeFile(path.join(photoDir(id), file), Buffer.from(m[2], 'base64'));
    });
    send(res, 201, JSON.stringify({ photo: 'photos/' + file }), TYPES['.json']);
  }

  /** Efface les photos du dossier que l'arbre enregistré ne cite plus. */
  async function sweepPhotos(res, id) {
    await enqueue(async () => {
      const tree = await readTree(id);
      if (!tree) return; // arbre illisible : on ne touche à rien
      const kept = photoRefs(tree);
      let names = [];
      try {
        names = await fs.readdir(photoDir(id));
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
      await removePhotos(photoDir(id), names.filter((f) => PHOTO_REF.test('photos/' + f) && !kept.has(f)));
    });
    send(res, 204, '');
  }

  async function getPhoto(res, id, file) {
    if (!PHOTO_REF.test('photos/' + file)) return send(res, 400, 'Nom de photo invalide');
    try {
      const body = await fs.readFile(path.join(photoDir(id), file));
      send(res, 200, body, TYPES[path.extname(file)]);
    } catch (e) {
      send(res, 404, 'Photo introuvable');
    }
  }

  async function api(req, res, rel, query) {
    if (rel === '') {
      if (req.method === 'GET') return listTrees(res);
    } else {
      const [idPart, sub, filePart, ...rest] = rel.split('/');
      const id = decodeURIComponent(idPart);
      if (!SAFE_ID.test(id)) return send(res, 400, 'Identifiant d’arbre invalide');
      if (sub === undefined) {
        if (req.method === 'GET') return getTree(res, id);
        if (req.method === 'PUT') return putTree(req, res, id, query.includes('keepPhotos=1'));
        if (req.method === 'DELETE') return deleteTree(res, id);
      } else if (sub === 'photos' && !rest.length) {
        if (!filePart && req.method === 'POST') return postPhoto(req, res, id);
        if (filePart === 'sweep' && req.method === 'POST') return sweepPhotos(res, id);
        if (filePart && req.method === 'GET') return getPhoto(res, id, decodeURIComponent(filePart));
      } else {
        return send(res, 404, 'Introuvable');
      }
    }
    send(res, 405, 'Méthode non autorisée');
  }

  /* ---------- Fichiers de l'application ---------- */

  async function serveFile(req, res) {
    const url = new URL(req.url, 'http://localhost');
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(root, rel));
    if (!file.startsWith(root + path.sep)) {
      send(res, 403, 'Accès refusé');
      return;
    }
    try {
      const body = await fs.readFile(file);
      send(res, 200, body, TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
    } catch (e) {
      send(res, 404, 'Introuvable');
    }
  }

  return http.createServer(async (req, res) => {
    try {
      if (!allowed(req)) {
        send(res, 403, 'Accès refusé');
        return;
      }
      const [pathname, query = ''] = req.url.split('?');
      const route = pathname.match(/^\/api\/trees\/?(.*)$/);
      if (route) {
        await api(req, res, route[1], query);
      } else if (req.method === 'GET' || req.method === 'HEAD') {
        await serveFile(req, res);
      } else {
        send(res, 405, 'Méthode non autorisée');
      }
    } catch (e) {
      console.error(e);
      if (!res.headersSent) send(res, e.status || 500, e.status ? e.message : 'Erreur du serveur');
    }
  });
}

/* ---------- Lancement : node server.js ---------- */

if (import.meta.main) {
  const PORT = Number(process.env.PORT) || 8000;
  const dataDir = path.join(ROOT, 'data', 'arbres');
  createServer({ dataDir }).listen(PORT, '127.0.0.1', () => {
    console.log(`Lignée : http://localhost:${PORT}`);
    console.log(`Données : ${path.relative(process.cwd(), dataDir) || dataDir}`);
  });
}
