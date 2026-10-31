/**
 * Mode « file » : un fichier par arbre dans data/arbres/ du projet, écrit par le
 * serveur local (node server.js). Même format que la sauvegarde .json, mais les
 * photos sont des fichiers à part, dans data/arbres/<id de l'arbre>/photos/.
 */
import { S, treeName } from '../../state.js';
import { t } from '../../i18n.js';
import { buildBackup, parseBackup } from '../backup.js';
import { sourcesOf, mediaList, isPhotoData, isPhotoFile, photoLabel, photoSrc } from '../../model/people.js';
import { pool } from '../../utils/helpers.js';
import { toast } from '../../ui/toast.js';
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

// Version de l'arbre ouvert, reçue du serveur : un enregistrement n'écrase jamais une version
// plus récente (autre onglet, autre appareil, modification du fichier)
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
 * Charge la liste des arbres de data/arbres/ puis l'arbre ouvert, via le serveur
 * local. Renvoie false si le serveur n'est pas là (autre serveur web…).
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
    // Premier lancement : on reprend les arbres déjà gardés dans ce navigateur, s'il y en a
    for (const t of readLocalTrees()) {
      const data = readLocalData(t.id);
      if (!data.people.size && !data.unions.size) continue;
      try {
        await putFileTree(t.id, buildBackup({ name: t.name, createdAt: t.createdAt, ...data }));
        list.push({ id: t.id, name: t.name, createdAt: t.createdAt, count: data.people.size });
      } catch (e) {
        /* copie impossible : l'arbre reste dans le navigateur */
      }
    }
  }
  S.trees = sortTrees(list.map((t) => [t.id, { name: t.name, createdAt: t.createdAt || 0, count: t.count || 0 }]));
  ensureTree();
  await loadFileTree();
  return true;
}

export async function loadFileTree() {
  await fileQueue; // les enregistrements en attente partent d'abord
  version = null;
  S.people = new Map();
  S.unions = new Map();
  let text;
  try {
    const res = await fetch(API + encodeURIComponent(S.tree), { cache: 'no-store' });
    if (res.status === 404) return; // arbre pas encore enregistré
    if (!res.ok) throw new Error(String(res.status));
    version = res.headers.get('ETag');
    text = await res.text();
  } catch (e) {
    toast(t('st.readFailed'), true);
    return;
  }
  const data = parseBackup(text);
  S.people = new Map(data.people.map((x) => [x.id, x.data]));
  S.unions = new Map(data.unions.map((x) => [x.id, x.data]));
  // Photos encore intégrées à la fiche (enregistrées avant les fichiers photo) : on les sort
  if (await storePhotos()) await saveFile().catch(() => {}); // message déjà affiché
  // Photos retirées lors de la session précédente : plus rien ne permet de les rétablir
  fetch(API + encodeURIComponent(S.tree) + '/photos/sweep', { method: 'POST' }).catch(() => {});
}

/* ---------- Photos en fichiers ---------- */

/**
 * Photo à enregistrer dans la fiche `p` : en mode file, une data URL devient un
 * fichier de data/arbres/<id de l'arbre>/photos/ et la fiche garde « photos/<fichier> ».
 * Dans les autres modes, la photo reste intégrée.
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
    toast(t('st.photoFailed'), true);
    throw e;
  }
}

/** Vrai si la fiche contient une photo ou un document encore intégré. */
const attached = (p) => [...sourcesOf(p), ...mediaList(p)];
const hasPhotoData = (p) => isPhotoData(p.photo) || attached(p).some((x) => isPhotoData(x.photo));

/** Fiche dont la photo et les documents des sources sont passés par `convert`. */
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

/** Sort en fichiers les photos intégrées de l'arbre ouvert. Renvoie le nombre de fiches modifiées. */
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
      /* la photo reste intégrée : elle s'affiche toujours, nouvel essai au prochain chargement */
    }
  });
  return n;
}

/** Contenu d'un fichier photo en data URL. */
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

/** Sauvegarde .json autonome : en mode file, les photos y sont intégrées en data URL. */
export async function buildPortableBackup() {
  if (S.mode !== 'file') return buildBackup();
  const people = new Map(S.people);
  const hasFile = (p) => isPhotoFile(p.photo) || attached(p).some((x) => isPhotoFile(x.photo));
  await pool([...people].filter(([, p]) => hasFile(p)), 4, async ([id, p]) => {
    // Fichier introuvable : la fiche part sans cette photo
    const portable = await convertPhotos(p, (photo) => (isPhotoFile(photo) ? photoData(photo).catch(() => '') : photo));
    if (!portable.photo) delete portable.photo;
    if (portable.media) portable.media = portable.media.filter((m) => m.photo); // image introuvable
    people.set(id, portable);
  });
  return buildBackup({ name: treeName(), createdAt: (S.trees.get(S.tree) || {}).createdAt, people, unions: S.unions });
}

/* ---------- Enregistrement et gestion des arbres ---------- */

// Les enregistrements partent l'un après l'autre, chacun avec l'arbre complet au moment de l'appel
let fileQueue = Promise.resolve();

/** Enregistre l'arbre ; la promesse échoue si rien n'a été écrit, pour que l'action ne dise pas le contraire. */
export function saveFile() {
  const id = S.tree;
  const body = buildBackup();
  const run = fileQueue.then(async () => {
    try {
      // Les photos retirées restent sur le disque : Annuler peut encore en avoir besoin
      version = await putFileTree(id, body, true, version);
    } catch (e) {
      toast(t(e.status === 409 ? 'st.conflict' : 'st.fileFailed'), true);
      throw e;
    }
  });
  fileQueue = run.catch(() => {}); // un échec ne bloque pas les enregistrements suivants
  return run;
}

export async function createFileTree(id, tree) {
  try {
    await putFileTree(id, emptyBackup(tree.name, tree.createdAt));
  } catch (e) {
    toast(t('st.createFailed'), true);
    throw e;
  }
}

/** Nouveau nom (déjà posé dans S.trees) enregistré dans le fichier de l'arbre. */
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
    toast(t('st.deleteFailed'), true);
    throw e;
  }
}
