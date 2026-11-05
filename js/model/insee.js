/**
 * Rapprochement avec le fichier des décès de l'INSEE (décès survenus en France depuis 1970),
 * interrogé par server.js chez matchID. Ce module ne fait aucun appel réseau : il dit qui
 * vérifier et avec quoi (inseeQuery), choisit l'acte qui correspond (matchDeath) et liste
 * les écarts avec la fiche (deathDifferences).
 *
 * Un acte : { first: [prénoms], last, sex, birthDate: 'aaaammjj', birth: { city, dept, country },
 *             deathDate: 'aaaammjj', death: { city, dept, country }, certificate }
 */
import { S } from '../state.js';
import { P, isDead, partnersOf, childrenOf, sourcesOf } from './people.js';
import { dateParts, dateBounds, yearOf } from '../utils/dates.js';
import { norm, rid } from '../utils/helpers.js';
import { DICT } from '../i18n.js';
import { parsePlace, formatPlace } from './places.js';
import { isFrance } from './countries.js';
import { ACCENTED_FIRST_NAMES } from './first-names.js';

export const INSEE_FROM = 1970;  // premiers décès du fichier
const OLDEST_BIRTH = 1870;        // né avant : mort avant 1970, sauf exception
const LIVING_AGE = 75;            // une personne marquée vivante n'est vérifiée qu'à partir de cet âge
const ERA = 15;                   // écart toléré entre une naissance estimée et celle de l'acte

/** Mots d'un nom, en minuscules sans accents : « Marie-Hélène » -> ['marie', 'helene']. */
const words = (s) => norm(s).replace(/[^a-z]+/g, ' ').trim().split(' ').filter(Boolean);

/** Ville comparable : sans article de tête, « saint » écrit en entier, sans espaces. */
function cityKey(s) {
  const w = words(s);
  if (['le', 'la', 'les', 'l'].includes(w[0]) && w.length > 1) w.shift();
  return w.map((x) => (x === 'st' ? 'saint' : x === 'ste' ? 'sainte' : x)).join('');
}
const sameCity = (a, b) => !!a && !!b && cityKey(a) === cityKey(b);

/** Nom de naissance : nom de jeune fille d'une femme, sinon le nom. */
const birthName = (p) => String((p.sex === 'F' && p.maidenName) || p.surname || p.maidenName || '').trim();

/** Mot de l'INSEE (en capitales, sans accents) en minuscules : « HELENE » -> « Helene », « D'ARC » -> « d'Arc ». */
const PARTICLES = new Set(['de', 'du', 'des', 'la', 'le', 'van', 'von']);
const capital = (w) => w.toLowerCase().replace(/(^|[-'])(\p{L})/gu, (m, sep, c) => sep + c.toUpperCase())
  .replace(/^D'/, "d'");

const key = (w) => words(w).join('');
const LISTED = new Map(ACCENTED_FIRST_NAMES.map((n) => [key(n), n]));

/** Mots accentués des champs `fields` de l'arbre : « helene » -> « Hélène » (les mots composés, partie par partie). */
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
 * Mot de l'INSEE avec ses accents : écrit comme dans l'arbre s'il y figure accentué, sinon
 * (`listed`) comme dans la liste des prénoms accentués, sinon sans accent.
 */
const accented = (w, spellings, listed) => w.split('-')
  .map((x) => spellings.get(key(x)) || (listed && LISTED.get(key(x))) || capital(x)).join('-');

/** Nom de l'INSEE : particules en minuscules, accents repris des noms de l'arbre. */
const nameText = (s, spellings = new Map()) => String(s).trim().split(/\s+/)
  .map((w, i) => (i && PARTICLES.has(w.toLowerCase()) ? w.toLowerCase() : accented(w, spellings, false))).join(' ');

/**
 * Prénoms de l'état civil, dans leur ordre, écrits comme dans la fiche quand elle les a déjà ;
 * les autres reprennent leurs accents (l'INSEE les retire), voir accented :
 * « Marie-Hélène » et MARIE HELENE JEANNE -> « Marie-Hélène Jeanne », MARGUERITE HELENE -> « Marguerite Hélène ».
 * Les prénoms de la fiche absents de l'acte suivent, puis un surnom entre parenthèses.
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
  // Prénoms de la fiche absents de l'acte (prénom d'usage…) : gardés à la suite
  return [...out, ...tokens.filter((k) => !used.has(k)).map((k) => k.x), nick].filter(Boolean).join(' ');
}

/** Où va le nom de naissance : nom de jeune fille d'une femme (le nom d'usage reste), sinon le nom. */
const birthField = (p) => (p.sex === 'F' && (p.maidenName || p.surname) ? 'maidenName' : 'surname');

/** Premier prénom usuel, composé compris : « Jean-Baptiste Louis » -> « Jean-Baptiste ». */
function firstGiven(p) {
  const w = String(p.given || '').replace(/\(.*?\)/g, ' ').split(/[\s,]+/).find((x) => /\p{L}/u.test(x));
  return w ? w.replace(/[^\p{L}'-]/gu, '') : '';
}

/** Date de l'acte (aaaammjj) -> { y, m, d }, 0 pour une partie inconnue ; null si absente. */
function actDate(s) {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(s || ''));
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
}

// Mois en français, comme on les saisit : « 12 Décembre 1972 »
const MONTHS = DICT.fr.months.map((m) => m.charAt(0).toUpperCase() + m.slice(1));

/** « 12 Décembre 1972 », la forme enregistrée dans la fiche quand on reporte une date de l'acte. */
export function actDateText(s) {
  const a = actDate(s);
  if (!a) return '';
  if (!a.m) return String(a.y);
  return (a.d ? String(a.d).padStart(2, '0') + ' ' : '') + MONTHS[a.m - 1] + ' ' + a.y;
}

/** true si la date de la fiche et celle de l'acte concordent, false si elles se contredisent, null sinon. */
function sameDate(text, act) {
  const a = actDate(act);
  const b = dateBounds(text);
  if (!a || !b) return null;
  const lo = a.y * 10000 + (a.m || 1) * 100 + (a.d || 1);
  const hi = a.y * 10000 + (a.m || 12) * 100 + (a.d || 31);
  return hi >= b.lo && lo <= b.hi;
}

/** Date de la fiche complète et sans approximation (jour, mois, année). */
const exactDate = (text) => {
  const p = dateParts(text);
  return !!(p && !p.q && p.d);
};

/** Année de naissance connue, sinon estimée d'après le décès, un conjoint, les enfants ou les parents. */
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
 * Ce qui part chez matchID pour cette personne : { lastName, firstName, sex?, birthDate? },
 * ou null si elle n'est pas à vérifier : morte avant 1970, née avant 1870, ou vivante et
 * de moins de 75 ans (ou d'âge inconnu) — les vivants plus jeunes ne sont jamais envoyés.
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

/** Empreinte de la question posée : une fiche est revérifiée quand elle change. */
export const inseeSignature = (q) => (q ? [q.lastName, q.firstName, q.sex || '', q.birthDate || ''].join('|') : '');

/** Actes qui peuvent être cette personne : même sexe, même premier prénom, naissance compatible. */
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

/** Points de concordance d'un acte avec la fiche, et ce qui concorde. */
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
 * Acte retenu pour la personne : { act, level, others } ou null. level vaut 'sure' (naissance
 * exacte identique, sans homonyme), 'likely' (naissance ou décès concordants, sans homonyme
 * aussi bon) ou 'lead' (piste : seuls le nom et le prénom concordent vraiment).
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

/** Lieu d'un acte, écrit comme ceux de l'arbre : « Tulle (19) », « Fribourg, Allemagne ». */
export const actPlace = (l) => formatPlace({ city: l.city, dept: isFrance(l.country) ? l.dept : '', country: l.country });
const placeText = actPlace;

/**
 * Écarts entre la fiche et l'acte : [{ field, kind, tree, insee, patch? }]. kind vaut 'fix' (la
 * fiche contredit l'acte) ou 'add' (l'acte complète la fiche) ; patch est ce qu'on reporte
 * dans la fiche d'un clic. L'INSEE écrit les noms sans accents : les prénoms déjà dans la fiche
 * gardent leur orthographe, le nom de naissance s'écrit en minuscules (à accentuer au besoin).
 */
export function deathDifferences(id, act) {
  const p = P(id);
  const out = [];
  const add = (field, kind, tree, insee, patch) => out.push({ field, kind, tree: String(tree || ''), insee, ...(patch ? { patch } : {}) });

  const given = words(String(p.given || '').replace(/\(.*?\)/g, ' ')); // sans le surnom entre parenthèses
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

  // Numéro de l'acte de décès : une source de la fiche, sauf si elle le cite déjà
  const number = String(act.certificate || '').trim();
  const cited = (s) => s.kind === 'death' && (`${s.title} ${s.ref}`.match(/\w+/g) || []).includes(number);
  if (number && !sourcesOf(p).some(cited)) {
    const source = {
      id: rid('s'), kind: 'death', fact: 'death', title: `Acte n°${number}`, place: act.death.city ? placeText(act.death) : '',
      ref: '', note: 'Fichier des personnes décédées de l’INSEE (matchID)', photo: '',
    };
    add('source', 'add', '', [source.title, source.place].filter(Boolean).join(', '), { sources: [...sourcesOf(p), source] });
  }
  return out;
}
