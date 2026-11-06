/** Places in the tree and moves from one generation to the next. */
import { S } from '../state.js';
import { P, eventsOf } from './people.js';
import { departmentCode } from './departments.js';
import { countryName, isFrance } from './countries.js';

const clean = (x) => String(x || '').trim();

/**
 * Place entered in four parts, stored in a single text "Locality, City (Department), Country":
 * "Roussely, Orgnac-sur-Vézère (19)", "Bruxelles, Belgique". The country is only written outside
 * France: a place with no country is in France. GEDCOM, the map and search read this text as is.
 */
export function parsePlace(s) {
  let rest = clean(s).replace(/\s+/g, ' ');
  let country = '';
  const last = /^(.*),\s*([^,()]+)$/.exec(rest);
  if (last && countryName(last[2])) {
    rest = last[1].trim();
    country = isFrance(last[2]) ? '' : last[2].trim();
  } else if (!rest.includes(',') && !rest.includes('(') && countryName(rest) && !isFrance(rest)) {
    return { hamlet: '', city: '', dept: '', country: rest }; // the country alone: "Belgique"
  }
  let dept = '';
  const m = /^(.*?)\s*\(([^()]*)\)$/.exec(rest);
  if (m) {
    rest = m[1];
    dept = m[2].trim();
  }
  const parts = rest.split(',').map((x) => x.trim()).filter(Boolean);
  return { hamlet: parts.slice(0, -1).join(', '), city: parts.at(-1) || '', dept, country };
}

/** A place's text from its parts; an empty part is omitted, and so is France. */
export function formatPlace({ hamlet = '', city = '', dept = '', country = '' }) {
  const head = [clean(hamlet), clean(city)].filter(Boolean).join(', ');
  const place = [head, clean(dept) ? `(${clean(dept)})` : ''].filter(Boolean).join(' ');
  if (isFrance(country)) return place;
  return place ? place + ', ' + clean(country) : clean(country);
}

/** Fields that hold a place, to rename it everywhere: [{ collection, id, patch }]. */
export function renamePatches(from, to) {
  const out = [];
  const same = (x) => clean(x) === from;
  for (const [id, p] of S.people) {
    const patch = {};
    if (same(p.birthPlace)) patch.birthPlace = to;
    if (same(p.deathPlace)) patch.deathPlace = to;
    if (eventsOf(p).some((e) => same(e.place))) patch.events = eventsOf(p).map((e) => (same(e.place) ? { ...e, place: to } : e));
    if (Object.keys(patch).length) out.push({ collection: 'people', id, patch });
  }
  for (const [id, u] of S.unions) if (same(u.place)) out.push({ collection: 'unions', id, patch: { place: to } });
  return out;
}

/** Places cited: [{ name, n, ids }], most cited first. */
export function placeUses() {
  const uses = new Map();
  const add = (place, id) => {
    const name = clean(place);
    if (!name) return;
    if (!uses.has(name)) uses.set(name, { name, n: 0, ids: new Set() });
    uses.get(name).n++;
    uses.get(name).ids.add(id);
  };
  for (const [id, p] of S.people) {
    add(p.birthPlace, id);
    add(p.deathPlace, id);
    for (const e of eventsOf(p)) add(e.place, id);
  }
  for (const u of S.unions.values()) add(u.place, u.a);
  return [...uses.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}

/**
 * Rank of a place: in France by department, 01 … 19, 2A, 2B, 21 … 95, 971 …; an unknown
 * or missing department comes after; abroad at the end, by country.
 */
function departmentRank(pl) {
  if (pl.country) return [2, pl.country];
  const code = departmentCode(pl.dept);
  if (!code) return [1, clean(pl.dept)];
  return [0, code === '2A' ? '020A' : code === '2B' ? '020B' : code.padStart(3, '0')];
}

/** Places cited, sorted by department (then abroad, by country), then by city, then by locality (none first). */
export function placesByDepartment() {
  const cmp = (a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' });
  const keyed = placeUses().map((u) => ({ u, pl: parsePlace(u.name) })).map((x) => ({ ...x, rank: departmentRank(x.pl) }));
  keyed.sort((a, b) => a.rank[0] - b.rank[0] || cmp(a.rank[1], b.rank[1])
    || cmp(a.pl.city, b.pl.city) || cmp(a.pl.hamlet, b.pl.hamlet) || cmp(a.u.name, b.u.name));
  return keyed.map((x) => x.u);
}

/**
 * A place's commune, without its locality: "Bourg, Masseret (19)" -> "Masseret (19)". The map only
 * places communes: a locality is rarely known to the geocoding service.
 */
export function cityOf(place) {
  const pl = parsePlace(place);
  return pl.city || pl.country ? formatPlace({ ...pl, hamlet: '' }) : clean(place);
}

/** Communes cited, localities merged: [{ name, n, ids }], most cited first. */
export function cityUses() {
  const cities = new Map();
  for (const u of placeUses()) {
    const name = cityOf(u.name);
    const c = cities.get(name) || cities.set(name, { name, n: 0, ids: new Set() }).get(name);
    c.n += u.n;
    for (const id of u.ids) c.ids.add(id);
  }
  return [...cities.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}

/** Migrations: birth commune of a parent -> that of their child: [{ from, to, n }]. */
export function migrations() {
  const moves = new Map();
  for (const p of S.people.values()) {
    const to = p.birthPlace && cityOf(p.birthPlace);
    if (!to) continue;
    for (const parent of new Set([p.fatherId, p.motherId])) {
      const from = P(parent) && P(parent).birthPlace && cityOf(P(parent).birthPlace);
      if (!from || from === to) continue;
      const key = from + '→' + to;
      if (!moves.has(key)) moves.set(key, { from, to, n: 0 });
      moves.get(key).n++;
    }
  }
  return [...moves.values()];
}
