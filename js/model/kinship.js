/**
 * Lien de parenté entre deux personnes.
 *
 * relationship(a, b) renvoie { type, ... } :
 * - 'same' : la même personne ;
 * - 'spouse' : conjoints ;
 * - 'blood' : { da, db, half, ancestors, path } : da et db comptent les générations de a et de b
 *   jusqu'à l'ancêtre commun le plus proche ; ancestors : cet ancêtre, ou le couple ;
 * - 'alliance' : lien par un conjoint : { via, viaSide, blood, path }. viaSide = 'a' : `via` est
 *   conjoint de a et parent de sang de b ; 'b' : conjoint de b et parent de sang de a ;
 * - 'none' : aucun lien trouvé.
 * `path` va de a à b, personne par personne.
 */
import { S } from '../state.js';
import { P, partnersOf } from './people.js';

/** Ancêtres et personne elle-même : id -> { d: générations, from: enfant par lequel on arrive }. */
function ancestors(id) {
  const seen = new Map([[id, { d: 0, from: null }]]);
  const queue = [id];
  while (queue.length) {
    const x = queue.shift();
    const p = P(x);
    for (const parent of [p.fatherId, p.motherId]) {
      if (parent && S.people.has(parent) && !seen.has(parent)) {
        seen.set(parent, { d: seen.get(x).d + 1, from: x });
        queue.push(parent);
      }
    }
  }
  return seen;
}

/** Chemin d'un ancêtre jusqu'à la personne d'où part la table `up`. */
function descent(up, ancestor) {
  const path = [ancestor];
  while (up.get(path[path.length - 1]).from) path.push(up.get(path[path.length - 1]).from);
  return path;
}

const bothParents = (id) => {
  const p = P(id);
  return S.people.has(p.fatherId) && S.people.has(p.motherId);
};

/** Parenté de sang de a et b, ou null. */
function blood(a, b) {
  const up = ancestors(a);
  const down = ancestors(b);
  let best = Infinity;
  let common = [];
  for (const [id, { d }] of up) {
    if (!down.has(id)) continue;
    const sum = d + down.get(id).d;
    if (sum < best) {
      best = sum;
      common = [id];
    } else if (sum === best) common.push(id);
  }
  if (!common.length) return null;

  const first = common[0];
  const da = up.get(first).d;
  const db = down.get(first).d;
  const pair = common.filter((id) => up.get(id).d === da);
  const fromA = descent(up, first);    // ancêtre, ..., a
  const fromB = descent(down, first);  // ancêtre, ..., b
  // Demi-frères : un seul parent commun, alors que les deux parents de chacun sont connus
  const half = da > 0 && db > 0 && pair.length === 1 && bothParents(fromA[1]) && bothParents(fromB[1]);
  return { type: 'blood', da, db, half, ancestors: pair, path: [...fromA.reverse(), ...fromB.slice(1)] };
}

export function relationship(a, b) {
  if (!S.people.has(a) || !S.people.has(b)) return { type: 'none', path: [] };
  if (a === b) return { type: 'same', path: [a] };
  if (partnersOf(a).some((x) => x.id === b)) return { type: 'spouse', path: [a, b] };
  const direct = blood(a, b);
  if (direct) return direct;

  let best = null;
  const consider = (via, viaSide, link, path) => {
    if (link && (!best || link.da + link.db < best.blood.da + best.blood.db)) {
      best = { type: 'alliance', via, viaSide, blood: link, path };
    }
  };
  for (const { id } of partnersOf(a)) {
    const link = blood(id, b);
    consider(id, 'a', link, link && [a, ...link.path]);
  }
  for (const { id } of partnersOf(b)) {
    const link = blood(a, id);
    consider(id, 'b', link, link && [...link.path, b]);
  }
  return best || { type: 'none', path: [] };
}
