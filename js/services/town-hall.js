/**
 * Contact details of a French town hall, or of a department's archives, from the official directory
 * of service-public.fr (open data). Asked only when the user clicks: only the commune's name and
 * department are sent.
 * Results are kept in memory until the page is reloaded.
 */
const API = 'https://api-lannuaire.service-public.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records';

/** Search page of the directory, when the town hall isn't found automatically. */
export const townHallSearchUrl = (city) => 'https://lannuaire.service-public.fr/recherche?whoWhat=Mairie&where=' + encodeURIComponent(city);

/** Search page of the directory for a department's archives (`name`: the department's name). */
export const archivesSearchUrl = (name) => 'https://lannuaire.service-public.fr/recherche?whoWhat=' + encodeURIComponent('Archives départementales') + '&where=' + encodeURIComponent(name);

const cache = new Map();

/** First value of a directory field stored as a JSON list ([{ valeur }]), or ''. */
function first(field) {
  try {
    const list = typeof field === 'string' ? JSON.parse(field) : field;
    return (Array.isArray(list) && list[0] && list[0].valeur) || '';
  } catch (e) {
    return '';
  }
}

/** Only http(s) links are kept: a directory entry can't slip in another kind of link. */
const web = (url) => (/^https?:\/\//i.test(url || '') ? url : '');

// French departments only: the directory knows nothing else
const FRENCH_DEPT = /^(\d{2}|2[AB]|97\d)$/;

/** First directory entry matching `where`, as { name, email, phone, site, form }, or null; kept under key `k`. */
async function lookUp(k, where) {
  if (cache.has(k)) return cache.get(k);
  const params = new URLSearchParams({ where, select: 'nom,adresse_courriel,telephone,site_internet,formulaire_contact', limit: '1' });
  const res = await fetch(API + '?' + params);
  if (!res.ok) throw new Error(String(res.status));
  const [hit] = (await res.json()).results || [];
  const found = hit ? {
    name: hit.nom || '',
    email: /^[^\s@<>"]+@[^\s@<>"]+$/.test(hit.adresse_courriel || '') ? hit.adresse_courriel : '',
    phone: first(hit.telephone),
    site: web(first(hit.site_internet)),
    form: web(hit.formulaire_contact),
  } : null;
  cache.set(k, found);
  return found;
}

/**
 * Town hall of commune `city` in department `dept`: { name, email, phone, site, form },
 * or null if the directory has no town hall of that name there.
 */
export async function findTownHall(city, dept) {
  if (!FRENCH_DEPT.test(dept)) return null;
  const name = String(city).replace(/["\\]/g, '');
  return lookUp(dept + '|' + city, `nom = "Mairie - ${name}" and startswith(code_insee_commune, "${dept}")`);
}

/**
 * Archives of department `dept` (Paris: the Archives de Paris), where registers older than two
 * centuries are kept: { name, email, phone, site, form }, or null if the directory doesn't have them.
 */
export async function findArchives(dept) {
  if (!FRENCH_DEPT.test(dept)) return null;
  return lookUp('archives|' + dept, `(startswith(nom, "Archives départementales") or nom = "Archives de Paris") and startswith(code_insee_commune, "${dept}")`);
}

/** Forgets the town halls already found (tests). */
export const resetTownHalls = () => cache.clear();
