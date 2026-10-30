/**
 * Livret de famille d'une personne, sur le modèle de celui remis en mairie : ses unions
 * et ses enfants directs, présentés en extraits. Document de famille, sans valeur officielle.
 */
import { S } from '../state.js';
import { longDate } from '../utils/dates.js';
import { t } from '../i18n.js';
import { P, longName, fullName, isDead, partnersOf, childrenOf, unionTypeLabel, unionEndText, photoOf, coupleName } from './people.js';

const clean = (x) => String(x || '').trim();
const fact = (date, place) => [longDate(date), clean(place)].filter(Boolean).join(', ');

/** Une union en quelques mots : « Mariage avec Anne ROUX, 12 mars 1956, Lyon ». */
function unionLine(id, x) {
  const u = x.uid ? S.unions.get(x.uid) : null;
  const what = [u && unionTypeLabel(u), t('with', fullName(P(x.id)))].filter(Boolean).join(' '); // la ligne s'intitule déjà « Union »
  const end = unionEndText(u);
  return [what, u && fact(u.date, u.place), end && t('ue.ended', end)].filter(Boolean).join(', ');
}

/** Extrait d'une personne : { id, name, photo, rows: [[libellé, valeur], ...] }. `unions` : avec ses unions. */
export function extract(id, unions = true) {
  const p = P(id);
  const rows = [];
  const add = (label, value) => {
    if (value) rows.push([label, value]);
  };
  add(t('birth'), fact(p.birthDate, p.birthPlace));
  add(t('father'), P(p.fatherId) ? fullName(P(p.fatherId)) : '');
  add(t('mother'), P(p.motherId) ? longName(P(p.motherId)) : '');
  add(t('f.occupation'), clean(p.occupation));
  if (unions) partnersOf(id).forEach((x) => add(t('union'), unionLine(id, x)));
  if (isDead(p)) add(t('death'), fact(p.deathDate, p.deathPlace) || t('fiche.unknownDate'));
  return { id, name: longName(p), photo: photoOf(p), rows };
}

/**
 * Nom du livret de la personne `id` : elle et son conjoint sont les parents du livret, le père
 * d'abord. Avec plusieurs unions, celle qui a le plus d'enfants ; sans conjoint, son nom seul.
 */
export function familyBookName(id) {
  const count = (other) => childrenOf(id).filter((k) => [P(k).fatherId, P(k).motherId].includes(other)).length;
  const main = partnersOf(id).map((x) => x.id).sort((a, b) => count(b) - count(a))[0];
  const [a, b] = [P(id), P(main)];
  return b && a.sex === 'F' ? coupleName(b, a) : coupleName(a, b);
}

/** Le livret de la personne `id` : ses unions avec leurs enfants, et les enfants sans autre parent connu. */
export function familyBook(id) {
  const otherParent = (k) => {
    const c = P(k);
    return c.fatherId === id ? c.motherId : c.fatherId;
  };
  const kids = childrenOf(id);
  const partners = partnersOf(id);
  // Un enfant figure comme à sa naissance : ses propres unions n'ont pas leur place dans ce livret
  const child = (k) => extract(k, false);
  return {
    holder: extract(id),
    unions: partners.map((x) => {
      const u = x.uid ? S.unions.get(x.uid) : null;
      return {
        partner: extract(x.id),
        title: (u && unionTypeLabel(u)) || t('fb.noType'),
        when: u ? [fact(u.date, u.place), unionEndText(u) && t('ue.ended', unionEndText(u))].filter(Boolean).join(' · ') : '',
        children: kids.filter((k) => otherParent(k) === x.id).map(child),
      };
    }),
    others: kids.filter((k) => !partners.some((x) => x.id === otherParent(k))).map(child),
  };
}
