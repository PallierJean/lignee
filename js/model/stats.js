/** Statistiques de l'arbre ouvert. */
import { S } from '../state.js';
import { dateParts, fullDate } from '../utils/dates.js';
import { norm } from '../utils/helpers.js';
import { P, surname, maiden, isDead, childrenOf, eventsOf } from './people.js';
import { generationMap } from '../tree/full-layout.js';

const TOP = 10;           // lignes des classements
const MAX_GENS = 30;      // générations d'ascendants parcourues (borne les arbres à boucle)
const MAX_LIFE = 130;     // au-delà, une date est fausse : hors de la moyenne

/** Classement [{ name, n }] ; les variantes d'un même nom (casse, accents) sont réunies. */
function ranking(names) {
  const groups = new Map();
  for (const name of names) {
    const key = norm(name);
    if (!groups.has(key)) groups.set(key, { name, n: 0 });
    groups.get(key).n++;
  }
  return [...groups.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, TOP);
}

/** Âge au décès en années, ou null si les dates ne permettent pas de le calculer. */
function ageAtDeath(p) {
  const b = dateParts(p.birthDate);
  const d = dateParts(p.deathDate);
  if (!b || !d || /bef|aft/.test(b.q + d.q)) return null;
  const bf = fullDate(p.birthDate);
  const df = fullDate(p.deathDate);
  const early = bf && df && (df.m < bf.m || (df.m === bf.m && df.d < bf.d));
  const age = d.y - b.y - (early ? 1 : 0);
  return age >= 0 && age <= MAX_LIFE ? age : null;
}

function longevity() {
  const groups = { all: [], M: [], F: [] };
  let oldest = null;
  for (const [id, p] of S.people) {
    if (!isDead(p)) continue;
    const age = ageAtDeath(p);
    if (age === null) continue;
    groups.all.push(age);
    if (p.sex === 'M' || p.sex === 'F') groups[p.sex].push(age);
    if (!oldest || age > oldest.age) oldest = { id, age };
  }
  const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  return { n: groups.all.length, all: mean(groups.all), M: mean(groups.M), F: mean(groups.F), oldest };
}

/** Par génération (celles de « Tout l'arbre ») : personnes, parents, enfants par parent. */
function generations() {
  const rows = [];
  for (const [id, g] of generationMap()) {
    const row = (rows[g] = rows[g] || { gen: g + 1, people: 0, parents: 0, children: 0 });
    row.people++;
    const kids = childrenOf(id).length;
    if (kids) row.parents++;
    row.children += kids;
  }
  return rows.filter(Boolean);
}

/** Ascendants trouvés à chaque génération au-dessus de la personne centrale. */
function completeness() {
  if (!P(S.focus)) return [];
  const rows = [];
  // Id -> nombre de places dans la génération : un ancêtre commun (implexe) compte à chaque place
  let level = new Map([[S.focus, 1]]);
  for (let gen = 1; gen <= MAX_GENS; gen++) {
    const next = new Map();
    for (const [id, n] of level) {
      const p = P(id);
      for (const parent of new Set([p.fatherId, p.motherId])) {
        if (parent && S.people.has(parent)) next.set(parent, (next.get(parent) || 0) + n);
      }
    }
    if (!next.size) break;
    const found = [...next.values()].reduce((s, n) => s + n, 0);
    rows.push({ gen, found, expected: 2 ** gen, pct: Math.min(100, (found / 2 ** gen) * 100) });
    level = next;
  }
  return rows;
}

export function treeStats() {
  const birthNames = [];
  const places = [];
  const sexes = { M: 0, F: 0, U: 0 };
  let living = 0;
  for (const p of S.people.values()) {
    const name = maiden(p) || surname(p);
    if (name) birthNames.push(name);
    sexes[p.sex === 'M' || p.sex === 'F' ? p.sex : 'U']++;
    if (!isDead(p)) living++;
    const own = [p.birthPlace, p.deathPlace, ...eventsOf(p).map((e) => e.place)].map((x) => String(x || '').trim()).filter(Boolean);
    places.push(...own);
  }
  for (const u of S.unions.values()) if (String(u.place || '').trim()) places.push(u.place.trim());
  return {
    people: S.people.size, unions: S.unions.size, sexes, living,
    surnames: ranking(birthNames), places: ranking(places),
    longevity: longevity(), generations: generations(), completeness: completeness(),
  };
}
