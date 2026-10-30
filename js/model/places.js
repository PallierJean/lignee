/** Lieux de l'arbre et déplacements d'une génération à l'autre. */
import { S } from '../state.js';
import { P, eventsOf } from './people.js';

const clean = (x) => String(x || '').trim();

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
