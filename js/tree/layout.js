/**
 * Calcul de la mise en page de l'arbre autour de la personne centrale.
 *
 * - Ascendants au-dessus, en arbre binaire (père à gauche, mère à droite),
 *   numérotés selon le système Sosa (personne centrale = 1, père = 2n, mère = 2n + 1).
 *   Les autres conjoints d'un ancêtre (remariage, veuvage…) sont rattachés à côté de lui,
 *   vers l'extérieur : à gauche d'un père, à droite d'une mère. Ils n'ont pas de numéro Sosa.
 * - Descendants en dessous : chaque personne avec tous ses conjoints (le premier à droite, le
 *   second à gauche, les suivants au-delà du premier, reliés par un arc au-dessus des fiches)
 *   et les enfants regroupés sous le bon couple.
 * - Frères et sœurs de la personne centrale sur sa ligne, à sa gauche, reliés à ses parents.
 * - Emplacements vides « Ajouter le père / la mère / un conjoint / un enfant » près de la personne centrale,
 *   et « Ajouter un frère ou une sœur » à gauche de la fratrie quand un de ses parents est connu.
 *
 * Renvoie { nodes, edges, marks, W, H } en coordonnées non zoomées.
 */
import { CW, CH, HG, VG, SG, PAD } from '../config.js';
import { S } from '../state.js';
import { P, partnersOf, childrenOf, siblingsOf } from '../model/people.js';

const ARC = 16;  // hauteur de l'arc qui relie une personne à ses conjoints suivants
const LANE = 9;  // écart entre les barres d'enfants de deux unions

export function buildLayout() {
  const focus = S.focus;
  if (!focus || !S.people.has(focus)) return null;

  const nodes = [];  // fiches : { t: 'p', id, x, y, focus?, sosa?, partnerOf? } ou { t: 'ph', key, rel, of, x, y }
  const edges = [];  // traits : { d: chemin SVG, dash }
  const marks = [];  // symboles d'union « × » : { x, y, dash }
  const rowH = CH + VG;
  let maxGen = 0;
  let maxDepth = 0;

  /* ---------- 1. Mesure des ascendants (largeur de chaque sous-arbre) ---------- */
  // side : côté des autres conjoints ('L' pour un père, 'R' pour une mère).
  // coParent : l'autre parent de l'enfant, déjà affiché, donc exclu des autres conjoints.
  // c : position de l'axe de la fiche depuis le bord gauche du sous-arbre.
  function measureAncestors(id, gen, side, coParent) {
    const p = P(id);
    const n = { id, gen, side, w: CW, c: CW / 2, f: null, m: null, extra: [] };
    if (gen > maxGen) maxGen = gen;
    if (gen > 0) n.extra = partnersOf(id).filter((x) => x.id !== coParent);
    let parentsW = 0;
    if (gen < S.up) {
      const make = (parentId, rel, otherId) => {
        if (parentId && S.people.has(parentId)) {
          return measureAncestors(parentId, gen + 1, rel === 'father' ? 'L' : 'R', otherId);
        }
        if (S.canWrite && gen <= 1) {
          if (gen + 1 > maxGen) maxGen = gen + 1;
          return { ph: rel, of: id, gen: gen + 1, w: CW, c: CW / 2 };
        }
        return null;
      };
      n.f = make(p.fatherId, 'father', p.motherId);
      n.m = make(p.motherId, 'mother', p.fatherId);
      const parents = [n.f, n.m].filter(Boolean);
      if (parents.length) parentsW = parents.reduce((sum, x) => sum + x.w, 0) + HG * (parents.length - 1);
    }
    const extraW = n.extra.length * (SG + CW);
    const leftW = Math.max(CW / 2, parentsW / 2, side === 'L' ? CW / 2 + extraW : 0);
    const rightW = Math.max(CW / 2, parentsW / 2, side === 'R' ? CW / 2 + extraW : 0);
    n.c = leftW;
    n.w = leftW + rightW;
    return n;
  }

  /* ---------- 2. Mesure des descendants ---------- */
  const seen = new Set([focus]);
  function measureDescendants(id, depth) {
    const partners = partnersOf(id);
    const R = partners[0] || null;  // conjoint à droite
    const L = partners[1] || null;  // second conjoint, à gauche
    const extra = partners.slice(2); // conjoints suivants, à droite du premier
    // Sans conjoint, la personne centrale reçoit un emplacement « Ajouter un conjoint » à droite
    const phR = depth === 0 && S.canWrite && !R;
    const unitW = CW + (R || phR ? SG + CW : 0) + (L ? SG + CW : 0) + extra.length * (SG + CW);
    const pL = L ? CW + SG : 0;     // décalage de la personne quand un conjoint est à gauche
    const kids = [];

    if (depth < S.down) {
      const groups = { L: [], C: [], R: [] };
      extra.forEach((_, i) => { groups['X' + i] = []; });
      for (const k of childrenOf(id)) {
        if (seen.has(k)) continue;
        seen.add(k);
        const c = P(k);
        const other = c.fatherId === id ? c.motherId : c.fatherId;
        const x = extra.findIndex((pt) => pt.id === other);
        const g = x >= 0 ? 'X' + x : L && other === L.id ? 'L' : R && other === R.id ? 'R' : 'C';
        groups[g].push(k);
      }
      for (const g of Object.keys(groups)) {
        for (const k of groups[g]) kids.push({ g, n: measureDescendants(k, depth + 1) });
      }
      if (depth === 0 && S.canWrite) kids.push({ g: R ? 'R' : 'C', n: { ph: 'child', of: id, w: CW, depth: 1 } });
    }

    const kidsW = kids.reduce((sum, o) => sum + o.n.w, 0) + HG * Math.max(0, kids.length - 1);
    // Points d'attache des enfants : sous le couple de droite, de gauche, ou sous la personne seule
    const jR = pL + CW + SG / 2;
    const jL = pL - SG / 2;
    const jC = pL + CW / 2;
    const jX = extra.map((_, i) => pL + (i + 2) * (CW + SG) + CW / 2); // sous chaque conjoint suivant
    const used = new Set(kids.map((o) => o.g));
    let anchor = jC;
    if (used.size === 1) {
      const g = [...used][0];
      anchor = g === 'R' ? jR : g === 'L' ? jL : g[0] === 'X' ? jX[+g.slice(1)] : jC;
    }
    const kl = kids.length ? anchor - kidsW / 2 : 0;
    const minL = Math.min(0, kl);
    const maxR = Math.max(unitW, kids.length ? kl + kidsW : 0);
    const shift = -minL;
    return {
      id, R, L, extra, phR, pL, depth, kids,
      unitLeft: shift,
      kidsLeft: kl + shift,
      w: maxR - minL,
      jR: jR + shift,
      jL: jL + shift,
      jC: jC + shift,
      jX: jX.map((x) => x + shift),
    };
  }

  const anc = measureAncestors(focus, 0);
  const desc = measureDescendants(focus, 0);
  // Frères et sœurs (hors conjoints déjà affichés), puis l'emplacement « Ajouter un frère ou une sœur »,
  // à gauche de la personne centrale et de ses conjoints, reliés aux parents affichés
  const shown = new Set(partnersOf(focus).map((x) => x.id));
  const sibs = siblingsOf(focus).filter((s) => !shown.has(s.id) && !seen.has(s.id));
  const sibPh = S.canWrite && [anc.f, anc.m].some((x) => x && !x.ph);
  const sibSlots = sibs.length + (sibPh ? 1 : 0);
  const Y0 = PAD + maxGen * rowH;                      // ligne de la personne centrale
  const Fx = PAD + Math.max(anc.c, desc.jC, desc.pL + CW / 2 + sibSlots * (CW + HG)); // axe vertical de la personne centrale
  const ancLeft = Fx - anc.c;
  const descLeft = Fx - desc.jC;

  /* ---------- 3. Placement des ascendants ---------- */
  function placeAncestors(n, left, sosa) {
    const x = left + n.c - CW / 2;
    const y = Y0 - n.gen * rowH;
    if (n.gen > 0) {
      if (n.ph) nodes.push({ t: 'ph', key: 'ph:' + n.ph + ':' + n.of, rel: n.ph, of: n.of, x, y });
      else nodes.push({ t: 'p', id: n.id, x, y, sosa });
    }
    if (n.ph) return;

    // Autres conjoints, alignés à côté de l'ancêtre
    const my = y + CH / 2;
    n.extra.forEach((pt, i) => {
      const step = (i + 1) * (SG + CW);
      const sx = n.side === 'L' ? x - step : x + step;
      const gapL = n.side === 'L' ? sx + CW : sx - SG;  // bord gauche de l'espace entre les deux fiches
      nodes.push({ t: 'p', id: pt.id, x: sx, y, partnerOf: n.id });
      edges.push({ d: `M${gapL},${my}H${gapL + SG}`, dash: !pt.uid });
      marks.push({ x: gapL + SG / 2, y: my, dash: !pt.uid });
    });

    const parents = [[n.f, 2 * sosa], [n.m, 2 * sosa + 1]].filter((a) => a[0]);
    if (!parents.length) return;
    const total = parents.reduce((sum, a) => sum + a[0].w, 0) + HG * (parents.length - 1);
    let l = left + n.c - total / 2;
    const cx = x + CW / 2;
    const barY = y - VG / 2;
    const parentY = y - rowH;
    const centers = [];
    for (const [pn, s] of parents) {
      placeAncestors(pn, l, s);
      centers.push({ c: l + pn.c, ph: !!pn.ph });
      l += pn.w + HG;
    }
    const xs = centers.map((c) => c.c);
    const allPlaceholders = centers.every((c) => c.ph);
    edges.push({ d: `M${cx},${y}V${barY}M${Math.min(cx, ...xs)},${barY}H${Math.max(cx, ...xs)}`, dash: allPlaceholders });
    for (const c of centers) edges.push({ d: `M${c.c},${barY}V${parentY + CH}`, dash: c.ph });
  }

  /* ---------- 4. Placement des descendants ---------- */
  function placeDescendants(n, left) {
    const y = Y0 + n.depth * rowH;
    if (n.depth > maxDepth) maxDepth = n.depth;
    if (n.ph) {
      nodes.push({ t: 'ph', key: 'ph:' + n.ph + ':' + n.of, rel: n.ph, of: n.of, x: left, y });
      return;
    }

    const px = left + n.unitLeft + n.pL;
    const my = y + CH / 2;
    nodes.push({ t: 'p', id: n.id, x: px, y, focus: n.depth === 0, sosa: n.depth === 0 ? 1 : null });
    if (n.R) {
      const sx = px + CW + SG;
      nodes.push({ t: 'p', id: n.R.id, x: sx, y });
      edges.push({ d: `M${px + CW},${my}H${sx}`, dash: !n.R.uid });
      marks.push({ x: px + CW + SG / 2, y: my, dash: !n.R.uid });
    } else if (n.phR) {
      const sx = px + CW + SG;
      nodes.push({ t: 'ph', key: 'ph:spouse:' + n.id, rel: 'spouse', of: n.id, x: sx, y });
      edges.push({ d: `M${px + CW},${my}H${sx}`, dash: true });
    }
    if (n.L) {
      const sx = px - SG - CW;
      nodes.push({ t: 'p', id: n.L.id, x: sx, y });
      edges.push({ d: `M${sx + CW},${my}H${px}`, dash: !n.L.uid });
      marks.push({ x: px - SG / 2, y: my, dash: !n.L.uid });
    }
    n.extra.forEach((pt, i) => {
      const sx = px + (i + 2) * (CW + SG);
      const arc = y - ARC - i * 6;
      nodes.push({ t: 'p', id: pt.id, x: sx, y });
      edges.push({ d: `M${px + CW * 0.8},${y}V${arc}H${sx + CW / 2}V${y}`, dash: !pt.uid });
      marks.push({ x: sx + CW / 2 - CW / 4, y: arc, dash: !pt.uid });
    });
    if (!n.kids.length) return;

    let l = left + n.kidsLeft;
    const childTop = y + rowH;
    const groups = {};
    for (const k of n.kids) {
      placeDescendants(k.n, l);
      const center = k.n.ph ? l + CW / 2 : l + k.n.jC;
      (groups[k.g] = groups[k.g] || []).push({ c: center, ph: !!k.n.ph });
      l += k.n.w + HG;
    }
    // Une barre par union, à sa hauteur : on voit de quel couple vient chaque enfant
    const unions = Object.keys(groups);
    unions.forEach((g, i) => {
      const busY = y + CH + VG / 2 + (i - (unions.length - 1) / 2) * LANE;
      const jx = g === 'R' ? left + n.jR : g === 'L' ? left + n.jL : g[0] === 'X' ? left + n.jX[+g.slice(1)] : left + n.jC;
      const startY = g === 'C' || g[0] === 'X' ? y + CH : my;
      const centers = groups[g];
      const xs = centers.map((c) => c.c);
      const allPlaceholders = centers.every((c) => c.ph);
      edges.push({ d: `M${jx},${startY}V${busY}M${Math.min(jx, ...xs)},${busY}H${Math.max(jx, ...xs)}`, dash: allPlaceholders });
      for (const c of centers) edges.push({ d: `M${c.c},${busY}V${childTop}`, dash: c.ph });
    });
  }

  placeAncestors(anc, ancLeft, 1);
  placeDescendants(desc, descLeft);

  // Fratrie : de la plus âgée (à gauche) à la plus jeune (près de la personne centrale)
  const barY = Y0 - VG / 2;
  const slotX = (i) => Fx - CW / 2 - desc.pL - (i + 1) * (CW + HG); // i = 0 : place la plus proche
  sibs.forEach((s, i) => {
    const sx = slotX(sibs.length - 1 - i);
    const sc = sx + CW / 2;
    nodes.push({ t: 'p', id: s.id, x: sx, y: Y0 });
    edges.push({ d: `M${sc},${barY}V${Y0}`, dash: false });
  });
  if (sibs.length) edges.push({ d: `M${Fx},${barY}H${slotX(sibs.length - 1) + CW / 2}`, dash: false });
  if (sibPh) {
    const sx = slotX(sibs.length);
    const sc = sx + CW / 2;
    const from = sibs.length ? slotX(sibs.length - 1) + CW / 2 : Fx;
    nodes.push({ t: 'ph', key: 'ph:sibling:' + focus, rel: 'sibling', of: focus, x: sx, y: Y0 });
    edges.push({ d: `M${from},${barY}H${sc}V${Y0}`, dash: true });
  }

  const W = Math.max(ancLeft + anc.w, descLeft + desc.w) + PAD;
  const H = Y0 + maxDepth * rowH + CH + PAD;
  return { nodes, edges, marks, W, H };
}
