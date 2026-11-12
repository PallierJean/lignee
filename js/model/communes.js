/**
 * French communes and their department: a place's city gives its department.
 * The list (js/data/communes.js, about 500 KB) is only loaded on demand: loadCommunes().
 */
import { norm } from '../utils/helpers.js';
import { parsePlace, formatPlace } from './places.js';
import { departmentCode, departmentName } from './departments.js';

let index = null;   // normalised commune name -> department numbers
let official = null; // "dept|normalised name" -> name as INSEE writes it
let loading = null;

/** Name for comparison: no case or accents, "St" for "Saint", hyphens and apostrophes as spaces. */
const key = (name) => norm(name).replace(/[^a-z0-9]+/g, ' ').trim()
  .replace(/\bste\b/g, 'sainte').replace(/\bst\b/g, 'saint');

/** Loads the commune list, only once; await it before cityDepartments(). */
export function loadCommunes() {
  if (!loading) {
    loading = import('../data/communes.js').then(({ COMMUNES }) => {
      const map = new Map();
      const names = new Map();
      for (const [dept, list] of Object.entries(COMMUNES)) {
        for (const name of list.split('|')) {
          const k = key(name);
          names.set(dept + '|' + k, name);
          if (!map.has(k)) map.set(k, []);
          if (!map.get(k).includes(dept)) map.get(k).push(dept);
        }
      }
      index = map;
      official = names;
    });
  }
  return loading;
}

export const communesLoaded = () => index !== null;

/** The commune's name as INSEE writes it ("SAINT ETIENNE", 42 -> "Saint-Étienne"), or `city` as given. */
export const officialCommune = (city, dept) => (official && official.get(dept + '|' + key(city))) || city;

let changes = null;      // department -> normalised former name -> { city, dept } of today's commune
let loadingChanges = null;

/** Loads the former communes (js/data/commune-changes.js, about 190 KB), only once. */
export function loadCommuneChanges() {
  if (!loadingChanges) {
    loadingChanges = import('../data/commune-changes.js').then(({ COMMUNE_CHANGES }) => {
      const map = new Map();
      for (const [dept, list] of Object.entries(COMMUNE_CHANGES)) {
        const byName = new Map();
        for (const pair of list.split('|')) {
          const [from, to] = pair.split('>');
          const m = /^(.*) \((\w+)\)$/.exec(to);
          byName.set(key(from), m ? { city: m[1], dept: m[2] } : { city: to, dept });
        }
        map.set(dept, byName);
      }
      changes = map;
    });
  }
  return loadingChanges;
}

export const communeChangesLoaded = () => changes !== null;

/**
 * Today's commune for a former one (merged, become a delegated commune, renamed): { city, dept },
 * or null if the commune hasn't changed, is unknown, or the list isn't loaded yet.
 */
export function currentCommune(city, dept) {
  const byName = changes && changes.get(String(dept || ''));
  return (byName && byName.get(key(city))) || null;
}

/** Departments with a commune of this name: [] if unknown, or if the list isn't loaded yet. */
export const cityDepartments = (city) => (index && index.get(key(city))) || [];

/** Departments, spelled out: "Charente (16)", "Creuse (23), Haute-Vienne (87)". */
export const departmentsText = (codes) => codes.map((c) => `${departmentName(c)} (${c})`).join(', ');

/**
 * Place whose department contradicts its city: { expected: [numbers], fixed }; fixed is the
 * corrected place when the city exists in only one department. null if the place is consistent or unknown.
 */
export function placeDepartmentIssue(place) {
  const pl = parsePlace(place);
  if (pl.country) return null; // abroad: no French department to check
  const expected = cityDepartments(pl.city);
  const code = departmentCode(pl.dept);
  if (!expected.length || !code || expected.includes(code)) return null;
  return { expected, fixed: expected.length === 1 ? formatPlace({ ...pl, dept: expected[0] }) : '' };
}

/** Edits between two texts (Levenshtein), stopping beyond `max`. */
function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (x, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let low = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      low = Math.min(low, cur[j]);
    }
    if (low > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/**
 * The commune meant by a name heard, maybe misspelled ("Confoland" for Confolens), with its department:
 * { city, dept } as INSEE writes it, or null if none is close enough or the list isn't loaded.
 * In the department said first (`dept`); a name found in one department only gives that department.
 */
export function findCommune(city, dept = '') {
  if (!index || !String(city || '').trim()) return null;
  const k = key(city);
  let depts = index.get(k);
  let found = k;
  if (!depts) {
    // The closest name, in the department said if there is one there, else anywhere
    const max = Math.max(1, Math.floor(k.length / 4));
    let best = [];
    let bestD = max + 1;
    let bestIn = false;
    for (const [name, ds] of index) {
      const d = distance(k, name, max);
      if (d > max) continue;
      const inDept = !!dept && ds.includes(dept);
      if ((inDept && !bestIn) || (inDept === bestIn && d < bestD)) {
        best = [name];
        bestD = d;
        bestIn = inDept;
      } else if (inDept === bestIn && d === bestD) best.push(name);
    }
    if (best.length !== 1) return null;
    found = best[0];
    depts = index.get(found);
  }
  const d = dept && depts.includes(dept) ? dept : depts.length === 1 ? depts[0] : '';
  const name = d ? official.get(d + '|' + found) : null;
  return { city: name || (found === k ? String(city).trim() : official.get(depts[0] + '|' + found)), dept: d };
}
