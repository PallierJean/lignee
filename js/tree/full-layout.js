/**
 * Layout of the whole tree: everyone, flat, by generation.
 *
 * 1. Each group of people linked to each other (family) is handled separately,
 *    then the groups are placed side by side.
 * 2. Generation of each person: a child is at least one row below their parents,
 *    two spouses are on the same row, and a person with no known parents
 *    moves down to just above their first child.
 * 3. On each row, spouses form a block (cards side by side), each spouse on the side of their
 *    own parents; a couple from two families belongs to neither sibling group and settles between them.
 * 4. Order of the blocks: first a walk through the family, from elders to children, then sweeps
 *    down and up (under the parents, above the children, siblings kept together), then swaps of
 *    two neighbours (a whole sibling group or a block), kept when they help. Each order is judged
 *    on the lines from parents to children: how many cross, and their length. The best one is kept.
 * 5. Horizontal position: several alternating passes that centre the parents
 *    above their children, then the children under their parents, without overlap.
 *    The result is kept until the data change (the swaps take a while on a big tree).
 *
 * Returns { nodes, edges, marks, W, H } like buildLayout(), without empty slots.
 *
 * Compact variant (printing): narrower cards, smaller gaps, and siblings with no
 * spouse or child stacked in a column under their parents, linked by a line on their left.
 * It also returns cw (card width) and gens (number of generations).
 */
import { CW, CH, HG, VG, SG, PAD } from '../config.js';
import { S } from '../state.js';
import { P, partnersOf, childrenOf, dataVersion } from '../model/people.js';
import { parentsOf, components, generations } from '../model/generations.js';

const standards = new Map(); // card width -> measurements, the same object each time (cache key)

/** Measurements for the current card width (full cards, or photos). */
function standard() {
  if (!standards.has(CW)) {
    standards.set(CW, {
      cw: CW,                  // card width
      sg: SG,                  // gap between two spouses
      blockGap: HG * 2,        // gap between two siblings
      familyGap: CW / 2,       // gap between two different sibling groups
      groupGap: CW,            // gap between two unrelated families
      stack: false,            // stack siblings with no descendants
    });
  }
  return standards.get(CW);
}
const COMPACT = { cw: 128, sg: 18, blockGap: 14, familyGap: 30, groupGap: 60, stack: true };
const STACK_GAP = 8;         // vertical gap between two stacked cards
const SPINE = 9;             // a stack's line: left of the cards
let K = null;                // measurements of the current layout
const PASSES = 6;            // centring passes
const SWEEPS = 12;           // ordering sweeps, alternately down and up
const SWAP_ROUNDS = 4;       // rounds of neighbour swaps
const SWAP_BUDGET = 400;     // ms at most spent on swaps
const LANE = 16;             // gap between two stacked horizontal bars
const BUS_MARGIN = 22;       // space between a card and the nearest bar

/** Walk order: each person, their spouses, their parents not yet seen, then their children. */
function visitOrder(comp, gen) {
  const order = new Map();
  const roots = comp.slice().sort((a, b) => gen.get(a) - gen.get(b));
  const visit = (id) => {
    if (order.has(id)) return;
    order.set(id, order.size);
    const partners = partnersOf(id).map((x) => x.id);
    for (const x of partners) visit(x);
    for (const q of parentsOf(id)) visit(q);
    for (const k of childrenOf(id)) visit(k);
  };
  for (const id of roots) visit(id);
  return order;
}

/** Order of the people in a block of spouses: a chain if possible, the man on the left of a couple. */
function blockOrder(members) {
  if (members.length === 1) return members;
  const set = new Set(members);
  const adj = new Map(members.map((id) => [id, partnersOf(id).map((x) => x.id).filter((x) => set.has(x))]));
  if (members.length === 2) {
    const [a, b] = members;
    return P(b).sex === 'M' && P(a).sex !== 'M' ? [b, a] : [a, b];
  }
  const isPath = members.every((id) => adj.get(id).length <= 2)
    && members.reduce((n, id) => n + adj.get(id).length, 0) === 2 * (members.length - 1);
  if (isPath) {
    const path = [members.find((id) => adj.get(id).length === 1)];
    while (path.length < members.length) {
      const last = path[path.length - 1];
      path.push(adj.get(last).find((x) => !path.includes(x)));
    }
    return path;
  }
  // A person with several spouses: in the middle, the spouses on either side
  const hub = members.reduce((a, b) => (adj.get(b).length > adj.get(a).length ? b : a));
  const left = [];
  const right = [];
  adj.get(hub).forEach((x, i) => (i % 2 ? left : right).push(x));
  const rest = members.filter((x) => x !== hub && !adj.get(hub).includes(x));
  return [...left.reverse(), hub, ...right, ...rest];
}

/** Gap to leave after each block: wider between two different sibling groups. */
function gapsOf(blocks) {
  return blocks.map((b, i) => {
    const c = blocks[i + 1];
    return c && b.fam && b.fam === c.fam ? K.blockGap : K.familyGap;
  });
}

/**
 * Places a row's blocks as close as possible to their desired positions, in order
 * and without overlap (weighted isotonic regression).
 */
function placeRow(blocks, targets) {
  const gaps = gapsOf(blocks);
  let off = 0;
  const pools = [];
  blocks.forEach((b, i) => {
    const t = targets[i];
    const v = (t ? t.left : b.left) - off;
    const w = t ? t.w : 0.01;
    pools.push({ sum: v * w, w, n: 1 });
    while (pools.length > 1) {
      const a = pools[pools.length - 2];
      const c = pools[pools.length - 1];
      if (a.sum / a.w <= c.sum / c.w) break;
      pools.splice(-2, 2, { sum: a.sum + c.sum, w: a.w + c.w, n: a.n + c.n });
    }
    off += b.w + gaps[i];
  });
  let i = 0;
  off = 0;
  for (const pool of pools) {
    const z = pool.sum / pool.w;
    for (let k = 0; k < pool.n; k++, i++) {
      blocks[i].left = z + off;
      off += blocks[i].w + gaps[i];
    }
  }
}

/** Layout of a group: blocks per row, with their positions. */
function layoutComponent(comp) {
  const gen = generations(comp);
  const order = visitOrder(comp, gen);
  const blockOf = new Map();   // id -> { block, i }
  const rows = [];

  // Blocks of spouses on each row
  const done = new Set();
  for (const id of comp) {
    if (done.has(id)) continue;
    const g = gen.get(id);
    const members = [];
    const stack = [id];
    done.add(id);
    while (stack.length) {
      const x = stack.pop();
      members.push(x);
      for (const pt of partnersOf(x)) {
        if (!done.has(pt.id) && gen.get(pt.id) === g) {
          done.add(pt.id);
          stack.push(pt.id);
        }
      }
    }
    members.sort((a, b) => order.get(a) - order.get(b));
    const ids = blockOrder(members);
    // The block's sibling group: that of the first member whose parents are known
    // The block's sibling group: that of its members whose parents are known, if they share it;
    // spouses from two families belong to neither and settle between them
    const fams = new Set(ids.filter((x) => parentsOf(x).length).map((x) => parentsOf(x).slice().sort().join('|')));
    const fam = fams.size === 1 ? [...fams][0] : '';
    const block = { ids, g, fam, w: ids.length * K.cw + (ids.length - 1) * K.sg, left: 0, rank: Math.min(...ids.map((x) => order.get(x))) };
    ids.forEach((x, i) => blockOf.set(x, { block, i, k: 0 }));
    (rows[g] = rows[g] || []).push(block);
  }
  if (K.stack) for (const row of rows) if (row) stackLeaves(row, blockOf);
  const ordered = rows.filter(Boolean);
  for (const row of ordered) {
    row.sort((a, b) => a.rank - b.rank);
    placeRow(row, row.map(() => ({ left: 0, w: 1 })));
  }

  const center = (id) => {
    const o = blockOf.get(id);
    return o.block.left + o.i * (K.cw + K.sg) + K.cw / 2;
  };
  const offsetIn = (id) => blockOf.get(id).i * (K.cw + K.sg) + K.cw / 2;
  const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

  // Families: parents (1 or 2) and their children
  const families = new Map();
  for (const id of comp) {
    const parents = parentsOf(id);
    if (!parents.length) continue;
    const key = parents.slice().sort().join('|');
    if (!families.has(key)) families.set(key, { parents, kids: [] });
    families.get(key).kids.push(id);
  }
  const anchorOf = (f) => mean(f.parents.map(center));

  // Families with at least one parent in each block
  const familiesOf = new Map();
  for (const f of families.values()) {
    for (const b of new Set(f.parents.map((q) => blockOf.get(q).block))) {
      if (!familiesOf.has(b)) familiesOf.set(b, []);
      familiesOf.get(b).push(f);
    }
  }

  // Parents above their children
  const alignUp = (row) => {
    const targets = row.map((b) => {
      let sum = 0;
      let w = 0;
      for (const f of familiesOf.get(b) || []) {
        const inBlock = f.parents.filter((q) => blockOf.get(q).block === b);
        const local = mean(inBlock.map(offsetIn));
        sum += (mean(f.kids.map(center)) - local) * f.kids.length;
        w += f.kids.length;
      }
      return w ? { left: sum / w, w } : null;
    });
    placeRow(row, targets);
  };

  // Children under their parents
  const alignDown = (row) => {
    const targets = row.map((b) => {
      let sum = 0;
      let w = 0;
      for (const id of b.ids) {
        const parents = parentsOf(id);
        if (!parents.length) continue;
        sum += mean(parents.map(center)) - offsetIn(id);
        w += 1;
      }
      return w ? { left: sum / w, w } : null;
    });
    placeRow(row, targets);
  };

  // Order of a row's blocks: under their parents (sweeping down) or above their children
  // (sweeping up), failing that where they are; siblings side by side, to limit crossing lines
  const reorder = (row, down) => {
    const key = new Map(row.map((b) => {
      const up = b.ids.filter((id) => parentsOf(id).length).map((id) => mean(parentsOf(id).map(center)));
      const kids = b.ids.flatMap((id) => childrenOf(id)).filter((k) => blockOf.has(k)).map(center);
      const first = down ? up : kids;
      const second = down ? kids : up;
      return [b, first.length ? mean(first) : second.length ? mean(second) : b.left + b.w / 2];
    }));
    const famKey = new Map();
    for (const b of row) {
      if (!b.fam) continue;
      if (!famKey.has(b.fam)) famKey.set(b.fam, []);
      famKey.get(b.fam).push(key.get(b));
    }
    for (const [f, keys] of famKey) famKey.set(f, mean(keys));
    row.sort((a, b) => (famKey.get(a.fam) ?? key.get(a)) - (famKey.get(b.fam) ?? key.get(b)) || key.get(a) - key.get(b) || a.rank - b.rank);
  };

  // Quality of a layout: lines from parents to children that cross, and their length
  const score = () => {
    const byRow = new Map();
    for (const f of families.values()) {
      const a = anchorOf(f);
      for (const k of f.kids) {
        const g = blockOf.get(k).block.g;
        if (!byRow.has(g)) byRow.set(g, []);
        byRow.get(g).push([a, center(k)]);
      }
    }
    let crossings = 0;
    let length = 0;
    for (const segs of byRow.values()) {
      for (let i = 0; i < segs.length; i++) {
        length += Math.abs(segs[i][0] - segs[i][1]);
        for (let j = i + 1; j < segs.length; j++) {
          if ((segs[i][0] - segs[j][0]) * (segs[i][1] - segs[j][1]) < -1e-6) crossings++;
        }
      }
    }
    return crossings * K.cw + length;
  };
  // A couple's spouses each on the side of their own parents (a chain of 3 or more stays as it is)
  const orient = () => {
    for (const row of ordered) {
      for (const b of row) {
        if (b.ids.length !== 2 || b.stack) continue;
        const side = b.ids.map((id) => (parentsOf(id).length ? mean(parentsOf(id).map(center)) : null));
        if (side[0] === null || side[1] === null || side[0] <= side[1]) continue;
        b.ids.reverse();
        b.ids.forEach((x, i) => { blockOf.get(x).i = i; });
      }
    }
  };
  const align = () => {
    orient();
    for (let r = ordered.length - 1; r >= 0; r--) alignUp(ordered[r]);
    for (const row of ordered) alignDown(row);
  };

  // Layout of a given order: blocks placed, then scored
  const settle = () => {
    for (let pass = 0; pass < PASSES; pass++) align();
    return score();
  };
  const snapshot = (value) => ({ value, rows: ordered.map((row) => row.map((b) => [b, b.left])) });

  // First order: under the parents, as placed so far
  for (let pass = 0; pass < PASSES; pass++) {
    if (pass < PASSES / 2) for (const row of ordered) reorder(row, true);
    align();
  }
  let best = snapshot(score());
  // Then sweeps up and down from it; the best layout found is kept
  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    const down = sweep % 2 === 1;
    for (const row of down ? ordered : ordered.slice().reverse()) reorder(row, down);
    const value = settle();
    if (value < best.value) best = snapshot(value);
  }
  const restore = (snap) => snap.rows.forEach((row, r) => {
    ordered[r].splice(0, row.length, ...row.map(([b]) => b));
    for (const [b, left] of row) b.left = left;
  });
  restore(best);

  // Swaps of two neighbours (a whole sibling group, or a block on its own), kept when they help:
  // sweeps only follow averages, and can't turn two families round. Time-limited for big trees
  const until = performance.now() + SWAP_BUDGET;
  const units = (row) => {
    const out = [];
    for (const b of row) {
      const last = out[out.length - 1];
      if (last && b.fam && last[0].fam === b.fam) last.push(b);
      else out.push([b]);
    }
    return out;
  };
  for (let round = 0, better = true; better && round < SWAP_ROUNDS; round++) {
    better = false;
    for (const [r, row] of ordered.entries()) {
      for (let i = 0; i + 1 < units(row).length && performance.now() < until; i++) {
        const u = units(row);
        const swapped = [...u.slice(0, i).flat(), ...u[i + 1], ...u[i], ...u.slice(i + 2).flat()];
        // Two tries: the swap alone, then with the rows below following (children under their parents' new places)
        let found = null;
        for (const follow of [false, true]) {
          restore(best);
          row.splice(0, row.length, ...swapped);
          if (follow) {
            align();
            for (const below of ordered.slice(r + 1)) reorder(below, true);
          }
          const value = settle();
          if (value < (found ? found.value : best.value) - 1) found = snapshot(value);
        }
        if (found) {
          best = found;
          better = true;
        }
        restore(best);
      }
    }
  }
  restore(best);

  const minLeft = Math.min(...ordered.map((row) => row[0].left));
  const maxRight = Math.max(...ordered.map((row) => row[row.length - 1].left + row[row.length - 1].w));
  return { rows: ordered, blockOf, families, anchorOf, center, gen, minLeft, width: maxRight - minLeft, height: rows.length };
}

/** A row's stack: siblings of the same group with no spouse or child, in one column. */
function stackLeaves(row, blockOf) {
  const leaves = new Map();
  for (const b of row) {
    const id = b.ids[0];
    if (b.ids.length !== 1 || !b.fam || childrenOf(id).length || partnersOf(id).length) continue;
    if (!leaves.has(b.fam)) leaves.set(b.fam, []);
    leaves.get(b.fam).push(b);
  }
  for (const group of leaves.values()) {
    if (group.length < 2) continue;
    const ids = group.sort((a, b) => a.rank - b.rank).map((b) => b.ids[0]);
    const stack = { ids, g: group[0].g, fam: group[0].fam, w: K.cw, left: 0, rank: group[0].rank, stack: true };
    ids.forEach((x, k) => blockOf.set(x, { block: stack, i: 0, k }));
    row.splice(row.indexOf(group[0]), 1, stack);
    for (const b of group.slice(1)) row.splice(row.indexOf(b), 1);
  }
}

/** Sosa numbers of the focus person's ancestors (the smallest in case of pedigree collapse). */
function sosaMap() {
  const out = new Map();
  if (!S.focus || !S.people.has(S.focus)) return out;
  let level = [[S.focus, 1]];
  for (let g = 0; level.length && g < 40; g++) {
    const next = [];
    for (const [id, n] of level) {
      if (out.has(id)) continue;
      out.set(id, n);
      const p = P(id);
      if (p.fatherId && S.people.has(p.fatherId)) next.push([p.fatherId, 2 * n]);
      if (p.motherId && S.people.has(p.motherId)) next.push([p.motherId, 2 * n + 1]);
    }
    level = next;
  }
  return out;
}

// Last families laid out, with what they depend on: the order is searched for (swaps), which takes
// a while on a big tree, and the tree is drawn again on every click or zoom
let cached = { key: [], comps: [] };

/** Each group of the tree laid out, largest first; kept until the data or the card size change. */
function componentLayouts() {
  const key = [S.people, S.unions, dataVersion(), K];
  if (key.some((k, i) => k !== cached.key[i])) {
    cached = { key, comps: components().map(layoutComponent).sort((a, b) => b.blockOf.size - a.blockOf.size) };
  }
  return cached.comps;
}

export function buildFullLayout({ compact = false } = {}) {
  if (!S.people.size) return null;
  K = compact ? COMPACT : standard();
  try {
    return fullLayout();
  } finally {
    K = null;
  }
}

function fullLayout() {
  const nodes = [];
  const edges = [];
  const marks = [];
  const sosa = sosaMap();

  // Largest families first
  const comps = componentLayouts();

  // Parentage bars: one horizontal bar under the parents per family, on its own
  // lane when it would cross another family's
  const lanesAt = [];   // parents' generation -> number of lanes
  let X = PAD;
  const placed = comps.map((c) => {
    const dx = X - c.minLeft;
    X += c.width + K.groupGap;
    const xOf = (id) => c.center(id) + dx - K.cw / 2;
    const byGen = new Map();
    for (const f of c.families.values()) {
      const [a, b] = f.parents;
      const adjacent = b && c.blockOf.get(a).block === c.blockOf.get(b).block
        && Math.abs(c.blockOf.get(a).i - c.blockOf.get(b).i) === 1;
      const starts = adjacent
        ? [{ x: c.anchorOf(f) + dx, g: c.gen.get(a), mid: true }]
        : f.parents.map((q) => ({ x: xOf(q) + K.cw / 2, g: c.gen.get(q) }));
      // A stack of children has a single attachment point: its line, left of the cards
      const kids = [];
      const stacks = new Map();
      for (const k of f.kids) {
        const o = c.blockOf.get(k);
        if (!o.block.stack) kids.push({ x: xOf(k) + K.cw / 2, g: c.gen.get(k) });
        else if (stacks.has(o.block)) stacks.get(o.block).ks.push(o.k);
        else {
          const kid = { x: xOf(k) - SPINE, g: c.gen.get(k), ks: [o.k] };
          stacks.set(o.block, kid);
          kids.push(kid);
        }
      }
      const xs = [...starts, ...kids].map((p) => p.x);
      const g = Math.max(...f.parents.map((q) => c.gen.get(q)));
      const item = { starts, kids, g, x0: Math.min(...xs), x1: Math.max(...xs) };
      if (!byGen.has(g)) byGen.set(g, []);
      byGen.get(g).push(item);
    }
    for (const [g, items] of byGen) {
      items.sort((p, q) => p.x0 - q.x0 || p.x1 - q.x1);
      const lanes = [];
      for (const it of items) {
        let lane = lanes.findIndex((end) => end < it.x0 - K.blockGap);
        if (lane < 0) lane = lanes.length;
        lanes[lane] = it.x1;
        it.lane = lane;
      }
      lanesAt[g] = Math.max(lanesAt[g] || 0, lanes.length);
    }
    return { c, xOf, byGen };
  });

  // Height of each gap between two generations, by number of lanes,
  // and of each row, by its tallest stack
  const maxRows = Math.max(...comps.map((c) => c.height));
  const gapOf = (g) => Math.max(VG, 2 * BUS_MARGIN + ((lanesAt[g] || 1) - 1) * LANE);
  const depth = [];
  for (const c of comps) for (const row of c.rows) for (const b of row) depth[b.g] = Math.max(depth[b.g] || 1, b.stack ? b.ids.length : 1);
  const rowH = (g) => (depth[g] || 1) * (CH + STACK_GAP) - STACK_GAP;
  const rowY = [PAD];
  for (let g = 1; g < maxRows; g++) rowY[g] = rowY[g - 1] + rowH(g - 1) + gapOf(g - 1);
  const stackY = (g, k) => rowY[g] + k * (CH + STACK_GAP);

  for (const { c, xOf, byGen } of placed) {
    const yOf = (id) => stackY(c.gen.get(id), c.blockOf.get(id).k);

    // Cards and unions
    for (const row of c.rows) {
      for (const b of row) {
        b.ids.forEach((id, i) => {
          const s = sosa.get(id);
          nodes.push({ t: 'p', id, x: xOf(id), y: yOf(id), focus: id === S.focus, sosa: s || null });
          // Union with a spouse placed further left in the same block
          for (const pt of partnersOf(id)) {
            const o = c.blockOf.get(pt.id);
            if (!o || o.block !== b || o.i >= i) continue;
            const my = yOf(id) + CH / 2;
            const x1 = xOf(pt.id) + K.cw;
            const x2 = xOf(id);
            edges.push({ d: `M${x1},${my}H${x2}`, dash: !pt.uid });
            marks.push({ x: x2 - K.sg / 2, y: my, dash: !pt.uid });
          }
        });
      }
    }

    // Parentage: the lanes are spread across the gap, the first at the top
    for (const [g, items] of byGen) {
      const base = rowY[g] + rowH(g);
      const n = lanesAt[g];
      const top = base + (gapOf(g) - (n - 1) * LANE) / 2;
      for (const it of items) {
        const busY = top + it.lane * LANE;
        let d = `M${it.x0},${busY}H${it.x1}`;
        for (const s of it.starts) d += `M${s.x},${s.mid ? rowY[s.g] + CH / 2 : rowY[s.g] + CH}V${busY}`;
        for (const k of it.kids) {
          if (!k.ks) d += `M${k.x},${busY}V${rowY[k.g]}`;
          else {
            const mids = k.ks.map((i) => stackY(k.g, i) + CH / 2);
            d += `M${k.x},${busY}V${Math.max(...mids)}` + mids.map((y) => `M${k.x},${y}H${k.x + SPINE}`).join('');
          }
        }
        edges.push({ d, dash: false });
      }
    }
  }

  const W = X - K.groupGap + PAD;
  const H = rowY[maxRows - 1] + rowH(maxRows - 1) + PAD;
  return { nodes, edges, marks, W, H, cw: K.cw, gens: maxRows };
}
