/**
 * Consistency of a form not saved yet (the one the voice filled in): the tree's checks
 * (js/model/checks.js) as if it were saved, a likely duplicate, a date not understood.
 * Issues as findIssues(): { code, level, ids, n }; the form's person is DRAFT_ID when new.
 */
import { S } from '../state.js';
import { dateBounds } from '../utils/dates.js';
import { P, reindex } from './people.js';
import { findIssues } from './checks.js';
import { findDuplicates } from './duplicates.js';

export const DRAFT_ID = '\u0000draft';

/** The tree as it would be with the form `e` (S.edit) saved: { people, unions }. */
function withDraft(e, id) {
  const people = new Map(S.people);
  const unions = new Map(S.unions);
  people.set(id, { ...(e.id ? P(e.id) : {}), ...e.draft, fatherId: e.draft.fatherId || null, motherId: e.draft.motherId || null });
  // The person added as a father or a mother: the parent of the record it was added to
  if ((e.rel === 'father' || e.rel === 'mother') && people.has(e.of)) {
    people.set(e.of, { ...people.get(e.of), [e.rel === 'father' ? 'fatherId' : 'motherId']: id });
  }
  e.unions.forEach((u, i) => {
    if (u.removed || !u.other) return;
    const uid = u.uid || DRAFT_ID + i;
    unions.set(uid, { ...(unions.get(uid) || {}), a: id, b: u.other, type: u.type, date: u.date, place: u.place, end: u.end, endDate: u.endDate });
  });
  return { people, unions };
}

/** What looks wrong in the form `e`, the errors first. */
export function draftIssues(e, now = new Date()) {
  if (!e || !e.draft) return [];
  const id = e.id || DRAFT_ID;
  const saved = { people: S.people, unions: S.unions };
  let found;
  Object.assign(S, withDraft(e, id));
  reindex();
  try {
    const tree = findIssues(now).filter((x) => x.ids.includes(id) && x.code !== 'placeDept');
    // A new record that may already be in the tree
    const twins = e.id ? [] : findDuplicates().filter((d) => d.a === id || d.b === id)
      .map((d) => ({ code: 'duplicate', level: 'warn', ids: [id, d.a === id ? d.b : d.a] }));
    found = [...tree, ...twins];
  } finally {
    Object.assign(S, saved);
    reindex();
  }
  // A date that isn't one ("28", the end of the date lost)
  for (const key of ['birthDate', 'deathDate']) {
    const v = String(e.draft[key] || '').trim();
    if (v && !dateBounds(v)) found.push({ code: 'notADate', level: 'warn', ids: [id], n: v });
  }
  for (const u of e.unions) {
    const v = String((!u.removed && u.date) || '').trim();
    if (v && !dateBounds(v)) found.push({ code: 'notADate', level: 'warn', ids: [id], n: v });
  }
  return found.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
}
