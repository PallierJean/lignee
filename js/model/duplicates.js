/**
 * Likely duplicates, and the record resulting from merging two people.
 * Two records are compared if they share a usual first name and a surname; a conflicting
 * date or sex rules them out, each point in common raises the score.
 */
import { S } from '../state.js';
import { fullDate, yearOf } from '../utils/dates.js';
import { norm } from '../utils/helpers.js';
import { P, partnersOf, sourcesOf } from './people.js';
import { sourcesOfPerson } from './sources.js';

const MIN_SCORE = 3;
const YEAR_MARGIN = 2;

const same = (a, b) => !!norm(a).trim() && norm(a).trim() === norm(b).trim();

/** Compares two records: { score, reasons }, or null if they contradict each other. */
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

/** Likely pairs, the surest first. `ignored`: dismissed "idA|idB" pairs. */
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
 * Merged record: `keep` keeps its filled fields, `drop` fills in the others.
 * Events, sources and documents are added, without repeating an identical event.
 * `unionIds`: former unions of `drop` -> kept unions (for the sources).
 */
export function mergedData(keep, drop, unionIds = new Map(), ids = {}) {
  const out = { ...keep };
  for (const [key, value] of Object.entries(drop)) {
    if (['createdAt', 'updatedAt', 'notes', 'events', 'sources', 'citations', 'media', 'example'].includes(key)) continue;
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
  // Documents as the form has them (shared sources resolved): saving turns them back into citations
  // With the ids, the unions' marriage documents come too, and follow the union kept; `keepDocs`
  // and `dropDocs`: the documents read before the unions changed
  const all = (p, docs, id) => docs || (id ? sourcesOfPerson(id) : sourcesOf(p));
  const sources = [...all(keep, ids.keepDocs, ids.keep), ...all(drop, ids.dropDocs, ids.drop).map((s) => ({ ...s, fact: fact(s.fact) }))];
  // The gallery is apart (model/media.js): the identifications are moved by the merge itself
  if (events.length) out.events = events;
  else delete out.events;
  delete out.media;
  delete out.citations;
  out.sources = sources;
  return out;
}
