/**
 * Place coordinates, kept in this browser. They are requested from
 * OpenStreetMap (Nominatim) only when the user asks, one per second as
 * that service requires: only the place name is sent.
 */
import { GEO_KEY, GEO_OLD_KEY } from '../config.js';
import { sleep } from '../utils/helpers.js';
import { parsePlace } from '../model/places.js';
import { departmentCode, departmentName } from '../model/departments.js';

const URL_BASE = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5';
const PAUSE = 1100;

function readCache(key = GEO_KEY) {
  try {
    return new Map(Object.entries(JSON.parse(localStorage.getItem(key) || '{}')));
  } catch (e) {
    return new Map();
  }
}

/** Known coordinates: Map name -> { lat, lon }, or null for a place that can't be found. */
export const knownPlaces = () => readCache();

/** Places among `names` still to locate (never located, or located before the department was checked). */
export function placesToLocate(names) {
  const cache = readCache();
  return names.filter((n) => !cache.has(n));
}

/**
 * Places among `names` located before the department was checked, often on a namesake: they
 * aren't shown, and are located again without asking (the user asked once already). Once
 * they all are, the old positions are forgotten.
 */
export function placesToRelocate(names) {
  const old = readCache(GEO_OLD_KEY);
  if (!old.size) return [];
  const cache = readCache();
  if ([...old.keys()].every((n) => cache.has(n))) {
    try {
      localStorage.removeItem(GEO_OLD_KEY);
    } catch (e) {
      /* unavailable storage: nothing to forget */
    }
    return [];
  }
  return names.filter((n) => old.has(n) && !cache.has(n));
}

/**
 * The search for `name`: a French commune with its department spelt out and the results
 * restricted to France ("Troche (19)" → "Troche, Corrèze"), any other place as written.
 */
export function placeQuery(name) {
  const pl = parsePlace(name);
  if (pl.country || !pl.city) return { q: name, dept: '' };
  const dept = departmentCode(pl.dept);
  return { q: [pl.city, dept && departmentName(dept)].filter(Boolean).join(', '), dept, france: true };
}

/** The result in the commune's department when one is: a namesake elsewhere is only a last resort. */
export function bestHit(hits, dept) {
  const inDept = (h) => {
    const a = h.address || {};
    return [a['ISO3166-2-lvl6'], a['ISO3166-2-lvl5'], a['ISO3166-2-lvl4']].includes('FR-' + dept);
  };
  return (dept && hits.find(inDept)) || (dept ? null : hits[0]) || null;
}

/** Looks up places `names`. Returns the number found; a network failure stops the search. */
export async function locatePlaces(names, onProgress) {
  const cache = readCache();
  let found = 0;
  for (const [i, name] of names.entries()) {
    const { q, dept, france } = placeQuery(name);
    const res = await fetch(`${URL_BASE}${france ? '&countrycodes=fr' : ''}&q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error(String(res.status));
    const hit = bestHit(await res.json(), dept);
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
