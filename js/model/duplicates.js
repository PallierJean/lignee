/**
 * Doublons probables, et fiche résultant de la fusion de deux personnes.
 * Deux fiches sont comparées si elles partagent un prénom usuel et un nom ; une date
 * ou un sexe contradictoire les écarte, chaque point commun renforce le score.
 */
import { S } from '../state.js';
import { fullDate, yearOf } from '../utils/dates.js';
import { norm } from '../utils/helpers.js';
import { P, partnersOf } from './people.js';

const MIN_SCORE = 3;
const YEAR_MARGIN = 2;

const same = (a, b) => !!norm(a).trim() && norm(a).trim() === norm(b).trim();

/** Compare deux fiches : { score, reasons }, ou null si elles se contredisent. */
function compare(ida, idb) {
  const a = P(ida);
  const b = P(idb);
  if (a.sex !== b.sex && a.sex !== 'U' && b.sex !== 'U' && a.sex && b.sex) return null;
  if ([a.fatherId, a.motherId].includes(idb) || [b.fatherId, b.motherId].includes(ida)) return null;

  let score = 1;
  const reasons = [];
  const hit = (points, reason) => {
    score += points;
    reasons.push(reason);
  };
  if (same(a.given, b.given)) hit(1, 'dup.given');

  for (const [key, reason, points] of [['birthDate', 'dup.birth', 3], ['deathDate', 'dup.death', 3]]) {
    const ya = yearOf(a[key]);
    const yb = yearOf(b[key]);
    if (!ya || !yb) continue;
    if (Math.abs(ya - yb) > YEAR_MARGIN) return null;
    const fa = fullDate(a[key]);
    const fb = fullDate(b[key]);
    if (fa && fb && (fa.m !== fb.m || fa.d !== fb.d) && ya === yb && !same(a[key], b[key])) continue;
    hit(same(a[key], b[key]) ? points : 1, reason);
  }
  if (same(a.birthPlace, b.birthPlace)) hit(1, 'dup.place');

  const sameParent = (a.fatherId && a.fatherId === b.fatherId) || (a.motherId && a.motherId === b.motherId);
  if (sameParent) hit(3, 'dup.parents');
  const partners = new Set(partnersOf(ida).map((x) => x.id));
  if (partnersOf(idb).some((x) => partners.has(x.id))) hit(2, 'dup.partner');
  return { score, reasons };
}

/** Paires probables, les plus sûres d'abord. `ignored` : paires « idA|idB » écartées. */
export function findDuplicates(ignored = new Set()) {
  const buckets = new Map();
  for (const [id, p] of S.people) {
    const first = norm(p.given).trim().split(/\s+/)[0];
    if (!first) continue;
    for (const name of new Set([norm(p.surname).trim(), norm(p.maidenName).trim()])) {
      if (!name) continue;
      const key = first + '|' + name;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(id);
    }
  }
  const pairs = new Map();
  for (const ids of buckets.values()) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = [ids[i], ids[j]].sort();
        const key = a + '|' + b;
        if (pairs.has(key) || ignored.has(key)) continue;
        const found = compare(a, b);
        if (found && found.score >= MIN_SCORE) pairs.set(key, { key, a, b, ...found });
      }
    }
  }
  return [...pairs.values()].sort((x, y) => y.score - x.score);
}

/**
 * Fiche fusionnée : `keep` garde ses champs remplis, `drop` complète les autres.
 * Événements, sources et documents s'ajoutent, sans répéter un événement identique.
 * `unionIds` : anciennes unions de `drop` -> unions conservées (pour les sources).
 */
export function mergedData(keep, drop, unionIds = new Map()) {
  const out = { ...keep };
  for (const [key, value] of Object.entries(drop)) {
    if (['createdAt', 'updatedAt', 'notes', 'events', 'sources', 'media', 'example'].includes(key)) continue;
    if (out[key] === undefined || out[key] === null || out[key] === '') out[key] = value;
  }
  out.deceased = !!(keep.deceased || drop.deceased);
  out.notes = [...new Set([keep.notes, drop.notes].map((x) => String(x || '').trim()).filter(Boolean))].join('\n\n');
  const eventKey = (e) => [e.type, e.date, e.place].map((x) => norm(x).trim()).join('|');
  const events = [...(keep.events || [])];
  const eventIds = new Map();
  for (const e of drop.events || []) {
    const twin = events.find((x) => eventKey(x) === eventKey(e));
    if (twin) eventIds.set(e.id, twin.id);
    else events.push(e);
  }
  const fact = (f) => {
    const union = String(f || '').startsWith('union:') && unionIds.get(f.slice(6));
    return union ? 'union:' + union : eventIds.get(f) || f;
  };
  const sources = [...(keep.sources || []), ...(drop.sources || []).map((s) => ({ ...s, fact: fact(s.fact) }))];
  const media = [...(keep.media || []), ...(drop.media || [])];
  for (const [key, list] of [['events', events], ['sources', sources], ['media', media]]) {
    if (list.length) out[key] = list;
    else delete out[key];
  }
  return out;
}
