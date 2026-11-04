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
import { P, isDead, partnersOf, childrenOf } from './people.js';
import { dateParts, dateBounds, yearOf } from '../utils/dates.js';
import { norm } from '../utils/helpers.js';
import { parsePlace, formatPlace } from './places.js';
import { isFrance } from './countries.js';

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

/** « 12/12/1972 », la forme enregistrée dans la fiche quand on reporte une date de l'acte. */
export function actDateText(s) {
  const a = actDate(s);
  if (!a) return '';
  if (!a.m) return String(a.y);
  return (a.d ? String(a.d).padStart(2, '0') + '/' : '') + String(a.m).padStart(2, '0') + '/' + a.y;
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
 * dans la fiche d'un clic. Les noms ne sont que signalés : l'INSEE les écrit sans accents.
 */
export function deathDifferences(id, act) {
  const p = P(id);
  const out = [];
  const add = (field, kind, tree, insee, patch) => out.push({ field, kind, tree: String(tree || ''), insee, ...(patch ? { patch } : {}) });

  const given = words(p.given);
  const official = act.first.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  if (words(official).length > given.length) add('given', 'add', p.given, official);
  if (words(act.last).join(' ') !== words(birthName(p)).join(' ')) add('name', 'fix', birthName(p), act.last);

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
  return out;
}
