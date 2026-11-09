/**
 * Generation of each person, as in "Whole tree": a child is at least one row below their
 * parents, two spouses are on the same row, and a person with no known parents moves down
 * to just above their first child. Used by the whole-tree layout and by the statistics.
 */
import { S } from '../state.js';
import { P, partnersOf, childrenOf } from './people.js';

/** Parents present in the tree. */
export function parentsOf(id) {
  const p = P(id);
  return [p.fatherId, p.motherId].filter((x, i, a) => x && x !== id && S.people.has(x) && a.indexOf(x) === i);
}

/** Groups of people linked by parentage or union. */
export function components() {
  const seen = new Set();
  const out = [];
  for (const start of S.people.keys()) {
    if (seen.has(start)) continue;
    const comp = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const id = stack.pop();
      comp.push(id);
      const next = [...parentsOf(id), ...childrenOf(id), ...partnersOf(id).map((x) => x.id)];
      for (const k of next) {
        if (!seen.has(k)) {
          seen.add(k);
          stack.push(k);
        }
      }
    }
    out.push(comp);
  }
  return out;
}

/**
 * Relative generation of each person: a walk through the family puts a child
 * one row below their parents and a spouse on the same row (the first link seen wins
 * if the data contradict each other). The result starts at 0.
 */
function relativeGenerations(comp) {
  const gen = new Map([[comp[0], 0]]);
  const queue = [comp[0]];
  while (queue.length) {
    const id = queue.shift();
    const g = gen.get(id);
    const next = [
      ...parentsOf(id).map((x) => [x, g - 1]),
      ...partnersOf(id).map((x) => [x.id, g]),
      ...childrenOf(id).map((x) => [x, g + 1]),
    ];
    for (const [x, gx] of next) {
      if (gen.has(x)) continue;
      gen.set(x, gx);
      queue.push(x);
    }
  }
  const min = Math.min(...gen.values());
  for (const [id, g] of gen) gen.set(id, g - min);
  return gen;
}

/** Generation of each person (0 = the group's oldest row). */
export function generations(comp) {
  const gen = relativeGenerations(comp);
  const limit = comp.length + 2;
  let changed = true;
  for (let it = 0; changed && it < limit * 2; it++) {
    changed = false;
    const raise = (id, g) => {
      if (g > gen.get(id) && g <= limit) {
        gen.set(id, g);
        changed = true;
      }
    };
    for (const id of comp) {
      const parents = parentsOf(id);
      for (const q of parents) raise(id, gen.get(q) + 1);
      for (const x of partnersOf(id)) raise(id, gen.get(x.id));
      // With no known parents: just above their highest child
      const kids = childrenOf(id);
      if (!parents.length && kids.length) raise(id, Math.min(...kids.map((k) => gen.get(k))) - 1);
    }
  }
  return gen;
}

/** Generation of each person in the tree, as in "Whole tree": id -> number (0 = the oldest). */
export function generationMap() {
  const out = new Map();
  for (const comp of components()) for (const [id, g] of generations(comp)) out.set(id, g);
  return out;
}
