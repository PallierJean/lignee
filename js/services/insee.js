/**
 * Vérification des fiches dans le fichier des décès de l'INSEE, par server.js (mode fichier) :
 * seuls le nom de naissance, le premier prénom, le sexe et la naissance partent, une fiche
 * par seconde. Les actes trouvés sont gardés dans ce navigateur, par arbre et par fiche, avec
 * la question posée : une fiche n'est revérifiée que si cette question change.
 */
import { INSEE_KEY } from '../config.js';
import { S } from '../state.js';
import { inseeQuery, inseeSignature } from '../model/insee.js';
import { sleep } from '../utils/helpers.js';

const PAUSE = 1000;
const KEPT = 10; // actes gardés par fiche

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(INSEE_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}

function writeAll(all) {
  try {
    localStorage.setItem(INSEE_KEY, JSON.stringify(all));
  } catch (e) {
    /* stockage plein : les résultats restent valables jusqu'au rechargement */
  }
}

let memo = null; // { [arbre]: { [fiche]: { sig, acts, ignored } } }
const all = () => (memo = memo || readAll());

/** Résultats de l'arbre ouvert : { [fiche]: { sig, acts, ignored } }. */
export const inseeResults = () => all()[S.tree] || {};

/** La recherche passe par server.js : disponible seulement en mode fichier. */
export const inseeAvailable = () => S.mode === 'file';

/** Identifiants des fiches à vérifier : nouvelles, ou dont la question a changé depuis la dernière vérification. */
export function inseePending() {
  const done = inseeResults();
  return [...S.people.keys()].filter((id) => {
    const sig = inseeSignature(inseeQuery(id));
    return sig && (!done[id] || done[id].sig !== sig);
  });
}

/** Garde le résultat d'une fiche. */
function keep(id, entry) {
  const store = all();
  store[S.tree] = { ...(store[S.tree] || {}), [id]: entry };
  writeAll(store);
}

/** N'affiche plus l'écart de cette fiche, tant que sa question ne change pas. */
export function ignoreInsee(id) {
  const entry = inseeResults()[id];
  if (entry) keep(id, { ...entry, ignored: true });
}

/** Oublie les vérifications de l'arbre ouvert : tout sera revérifié. */
export function forgetInsee() {
  const store = all();
  delete store[S.tree];
  writeAll(store);
}

/** Erreur d'une réponse du serveur ; `login` : matchID demande une connexion. */
async function failure(res) {
  const text = await res.text().catch(() => '');
  return Object.assign(new Error(text.startsWith('{') ? '' : text), { login: res.status === 401 });
}

/** Connexion à matchID : { connected, user, expires }. */
export async function inseeStatus() {
  const res = await fetch('api/insee/status', { cache: 'no-store' });
  if (!res.ok) throw await failure(res);
  return res.json();
}

async function post(route, body) {
  const res = await fetch('api/insee/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw await failure(res);
  return res.json();
}

/** matchID envoie un code à cette adresse. */
export const inseeRegister = (email) => post('register', { email });

/** Code reçu par e-mail : le serveur garde le jeton. */
export const inseeAuth = (email, code) => post('auth', { email, code });

/** Vérifie les fiches `ids` une à une ; une panne, ou une connexion demandée, arrête la vérification. */
export async function checkInsee(ids, onProgress) {
  for (const [i, id] of ids.entries()) {
    const q = inseeQuery(id);
    if (q) {
      const res = await fetch('api/insee?' + new URLSearchParams(q));
      if (!res.ok) throw await failure(res);
      keep(id, { sig: inseeSignature(q), acts: (await res.json()).slice(0, KEPT) });
    }
    onProgress(i + 1, ids.length);
    if (i < ids.length - 1) await sleep(PAUSE);
  }
}

/** Pour les tests : relit le stockage. */
export const resetInseeMemo = () => {
  memo = null;
};
