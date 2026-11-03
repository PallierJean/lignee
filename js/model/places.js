/** Lieux de l'arbre et déplacements d'une génération à l'autre. */
import { S } from '../state.js';
import { P, eventsOf } from './people.js';

const clean = (x) => String(x || '').trim();

/**
 * Lieu saisi en trois parties, rangées dans un seul texte « Lieu-dit, Ville (Département) » :
 * « Roussely, Orgnac-sur-Vézère (19) ». Le GEDCOM, la carte et la recherche lisent ce texte tel quel.
 */
export function parsePlace(s) {
  let rest = clean(s).replace(/\s+/g, ' ');
  let dept = '';
  const m = /^(.*?)\s*\(([^()]*)\)$/.exec(rest);
  if (m) {
    rest = m[1];
    dept = m[2].trim();
  }
  const parts = rest.split(',').map((x) => x.trim()).filter(Boolean);
  return { hamlet: parts.slice(0, -1).join(', '), city: parts.at(-1) || '', dept };
}

/** Texte d'un lieu à partir de ses parties ; une partie vide est omise. */
export function formatPlace({ hamlet = '', city = '', dept = '' }) {
  const head = [clean(hamlet), clean(city)].filter(Boolean).join(', ');
  return [head, clean(dept) ? `(${clean(dept)})` : ''].filter(Boolean).join(' ');
}

/** Champs qui portent un lieu, pour le renommer partout : [{ collection, id, patch }]. */
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

/** Lieux cités : [{ name, n, ids }], les plus cités d'abord. */
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

/** Migrations : lieu de naissance d'un parent -> celui de son enfant : [{ from, to, n }]. */
export function migrations() {
  const moves = new Map();
  for (const p of S.people.values()) {
    const to = clean(p.birthPlace);
    if (!to) continue;
    for (const parent of new Set([p.fatherId, p.motherId])) {
      const from = clean(P(parent) && P(parent).birthPlace);
      if (!from || from === to) continue;
      const key = from + '→' + to;
      if (!moves.has(key)) moves.set(key, { from, to, n: 0 });
      moves.get(key).n++;
    }
  }
  return [...moves.values()];
}
