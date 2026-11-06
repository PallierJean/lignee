/**
 * Matching against INSEE's death file (deaths in France since 1970),
 * queried by server.js at matchID. This module makes no network call: it says whom to
 * check and with what (inseeQuery), picks the matching certificate (matchDeath) and lists
 * the differences with the record (deathDifferences).
 *
 * A certificate: { first: [given names], last, sex, birthDate: 'yyyymmdd', birth: { city, dept, country },
 *                  deathDate: 'yyyymmdd', death: { city, dept, country }, certificate }
 */
import { S } from '../state.js';
import { P, isDead, partnersOf, childrenOf, sourcesOf } from './people.js';
import { dateParts, dateBounds, yearOf } from '../utils/dates.js';
import { norm, rid } from '../utils/helpers.js';
import { DICT } from '../i18n.js';
import { parsePlace, formatPlace } from './places.js';
import { isFrance } from './countries.js';
import { ACCENTED_FIRST_NAMES } from './first-names.js';

export const INSEE_FROM = 1970;  // first deaths in the file
const OLDEST_BIRTH = 1870;        // born before: died before 1970, barring exceptions
const LIVING_AGE = 75;            // a person marked alive is only checked from this age
const ERA = 15;                   // tolerated gap between an estimated birth and the certificate's

/** Words of a name, lowercase without accents: "Marie-Hélène" -> ['marie', 'helene']. */
const words = (s) => norm(s).replace(/[^a-z]+/g, ' ').trim().split(' ').filter(Boolean);

/** Comparable city: no leading article, "saint" written in full, no spaces. */
function cityKey(s) {
  const w = words(s);
  if (['le', 'la', 'les', 'l'].includes(w[0]) && w.length > 1) w.shift();
  return w.map((x) => (x === 'st' ? 'saint' : x === 'ste' ? 'sainte' : x)).join('');
}
const sameCity = (a, b) => !!a && !!b && cityKey(a) === cityKey(b);

/** Birth surname: a woman's maiden name, otherwise the surname. */
const birthName = (p) => String((p.sex === 'F' && p.maidenName) || p.surname || p.maidenName || '').trim();

/** INSEE word (capitals, no accents) in lowercase: "HELENE" -> "Helene", "D'ARC" -> "d'Arc". */
const PARTICLES = new Set(['de', 'du', 'des', 'la', 'le', 'van', 'von']);
const capital = (w) => w.toLowerCase().replace(/(^|[-'])(\p{L})/gu, (m, sep, c) => sep + c.toUpperCase())
  .replace(/^D'/, "d'");

const key = (w) => words(w).join('');
const LISTED = new Map(ACCENTED_FIRST_NAMES.map((n) => [key(n), n]));

/** Accented words of the tree's `fields`: "helene" -> "Hélène" (compound words, part by part). */
function treeSpellings(fields) {
  const out = new Map();
  for (const p of S.people.values()) {
    for (const f of fields) {
      for (const w of String(p[f] || '').replace(/\(.*?\)/g, ' ').split(/[\s-]+/)) {
        if (/[^\x00-\x7F]/.test(w) && /\p{L}/u.test(w) && !out.has(key(w))) out.set(key(w), w);
      }
    }
  }
  return out;
}

/**
 * INSEE word with its accents: written as in the tree if it appears there accented, otherwise
 * (`listed`) as in the list of accented first names, otherwise without accents.
 */
const accented = (w, spellings, listed) => w.split('-')
  .map((x) => spellings.get(key(x)) || (listed && LISTED.get(key(x))) || capital(x)).join('-');

/** INSEE surname: particles in lowercase, accents taken from the tree's surnames. */
const nameText = (s, spellings = new Map()) => String(s).trim().split(/\s+/)
  .map((w, i) => (i && PARTICLES.has(w.toLowerCase()) ? w.toLowerCase() : accented(w, spellings, false))).join(' ');

/**
 * Civil-registry first names, in their order, written as in the record when it already has them;
 * the others get their accents back (INSEE strips them), see accented:
 * "Marie-Hélène" and MARIE HELENE JEANNE -> "Marie-Hélène Jeanne", MARGUERITE HELENE -> "Marguerite Hélène".
 * The record's first names missing from the certificate follow, then a nickname in brackets.
 */
function mergedGiven(tree, official, spellings = new Map()) {
  const nick = (String(tree || '').match(/\(.*?\)/g) || []).join(' ');
  const tokens = String(tree || '').replace(/\(.*?\)/g, ' ').split(/\s+/).filter(Boolean).map((x) => ({ x, w: words(x) }));
  const parts = official.split(/\s+/).filter(Boolean);
  const w = parts.map((x) => words(x).join(' '));
  const out = [];
  const used = new Set();
  for (let i = 0; i < w.length;) {
    const t = tokens.find((k) => !used.has(k) && k.w.length && k.w.join(' ') === w.slice(i, i + k.w.length).join(' '));
    if (t) used.add(t);
    out.push(t ? t.x : accented(parts[i], spellings, true));
    i += t ? t.w.length : 1;
  }
  // The record's first names missing from the certificate (name in use…): kept after
  return [...out, ...tokens.filter((k) => !used.has(k)).map((k) => k.x), nick].filter(Boolean).join(' ');
}

/** Where the birth surname goes: a woman's maiden name (the married name stays), otherwise the surname. */
const birthField = (p) => (p.sex === 'F' && (p.maidenName || p.surname) ? 'maidenName' : 'surname');

/** First usual given name, compounds included: "Jean-Baptiste Louis" -> "Jean-Baptiste". */
function firstGiven(p) {
  const w = String(p.given || '').replace(/\(.*?\)/g, ' ').split(/[\s,]+/).find((x) => /\p{L}/u.test(x));
  return w ? w.replace(/[^\p{L}'-]/gu, '') : '';
}

/** Certificate date (yyyymmdd) -> { y, m, d }, 0 for an unknown part; null if missing. */
function actDate(s) {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(s || ''));
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
}

// Months in French, as they are typed: "12 Décembre 1972"
const MONTHS = DICT.fr.months.map((m) => m.charAt(0).toUpperCase() + m.slice(1));

/** "12 Décembre 1972", the form stored in the record when a date is reported from the certificate. */
export function actDateText(s) {
  const a = actDate(s);
  if (!a) return '';
  if (!a.m) return String(a.y);
  return (a.d ? String(a.d).padStart(2, '0') + ' ' : '') + MONTHS[a.m - 1] + ' ' + a.y;
}

/** true if the record's date and the certificate's agree, false if they contradict, null otherwise. */
function sameDate(text, act) {
  const a = actDate(act);
  const b = dateBounds(text);
  if (!a || !b) return null;
  const lo = a.y * 10000 + (a.m || 1) * 100 + (a.d || 1);
  const hi = a.y * 10000 + (a.m || 12) * 100 + (a.d || 31);
  return hi >= b.lo && lo <= b.hi;
}

/** The record's date, complete and exact (day, month, year). */
const exactDate = (text) => {
  const p = dateParts(text);
  return !!(p && !p.q && p.d);
};

/** Known birth year, otherwise estimated from the death, a spouse, the children or the parents. */
export function estimatedBirth(id) {
  const p = P(id);
  const y = (x) => (x ? yearOf(x.birthDate) : null);
  if (y(p)) return y(p);
  if (yearOf(p.deathDate)) return yearOf(p.deathDate) - 70;
  for (const { id: other, uid } of partnersOf(id)) {
    if (y(P(other))) return y(P(other));
    const u = uid && S.unions.get(uid);
    if (u && yearOf(u.date)) return yearOf(u.date) - 25;
  }
  const kids = childrenOf(id).map((k) => y(P(k))).filter(Boolean);
  if (kids.length) return Math.min(...kids) - 28;
  const parents = [p.fatherId, p.motherId].map((k) => y(P(k))).filter(Boolean);
  return parents.length ? Math.max(...parents) + 28 : null;
}

/**
 * What is sent to matchID for this person: { lastName, firstName, sex?, birthDate? },
 * or null if they are not to be checked: died before 1970, born before 1870, or alive and
 * under 75 (or of unknown age) — younger living people are never sent.
 */
export function inseeQuery(id, year = new Date().getFullYear()) {
  const p = P(id);
  if (!p) return null;
  const lastName = birthName(p).replace(/[^\p{L}' -]/gu, ' ').replace(/\s+/g, ' ').trim();
  const firstName = firstGiven(p);
  if (!lastName || !firstName) return null;
  const born = yearOf(p.birthDate);
  const died = yearOf(p.deathDate);
  if (died && died < INSEE_FROM) return null;
  if (!isDead(p) && !(born && year - born >= LIVING_AGE)) return null;
  const era = born || estimatedBirth(id);
  if (!died && era && era < OLDEST_BIRTH) return null;
  const q = { lastName, firstName };
  if (p.sex === 'M' || p.sex === 'F') q.sex = p.sex;
  const d = dateParts(p.birthDate);
  if (d && !d.q && d.d) q.birthDate = [d.d, d.m].map((x) => String(x).padStart(2, '0')).join('/') + '/' + d.y;
  else if (d) q.birthDate = `${d.y - (d.q ? 5 : 1)}-${d.y + (d.q ? 5 : 1)}`;
  return q;
}

/** Fingerprint of the question asked: a record is checked again when it changes. */
export const inseeSignature = (q) => (q ? [q.lastName, q.firstName, q.sex || '', q.birthDate || ''].join('|') : '');

/** Certificates that may be this person: same sex, same first given name, compatible birth. */
export function candidates(id, acts) {
  const p = P(id);
  const first = words(firstGiven(p));
  const born = yearOf(p.birthDate) ? null : estimatedBirth(id);
  return acts.filter((a) => {
    if ((p.sex === 'M' || p.sex === 'F') && a.sex && a.sex !== p.sex) return false;
    const names = words(a.first.join(' '));
    if (!names.some((_, i) => first.every((w, k) => names[i + k] === w))) return false;
    if (sameDate(p.birthDate, a.birthDate) === false) return false;
    const y = actDate(a.birthDate);
    return !(born && y && Math.abs(y.y - born) > ERA);
  });
}

/** Points of agreement of a certificate with the record, and what agrees. */
function score(p, a) {
  let n = 0;
  const why = [];
  if (sameDate(p.birthDate, a.birthDate)) {
    const d = dateParts(p.birthDate);
    n += d.d ? 3 : d.m ? 2 : 1;
    why.push('birth');
  }
  if (sameCity(parsePlace(p.birthPlace).city, a.birth.city)) {
    n += 2;
    why.push('birthPlace');
  }
  const sd = sameDate(p.deathDate, a.deathDate);
  if (sd) {
    n += 2;
    why.push('death');
  }
  if (sameCity(parsePlace(p.deathPlace).city, a.death.city)) {
    n += 1;
    why.push('deathPlace');
  }
  return { n: sd === false && !exactDate(p.birthDate) ? n - 2 : n, why };
}

/**
 * Certificate chosen for the person: { act, level, others } or null. level is 'sure' (identical
 * exact birth, no namesake), 'likely' (matching birth or death, no namesake as good)
 * or 'lead' (only the surname and first name really match).
 */
export function matchDeath(id, acts) {
  const p = P(id);
  if (!p) return null;
  const list = candidates(id, acts).map((act) => ({ act, ...score(p, act) })).sort((a, b) => b.n - a.n);
  if (!list.length) return null;
  const [best, next] = list;
  const unique = !next || next.n < best.n;
  const others = list.length - 1;
  if (unique && best.why.includes('birth') && exactDate(p.birthDate)) return { act: best.act, level: 'sure', others };
  if (unique && best.n >= 3 && (best.why.includes('birth') || best.why.includes('death'))) return { act: best.act, level: 'likely', others };
  if (best.n >= 2 || list.length <= 3) return { act: best.act, level: 'lead', others };
  return null;
}

/** A certificate's place, written like the tree's: "Tulle (19)", "Fribourg, Allemagne". */
export const actPlace = (l) => formatPlace({ city: l.city, dept: isFrance(l.country) ? l.dept : '', country: l.country });
const placeText = actPlace;

/**
 * Differences between the record and the certificate: [{ field, kind, tree, insee, patch? }]. kind is 'fix' (the
 * record contradicts the certificate) or 'add' (the certificate completes the record); patch is what is reported
 * into the record with a click. INSEE writes names without accents: first names already in the record
 * keep their spelling, the birth surname is written in lowercase (to be accented if needed).
 */
export function deathDifferences(id, act) {
  const p = P(id);
  const out = [];
  const add = (field, kind, tree, insee, patch) => out.push({ field, kind, tree: String(tree || ''), insee, ...(patch ? { patch } : {}) });

  const given = words(String(p.given || '').replace(/\(.*?\)/g, ' ')); // without the nickname in brackets
  const official = mergedGiven(p.given, act.first.join(' '), treeSpellings(['given']));
  if (words(act.first.join(' ')).some((w) => !given.includes(w))) add('given', 'add', p.given, official, { given: official });
  if (words(act.last).join(' ') !== words(birthName(p)).join(' ')) {
    const last = nameText(act.last, treeSpellings(['surname', 'maidenName']));
    add('name', 'fix', birthName(p), last, { [birthField(p)]: last });
  }

  for (const [field, place, date, which] of [['birth', 'birthPlace', 'birthDate', 'birth'], ['death', 'deathPlace', 'deathDate', 'death']]) {
    const text = actDateText(act[date]);
    const s = sameDate(p[date], act[date]);
    const extra = field === 'death' ? { deceased: true } : {};
    if (s === false) add(date, 'fix', p[date], text, { [date]: text, ...extra });
    else if (text && !exactDate(p[date]) && actDate(act[date]).d) add(date, 'add', p[date], text, { [date]: text, ...extra });
    const loc = act[which];
    const city = parsePlace(p[place]).city;
    if (!loc.city && !loc.country) continue;
    if (!city) add(place, 'add', p[place], placeText(loc), loc.city ? { [place]: placeText(loc) } : null);
    else if (loc.city && !sameCity(city, loc.city)) add(place, 'fix', p[place], placeText(loc), { [place]: placeText(loc) });
  }
  if (!isDead(p)) add('deceased', 'fix', '', '', { deceased: true });

  // Death certificate number: a source of the record, unless it already cites it
  const number = String(act.certificate || '').trim();
  // Cited if its words follow each other: "1094 N" in "Acte n°1094 N", but not "12" in "Acte n°123"
  const tokens = (x) => norm(x).match(/[a-z0-9]+/g) || [];
  const wanted = tokens(number);
  const cited = (s) => s.kind === 'death' && tokens(`${s.title} ${s.ref}`)
    .some((x, i, all) => wanted.every((w, k) => all[i + k] === w));
  if (number && !sourcesOf(p).some(cited)) {
    const source = {
      id: rid('s'), kind: 'death', fact: 'death', title: `Acte n°${number}`, place: act.death.city ? placeText(act.death) : '',
      ref: '', note: 'Fichier des personnes décédées de l’INSEE (matchID)', photo: '',
    };
    add('source', 'add', '', [source.title, source.place].filter(Boolean).join(', '), { sources: [...sourcesOf(p), source] });
  }
  return out;
}
