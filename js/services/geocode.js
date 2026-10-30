/**
 * Coordonnées des lieux, gardées dans ce navigateur. Elles ne sont demandées à
 * OpenStreetMap (Nominatim) que sur demande de l'utilisateur, une par seconde comme
 * l'exige ce service : seul le nom du lieu est envoyé.
 */
import { GEO_KEY } from '../config.js';
import { sleep } from '../utils/helpers.js';

const URL_BASE = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=';
const PAUSE = 1100;

function readCache() {
  try {
    return new Map(Object.entries(JSON.parse(localStorage.getItem(GEO_KEY) || '{}')));
  } catch (e) {
    return new Map();
  }
}

/** Coordonnées connues : Map nom -> { lat, lon }, ou null pour un lieu introuvable. */
export const knownPlaces = () => readCache();

/** Cherche les lieux `names`. Renvoie le nombre trouvé ; une panne réseau arrête la recherche. */
export async function locatePlaces(names, onProgress) {
  const cache = readCache();
  let found = 0;
  for (const [i, name] of names.entries()) {
    const res = await fetch(URL_BASE + encodeURIComponent(name));
    if (!res.ok) throw new Error(String(res.status));
    const [hit] = await res.json();
    cache.set(name, hit ? { lat: +hit.lat, lon: +hit.lon } : null);
    if (hit) found++;
    try {
      localStorage.setItem(GEO_KEY, JSON.stringify(Object.fromEntries(cache)));
    } catch (e) {
      /* stockage plein : les coordonnées restent valables pour cette recherche */
    }
    onProgress(i + 1, names.length);
    if (i < names.length - 1) await sleep(PAUSE);
  }
  return found;
}
