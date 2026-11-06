/**
 * Place coordinates, kept in this browser. They are requested from
 * OpenStreetMap (Nominatim) only when the user asks, one per second as
 * that service requires: only the place name is sent.
 */
import { GEO_KEY } from '../config.js';
import { sleep } from '../utils/helpers.js';
import { parsePlace } from '../model/places.js';

const URL_BASE = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=';
const PAUSE = 1100;

function readCache() {
  try {
    return new Map(Object.entries(JSON.parse(localStorage.getItem(GEO_KEY) || '{}')));
  } catch (e) {
    return new Map();
  }
}

/** Known coordinates: Map name -> { lat, lon }, or null for a place that can't be found. */
export const knownPlaces = () => readCache();

/** Looks up places `names`. Returns the number found; a network failure stops the search. */
export async function locatePlaces(names, onProgress) {
  const cache = readCache();
  let found = 0;
  for (const [i, name] of names.entries()) {
    // A place with no country is in France: said explicitly, so as not to find a namesake abroad
    const query = parsePlace(name).country ? name : name + ', France';
    const res = await fetch(URL_BASE + encodeURIComponent(query));
    if (!res.ok) throw new Error(String(res.status));
    const [hit] = await res.json();
    cache.set(name, hit ? { lat: +hit.lat, lon: +hit.lon } : null);
    if (hit) found++;
    try {
      localStorage.setItem(GEO_KEY, JSON.stringify(Object.fromEntries(cache)));
    } catch (e) {
      /* storage full: the coordinates remain valid for this search */
    }
    onProgress(i + 1, names.length);
    if (i < names.length - 1) await sleep(PAUSE);
  }
  return found;
}
