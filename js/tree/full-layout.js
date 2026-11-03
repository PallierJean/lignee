/**
 * Mise en page de l'arbre complet : toutes les personnes, à plat, par génération.
 *
 * 1. Chaque groupe de personnes reliées entre elles (famille) est traité à part,
 *    puis les groupes sont posés côte à côte.
 * 2. Génération de chaque personne : un enfant est au moins une ligne sous ses parents,
 *    deux conjoints sont sur la même ligne, et une personne sans parents connus
 *    descend juste au-dessus de son premier enfant.
 * 3. Sur chaque ligne, les conjoints forment un bloc (fiches côte à côte).
 *    L'ordre des blocs suit un parcours de la famille, des aînés vers les enfants.
 * 4. Position horizontale : plusieurs passes alternées qui centrent les parents
 *    au-dessus de leurs enfants, puis les enfants sous leurs parents, sans chevauchement.
 *
 * Renvoie { nodes, edges, marks, W, H } comme buildLayout(), sans emplacements vides.
 *
 * Variante compacte (impression) : fiches plus étroites, écarts réduits, et les frères et sœurs
 * sans conjoint ni enfant empilés en colonne sous leurs parents, reliés par un trait sur leur gauche.
 * Elle renvoie aussi cw (largeur des fiches) et gens (nombre de générations).
 */
import { CW, CH, HG, VG, SG, PAD } from '../config.js';
import { S } from '../state.js';
import { P, partnersOf, childrenOf } from '../model/people.js';

const STANDARD = {
  cw: CW,                    // largeur d'une fiche
  sg: SG,                    // écart entre deux conjoints
  blockGap: HG * 2,          // écart entre deux frères et sœurs
  familyGap: CW / 2,         // écart entre deux fratries différentes
  groupGap: CW,              // écart entre deux familles sans lien
  stack: false,              // empiler les frères et sœurs sans descendance
};
const COMPACT = { cw: 128, sg: 18, blockGap: 14, familyGap: 30, groupGap: 60, stack: true };
const STACK_GAP = 8;         // écart vertical entre deux fiches empilées
const SPINE = 9;             // trait d'une pile : à gauche des fiches
let K = STANDARD;            // mesures de la mise en page en cours
const PASSES = 6;            // passes de centrage
const LANE = 16;             // écart entre deux barres horizontales superposées
const BUS_MARGIN = 22;       // espace entre une fiche et la barre la plus proche

/** Parents présents dans l'arbre. */
function parentsOf(id) {
  const p = P(id);
  return [p.fatherId, p.motherId].filter((x, i, a) => x && x !== id && S.people.has(x) && a.indexOf(x) === i);
}

/** Groupes de personnes reliées par filiation ou union. */
function components() {
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
 * Génération relative de chaque personne : un parcours de la famille met un enfant
 * une ligne sous ses parents et un conjoint sur la même ligne (le premier lien vu l'emporte
 * si les données se contredisent). Le résultat commence à 0.
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

/** Génération de chaque personne (0 = la plus ancienne ligne du groupe). */
function generations(comp) {
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
      // Sans parents connus : juste au-dessus de son enfant le plus haut
      const kids = childrenOf(id);
      if (!parents.length && kids.length) raise(id, Math.min(...kids.map((k) => gen.get(k))) - 1);
    }
  }
  return gen;
}

/** Génération de chaque personne de l'arbre, comme dans « Tout l'arbre » : id -> numéro (0 = la plus ancienne). */
export function generationMap() {
  const out = new Map();
  for (const comp of components()) for (const [id, g] of generations(comp)) out.set(id, g);
  return out;
}

/** Écart en générations entre la ligne la plus ancienne et la plus récente de l'arbre. */
export const generationSpan = () => Math.max(0, ...generationMap().values());

/** Ordre de parcours : chaque personne, ses conjoints, ses parents encore non vus, puis ses enfants. */
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

/** Ordre des personnes dans un bloc de conjoints : une chaîne si possible, l'homme à gauche d'un couple. */
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
  // Une personne avec plusieurs conjoints : au milieu, les conjoints de part et d'autre
  const hub = members.reduce((a, b) => (adj.get(b).length > adj.get(a).length ? b : a));
  const left = [];
  const right = [];
  adj.get(hub).forEach((x, i) => (i % 2 ? left : right).push(x));
  const rest = members.filter((x) => x !== hub && !adj.get(hub).includes(x));
  return [...left.reverse(), hub, ...right, ...rest];
}

/** Écart à laisser après chaque bloc : plus large entre deux fratries différentes. */
function gapsOf(blocks) {
  return blocks.map((b, i) => {
    const c = blocks[i + 1];
    return c && b.fam && b.fam === c.fam ? K.blockGap : K.familyGap;
  });
}

/**
 * Place les blocs d'une ligne au plus près de leurs positions souhaitées, dans l'ordre
 * et sans chevauchement (régression isotone pondérée).
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

/** Mise en page d'un groupe : blocs par ligne, avec leurs positions. */
function layoutComponent(comp) {
  const gen = generations(comp);
  const order = visitOrder(comp, gen);
  const blockOf = new Map();   // id -> { block, i }
  const rows = [];

  // Blocs de conjoints de chaque ligne
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
    // Fratrie du bloc : celle du premier membre dont les parents sont connus
    const withParents = ids.find((x) => parentsOf(x).length);
    const fam = withParents ? parentsOf(withParents).slice().sort().join('|') : '';
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

  // Familles : parents (1 ou 2) et leurs enfants
  const families = new Map();
  for (const id of comp) {
    const parents = parentsOf(id);
    if (!parents.length) continue;
    const key = parents.slice().sort().join('|');
    if (!families.has(key)) families.set(key, { parents, kids: [] });
    families.get(key).kids.push(id);
  }
  const anchorOf = (f) => mean(f.parents.map(center));

  // Familles dont au moins un parent est dans chaque bloc
  const familiesOf = new Map();
  for (const f of families.values()) {
    for (const b of new Set(f.parents.map((q) => blockOf.get(q).block))) {
      if (!familiesOf.has(b)) familiesOf.set(b, []);
      familiesOf.get(b).push(f);
    }
  }

  // Les parents au-dessus de leurs enfants
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

  // Les enfants sous leurs parents
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

  // Ordre des blocs d'une ligne : sous les parents (à défaut au-dessus des enfants),
  // les frères et sœurs côte à côte, pour limiter les croisements de traits
  const reorder = (row) => {
    const key = new Map(row.map((b) => {
      const up = b.ids.filter((id) => parentsOf(id).length).map((id) => mean(parentsOf(id).map(center)));
      const down = b.ids.flatMap((id) => childrenOf(id)).filter((k) => blockOf.has(k)).map(center);
      return [b, up.length ? mean(up) : down.length ? mean(down) : b.left + b.w / 2];
    }));
    const famKey = new Map();
    for (const b of row) if (b.fam && !famKey.has(b.fam)) famKey.set(b.fam, key.get(b));
    row.sort((a, b) => (famKey.get(a.fam) ?? key.get(a)) - (famKey.get(b.fam) ?? key.get(b)) || key.get(a) - key.get(b) || a.rank - b.rank);
  };

  for (let pass = 0; pass < PASSES; pass++) {
    if (pass < PASSES / 2) for (const row of ordered) reorder(row);
    for (let r = ordered.length - 1; r >= 0; r--) alignUp(ordered[r]);
    for (const row of ordered) alignDown(row);
  }

  const minLeft = Math.min(...ordered.map((row) => row[0].left));
  const maxRight = Math.max(...ordered.map((row) => row[row.length - 1].left + row[row.length - 1].w));
  return { rows: ordered, blockOf, families, anchorOf, center, gen, minLeft, width: maxRight - minLeft, height: rows.length };
}

/** Pile d'une ligne : les frères et sœurs sans conjoint ni enfant d'une même fratrie, en une colonne. */
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

/** Numéros Sosa des ancêtres de la personne centrale (le plus petit en cas d'implexe). */
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

export function buildFullLayout({ compact = false } = {}) {
  if (!S.people.size) return null;
  K = compact ? COMPACT : STANDARD;
  try {
    return fullLayout();
  } finally {
    K = STANDARD;
  }
}

function fullLayout() {
  const nodes = [];
  const edges = [];
  const marks = [];
  const sosa = sosaMap();

  // Les plus grandes familles d'abord
  const comps = components().map(layoutComponent).sort((a, b) => b.blockOf.size - a.blockOf.size);

  // Barres de filiation : une barre horizontale sous les parents par famille, sur sa propre
  // voie quand elle croiserait celle d'une autre famille
  const lanesAt = [];   // génération des parents -> nombre de voies
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
      // Une pile d'enfants n'a qu'un point d'attache : son trait, à gauche des fiches
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

  // Hauteur de chaque intervalle entre deux générations, selon le nombre de voies,
  // et de chaque ligne, selon sa plus haute pile
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

    // Fiches et unions
    for (const row of c.rows) {
      for (const b of row) {
        b.ids.forEach((id, i) => {
          const s = sosa.get(id);
          nodes.push({ t: 'p', id, x: xOf(id), y: yOf(id), focus: id === S.focus, sosa: s || null });
          // Union avec un conjoint placé plus à gauche dans le même bloc
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

    // Filiation : les voies sont réparties dans l'intervalle, la première en haut
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
