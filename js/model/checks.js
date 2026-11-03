/**
 * Vérification de cohérence : ce qui ne peut pas être vrai (erreurs) ou qui est très
 * peu probable (à vérifier). Les dates imprécises ne sont signalées que si l'incohérence
 * est certaine ; les dates en texte libre ne sont pas contrôlées.
 *
 * Une anomalie : { code, level: 'error' | 'warn', ids, n } ; `ids` : personnes concernées,
 * la principale d'abord ; `n` : âge ou date cité. Textes dans i18n.js (« chk.<code> »).
 */
import { S } from '../state.js';
import { dateBounds, isImpossibleDate, yearsBetween } from '../utils/dates.js';
import { norm } from '../utils/helpers.js';
import { P, eventsOf, isDead, partnersOf, childrenOf } from './people.js';
import { placeUses, parsePlace } from './places.js';
import { placeDepartmentIssue, departmentsText } from './communes.js';
import { t } from '../i18n.js';

const MIN_PARENT = 12;   // âge minimal d'un parent ou à l'union
const MAX_MOTHER = 55;   // âge à la naissance d'un enfant
const MAX_FATHER = 80;
const MAX_AGE = 120;     // âge au décès
const MAX_LIVING = 110;  // âge d'une personne sans décès connu
const MIN_TWO_GENS = 34; // écart minimal entre un grand-parent et son petit-enfant
const POSTHUMOUS = 10000; // un père peut mourir jusqu'à un an (aaaammjj) avant la naissance

// Événements normalement postérieurs au décès, ou sans date attendue par rapport à lui
const AFTER_DEATH = new Set(['burial', 'cremation', 'will', 'other']);
const BURIALS = new Set(['burial', 'cremation']);
// Situations qui supposent une union enregistrée (« en couple » peut viser un conjoint absent de l'arbre)
const WITH_UNION = new Set(['married', 'remarried', 'pacs', 'separated', 'divorced', 'widowed']);

/** Nom pour comparer : sans casse, accents, espaces ni tirets. */
const nameKey = (s) => norm(s).replace(/[^a-z]/g, '');

/** Nom de naissance, s'il est connu : pour une femme mariée sans nom de jeune fille, le nom porté peut être celui du mari. */
function birthName(id) {
  const p = P(id);
  if (p.sex === 'F' && p.maidenName) return p.maidenName;
  if (p.sex === 'F' && partnersOf(id).length) return '';
  return p.surname || '';
}

/** Boucles dans les liens de parenté : une personne qui serait son propre ancêtre. */
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
      // Deux générations : grand-parent et petit-enfant
      for (const gkey of ['fatherId', 'motherId']) {
        const g = P(parent[gkey]);
        const gb = g && parent[gkey] !== id && dateBounds(g.birthDate);
        if (birth && gb && yearsBetween(gb.lo, birth.hi) >= 0 && yearsBetween(gb.lo, birth.hi) < MIN_TWO_GENS) {
          add('twoGensTooClose', 'warn', [id, parent[gkey], p[key]], yearsBetween(gb.lo, birth.hi));
        }
      }
    }

    // Un seul parent connu, dont l'unique conjoint pourrait être l'autre
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

    // Personne sans décès connu : d'après sa naissance, ou à défaut celle de son premier enfant
    if (!isDead(p)) {
      const kids = childrenOf(id).map((c) => dateBounds(P(c).birthDate)).filter(Boolean);
      const age = birth ? yearsBetween(birth.hi, today)
        : kids.length ? yearsBetween(Math.min(...kids.map((k) => k.hi)), today) + MIN_PARENT : 0;
      if (age > MAX_LIVING) add('livingTooOld', 'warn', [id], age);
    }

    const father = P(p.fatherId);
    if (father && father.sex !== 'F' && p.fatherId !== id) {
      const own = nameKey(birthName(id));
      const his = nameKey(father.surname);
      if (own && his && own !== his) add('nameNotFather', 'warn', [id, p.fatherId], birthName(id));
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

  // Lieux : le département doit être celui de la ville (liste des communes chargée)
  for (const u of placeUses()) {
    const issue = placeDepartmentIssue(u.name);
    if (issue) add('placeDept', 'warn', [...u.ids].slice(0, 1), t('chk.placeDeptDetail', u.name, parsePlace(u.name).city, departmentsText(issue.expected), u.n));
  }

  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
}
