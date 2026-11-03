/**
 * Communes de France et leur département : la ville d'un lieu donne son département.
 * La liste (js/data/communes.js, environ 500 Ko) n'est chargée qu'à la demande : loadCommunes().
 */
import { norm } from '../utils/helpers.js';
import { parsePlace, formatPlace } from './places.js';
import { departmentCode, departmentName } from './departments.js';

let index = null;   // nom de commune normalisé -> numéros de département
let loading = null;

/** Nom pour comparer : sans casse ni accents, « St » pour « Saint », tirets et apostrophes en espaces. */
const key = (name) => norm(name).replace(/[^a-z0-9]+/g, ' ').trim()
  .replace(/\bste\b/g, 'sainte').replace(/\bst\b/g, 'saint');

/** Charge la liste des communes, une seule fois ; à attendre avant cityDepartments(). */
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

/** Départements où se trouve une commune de ce nom : [] si inconnue, ou si la liste n'est pas encore chargée. */
export const cityDepartments = (city) => (index && index.get(key(city))) || [];

/** Départements, en clair : « Charente (16) », « Creuse (23), Haute-Vienne (87) ». */
export const departmentsText = (codes) => codes.map((c) => `${departmentName(c)} (${c})`).join(', ');

/**
 * Lieu dont le département contredit la ville : { expected: [numéros], fixed } ; fixed est le lieu
 * corrigé quand la ville n'existe que dans un département. null si le lieu est cohérent ou inconnu.
 */
export function placeDepartmentIssue(place) {
  const pl = parsePlace(place);
  const expected = cityDepartments(pl.city);
  const code = departmentCode(pl.dept);
  if (!expected.length || !code || expected.includes(code)) return null;
  return { expected, fixed: expected.length === 1 ? formatPlace({ ...pl, dept: expected[0] }) : '' };
}
