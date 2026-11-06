/**
 * French communes and their department: a place's city gives its department.
 * The list (js/data/communes.js, about 500 KB) is only loaded on demand: loadCommunes().
 */
import { norm } from '../utils/helpers.js';
import { parsePlace, formatPlace } from './places.js';
import { departmentCode, departmentName } from './departments.js';

let index = null;   // normalised commune name -> department numbers
let loading = null;

/** Name for comparison: no case or accents, "St" for "Saint", hyphens and apostrophes as spaces. */
const key = (name) => norm(name).replace(/[^a-z0-9]+/g, ' ').trim()
  .replace(/\bste\b/g, 'sainte').replace(/\bst\b/g, 'saint');

/** Loads the commune list, only once; await it before cityDepartments(). */
export function loadCommunes() {
  if (!loading) {
    loading = import('../data/communes.js').then(({ COMMUNES }) => {
      const map = new Map();
      for (const [dept, names] of Object.entries(COMMUNES)) {
        for (const name of names.split('|')) {
          const k = key(name);
          if (!map.has(k)) map.set(k, []);
          if (!map.get(k).includes(dept)) map.get(k).push(dept);
        }
      }
      index = map;
    });
  }
  return loading;
}

export const communesLoaded = () => index !== null;

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
