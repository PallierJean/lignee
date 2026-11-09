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
