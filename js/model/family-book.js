/**
 * A person's family booklet, modelled on the one issued by the town hall: their unions
 * and their direct children, presented as extracts. A family document, with no official value.
 */
import { S } from '../state.js';
import { longDate } from '../utils/dates.js';
import { t } from '../i18n.js';
import { P, longName, fullName, isDead, partnersOf, childrenOf, unionTypeLabel, unionEndText, photoOf, coupleName } from './people.js';
import { occupationLabel } from './occupations.js';

const clean = (x) => String(x || '').trim();
const fact = (date, place) => [longDate(date), clean(place)].filter(Boolean).join(', ');

/** A union in a few words: "Mariage avec Anne ROUX, 12 mars 1956, Lyon". */
function unionLine(id, x) {
  const u = x.uid ? S.unions.get(x.uid) : null;
  const what = [u && unionTypeLabel(u), t('with', fullName(P(x.id)))].filter(Boolean).join(' '); // the row is already titled "Union"
  const end = unionEndText(u);
  return [what, u && fact(u.date, u.place), end && t('ue.ended', end)].filter(Boolean).join(', ');
}

/** A person's extract: { id, name, photo, rows: [[label, value], ...] }. `unions`: with their unions. */
export function extract(id, unions = true) {
  const p = P(id);
  const rows = [];
  const add = (label, value) => {
    if (value) rows.push([label, value]);
  };
  add(t('birth'), fact(p.birthDate, p.birthPlace));
  add(t('father'), P(p.fatherId) ? fullName(P(p.fatherId)) : '');
  add(t('mother'), P(p.motherId) ? longName(P(p.motherId)) : '');
  add(t('f.occupation'), occupationLabel(p));
  if (unions) partnersOf(id).forEach((x) => add(t('union'), unionLine(id, x)));
  if (isDead(p)) add(t('death'), fact(p.deathDate, p.deathPlace) || t('record.unknownDate'));
  return { id, name: longName(p), photo: photoOf(p), rows };
}

/**
 * Name of the booklet of person `id`: they and their spouse are the booklet's parents, the father
 * first. With several unions, the one with the most children; with no spouse, their name alone.
 */
export function familyBookName(id) {
  const count = (other) => childrenOf(id).filter((k) => [P(k).fatherId, P(k).motherId].includes(other)).length;
  const main = partnersOf(id).map((x) => x.id).sort((a, b) => count(b) - count(a))[0];
  const [a, b] = [P(id), P(main)];
  return b && a.sex === 'F' ? coupleName(b, a) : coupleName(a, b);
}

/** The booklet of person `id`: their unions with their children, and the children with no other known parent. */
export function familyBook(id) {
  const otherParent = (k) => {
    const c = P(k);
    return c.fatherId === id ? c.motherId : c.fatherId;
  };
  const kids = childrenOf(id);
  const partners = partnersOf(id);
  // A child appears as at birth: their own unions don't belong in this booklet
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
