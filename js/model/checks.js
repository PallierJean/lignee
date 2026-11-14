/**
 * Consistency check: what cannot be true (errors) or is very
 * unlikely (to check). Imprecise dates are only flagged if the inconsistency
 * is certain; free-text dates are not checked.
 *
 * An issue: { code, level: 'error' | 'warn', ids, n }; `ids`: people involved,
 * the main one first; `n`: age or date cited. Texts in i18n.js ("chk.<code>").
 */
import { S } from '../state.js';
import { dateBounds, isImpossibleDate, yearsBetween, tidyDate } from '../utils/dates.js';
import { norm } from '../utils/helpers.js';
import { P, eventsOf, isDead, partnersOf, childrenOf, birthSurname, dataVersion } from './people.js';
import { placeUses, parsePlace } from './places.js';
import { placeDepartmentIssue, departmentsText, communesLoaded } from './communes.js';
import { t, getLang } from '../i18n.js';

const MIN_PARENT = 12;   // minimum age of a parent or at a union
const MAX_MOTHER = 55;   // age at a child's birth
const MAX_FATHER = 80;
const MAX_AGE = 120;     // age at death
const MAX_LIVING = 110;  // age of a person with no known death
const MIN_TWO_GENS = 34; // minimum gap between a grandparent and their grandchild
const POSTHUMOUS = 10000; // a father can die up to a year (yyyymmdd) before the birth

// Events normally after death, or with no expected date relative to it
const AFTER_DEATH = new Set(['burial', 'cremation', 'will', 'other']);
const BURIALS = new Set(['burial', 'cremation']);
// Situations that assume a recorded union ("in a couple" may refer to a spouse not in the tree)
const WITH_UNION = new Set(['married', 'remarried', 'pacs', 'separated', 'divorced', 'widowed']);

/** Name for comparison: no case, accents, spaces or hyphens. */
const nameKey = (s) => norm(s).replace(/[^a-z]/g, '');

/** Birth surname, if known: for a married woman with no maiden name, the surname borne may be the husband's. */
function birthName(id) {
  const p = P(id);
  if (p.sex === 'F' && p.maidenName) return p.maidenName;
  if (p.sex === 'F' && partnersOf(id).length) return '';
  return p.surname || '';
}

/** Loops in parentage links: a person who would be their own ancestor. */
export function findCycles() {
  const done = new Set();
  const cycles = [];
  const walk = (id, path, onPath) => {
    if (done.has(id)) return;
    if (onPath.has(id)) {
      cycles.push(path.slice(path.indexOf(id)));
      return;
    }
    onPath.add(id);
    path.push(id);
    const p = S.people.get(id);
    for (const parent of new Set([p.fatherId, p.motherId])) {
      if (parent && S.people.has(parent)) walk(parent, path, onPath);
    }
    path.pop();
    onPath.delete(id);
    done.add(id);
  };
  for (const id of S.people.keys()) walk(id, [], new Set());
  return cycles;
}

// Last result of findIssues(), with what it depends on: the page asks for it on every render
let cached = { key: [], issues: [] };

/**
 * Issues of the open tree, as findIssues(), kept until the data, the day, the language or the
 * commune list change: the panel's badge needs it on every render (a click, a zoom…).
 */
export function currentIssues(now = new Date()) {
  const key = [S.people, S.unions, dataVersion(), now.toDateString(), getLang(), communesLoaded()];
  if (key.length !== cached.key.length || key.some((k, i) => k !== cached.key[i])) cached = { key, issues: findIssues(now) };
  return cached.issues;
}

export function findIssues(now = new Date()) {
  const out = [];
  const add = (code, level, ids, n) => out.push({ code, level, ids, n });
  const today = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();

  for (const ids of findCycles()) add('cycle', 'error', ids);

  for (const [id, p] of S.people) {
    const birth = dateBounds(p.birthDate);
    const death = dateBounds(p.deathDate);
    const events = eventsOf(p);

    for (const date of [p.birthDate, p.deathDate, p.situationDate, ...events.map((e) => e.date)]) {
      if (isImpossibleDate(date)) add('badDate', 'error', [id], date);
      const b = dateBounds(date);
      if (b && b.lo > today) add('future', 'error', [id], date);
    }

    if (birth && death) {
      if (death.hi < birth.lo) add('deathBeforeBirth', 'error', [id]);
      else if (yearsBetween(birth.hi, death.lo) > MAX_AGE) add('tooOld', 'warn', [id], yearsBetween(birth.hi, death.lo));
    }

    for (const [key, maxAge, grace] of [['fatherId', MAX_FATHER, POSTHUMOUS], ['motherId', MAX_MOTHER, 0]]) {
      const parent = P(p[key]);
      if (!parent || p[key] === id) continue;
      const pb = dateBounds(parent.birthDate);
      const pd = dateBounds(parent.deathDate);
      if (birth && pb) {
        if (birth.hi < pb.lo) add('parentYounger', 'error', [id, p[key]]);
        else if (yearsBetween(pb.lo, birth.hi) < MIN_PARENT) add('parentTooYoung', 'error', [id, p[key]], yearsBetween(pb.lo, birth.hi));
        else if (yearsBetween(pb.hi, birth.lo) > maxAge) add('parentTooOld', 'warn', [id, p[key]], yearsBetween(pb.hi, birth.lo));
      }
      if (birth && pd && birth.lo > pd.hi + grace) add('bornAfterDeath', 'error', [id, p[key]]);
      if (parent.sex === (key === 'fatherId' ? 'F' : 'M')) add(key === 'fatherId' ? 'fatherSex' : 'motherSex', 'error', [id, p[key]]);
      // Two generations: grandparent and grandchild
      for (const gkey of ['fatherId', 'motherId']) {
        const g = P(parent[gkey]);
        const gb = g && parent[gkey] !== id && dateBounds(g.birthDate);
        if (birth && gb && yearsBetween(gb.lo, birth.hi) >= 0 && yearsBetween(gb.lo, birth.hi) < MIN_TWO_GENS) {
          add('twoGensTooClose', 'warn', [id, parent[gkey], p[key]], yearsBetween(gb.lo, birth.hi));
        }
      }
    }

    // A single known parent, whose only spouse could be the other one
    for (const [key, missing, sex] of [['fatherId', 'motherId', 'M'], ['motherId', 'fatherId', 'F']]) {
      if (!P(p[key]) || p[missing]) continue;
      const partners = partnersOf(p[key]);
      const other = partners.length === 1 && P(partners[0].id);
      if (!other || partners[0].id === id || other.sex === sex) continue;
      const ob = dateBounds(other.birthDate);
      if (birth && ob && ob.lo > birth.hi) continue;
      add(missing === 'motherId' ? 'motherMissing' : 'fatherMissing', 'warn', [id, partners[0].id, p[key]]);
    }

    if (WITH_UNION.has(p.situation) && !partnersOf(id).length) add('situationNoUnion', 'warn', [id]);

    // Person with no known death: from their birth, or failing that their first child's
    if (!isDead(p)) {
      const kids = childrenOf(id).map((c) => dateBounds(P(c).birthDate)).filter(Boolean);
      const age = birth ? yearsBetween(birth.hi, today)
        : kids.length ? yearsBetween(Math.min(...kids.map((k) => k.hi)), today) + MIN_PARENT : 0;
      if (age > MAX_LIVING) add('livingTooOld', 'warn', [id], age);
    }

    const father = P(p.fatherId);
    if (father && father.sex !== 'F' && p.fatherId !== id) {
      // The father's surname, or the father's and mother's double surname, in either order
      const own = nameKey(birthName(id));
      const his = nameKey(father.surname);
      // Mother's birth surname: entered, otherwise her own father's
      const mother = P(p.motherId);
      const hers = mother ? nameKey(birthName(p.motherId) || birthSurname(mother.fatherId, mother.motherId)) : '';
      const both = hers ? [his + hers, hers + his] : [];
      if (own && his && own !== his && !both.includes(own)) add('nameNotFather', 'warn', [id, p.fatherId], birthName(id));
    }

    for (const e of events) {
      const b = dateBounds(e.date);
      if (!b) continue;
      if (birth && b.hi < birth.lo) add('eventBeforeBirth', 'error', [id], e);
      if (death && b.lo > death.hi && !AFTER_DEATH.has(e.type)) add('eventAfterDeath', 'error', [id], e);
      if (death && b.hi < death.lo && BURIALS.has(e.type)) add('burialBeforeDeath', 'error', [id], e);
    }
  }

  for (const u of S.unions.values()) {
    if (!S.people.has(u.a) || !S.people.has(u.b)) continue;
    if (isImpossibleDate(u.date)) add('badDate', 'error', [u.a, u.b], u.date);
    const date = dateBounds(u.date);
    const end = dateBounds(u.endDate);
    if (isImpossibleDate(u.endDate)) add('badDate', 'error', [u.a, u.b], u.endDate);
    if (date && end && end.hi < date.lo) add('unionEndBeforeStart', 'error', [u.a, u.b]);
    if (!date) continue;
    if (date.lo > today) add('future', 'error', [u.a, u.b], u.date);
    for (const [id, other] of [[u.a, u.b], [u.b, u.a]]) {
      const birth = dateBounds(P(id).birthDate);
      const death = dateBounds(P(id).deathDate);
      if (birth && date.hi < birth.lo) add('unionBeforeBirth', 'error', [id, other]);
      else if (birth && yearsBetween(birth.lo, date.hi) < MIN_PARENT) add('unionTooYoung', 'warn', [id, other], yearsBetween(birth.lo, date.hi));
      if (death && date.lo > death.hi) add('unionAfterDeath', 'error', [id, other]);
    }
  }

  // Places: the department must be the city's (commune list loaded)
  for (const u of placeUses()) {
    const issue = placeDepartmentIssue(u.name);
    if (issue) add('placeDept', 'warn', [...u.ids].slice(0, 1), t('chk.placeDeptDetail', u.name, parsePlace(u.name).city, departmentsText(issue.expected), u.n));
  }

  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
}

/**
 * Dates not written as the others ("4 jUIllet 1961", "4/7/1961", "juilet 1961"): the writes that
 * put them right, [{ collection, id, patch }], for the people, their events, unions and pictures.
 */
export function datePatches() {
  const out = [];
  const fix = (record, keys) => {
    const patch = {};
    for (const k of keys) {
      const v = record[k];
      if (typeof v === 'string' && v.trim() && tidyDate(v) !== v) patch[k] = tidyDate(v);
    }
    return patch;
  };
  for (const [id, p] of S.people) {
    const patch = fix(p, ['birthDate', 'deathDate', 'situationDate']);
    const events = eventsOf(p);
    if (events.some((e) => Object.keys(fix(e, ['date'])).length)) patch.events = events.map((e) => ({ ...e, ...fix(e, ['date']) }));
    if (Object.keys(patch).length) out.push({ collection: 'people', id, patch });
  }
  for (const [id, u] of S.unions) {
    const patch = fix(u, ['date', 'endDate']);
    if (Object.keys(patch).length) out.push({ collection: 'unions', id, patch });
  }
  for (const [id, m] of S.media || []) {
    const patch = fix(m, ['date']);
    if (Object.keys(patch).length) out.push({ collection: 'media', id, patch });
  }
  return out;
}
