/** Anniversaries: births, unions and deaths falling on a given day or month. */
import { S } from '../state.js';
import { dateParts } from '../utils/dates.js';
import { partnersOf, DATED_SITUATIONS } from './people.js';

/** Exact dates (not "about", "before" or "after") with at least the month. */
function parts(s) {
  const p = dateParts(s);
  return p && !p.q && p.m ? { y: p.y, m: p.m, d: p.d || null } : null;
}

/** All anniversaries: [{ kind: 'birth'|'death'|'union', y, m, d, ids }]. */
export function allDates() {
  const out = [];
  const add = (kind, date, ids) => {
    const p = parts(date);
    if (p) out.push({ kind, ...p, ids });
  };
  for (const [id, p] of S.people) {
    add('birth', p.birthDate, [id]);
    add('death', p.deathDate, [id]);
    // Marriage date with no recorded union (spouse not in the tree)
    if (DATED_SITUATIONS.has(p.situation) && !partnersOf(id).some((x) => x.uid)) add('union', p.situationDate, [id]);
  }
  for (const u of S.unions.values()) {
    if (S.people.has(u.a) && S.people.has(u.b)) add('union', u.date, [u.a, u.b]);
  }
  return out;
}

const byDay = (a, b) => (a.d || 99) - (b.d || 99) || a.y - b.y;

/** Dates in month `m` (1 to 12), by day; those with no known day at the end. */
export const datesOfMonth = (m) => allDates().filter((x) => x.m === m).sort(byDay);

/** Today's dates. A 29 February is celebrated on the 28th in non-leap years. */
export function datesOfDay(now = new Date()) {
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const y = now.getFullYear();
  const leap = new Date(Date.UTC(y, 1, 29)).getUTCMonth() === 1;
  return allDates().filter((x) => x.m === m && (x.d === d || (m === 2 && d === 28 && !leap && x.d === 29))).sort(byDay);
}
