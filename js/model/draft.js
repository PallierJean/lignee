/** Checks of the form's draft before saving: no access to the page, only the draft. */
import { isImpossibleDate } from '../utils/dates.js';
import { DATED_SITUATIONS } from './people.js';

/** Error to show for the form `e` (S.edit): an i18n key, or '' if it can be saved. */
export function draftError(e) {
  const d = e.draft;
  if (!d.given.trim() && !d.surname.trim() && !(d.sex === 'F' && d.maidenName.trim())) return 'f.errName';
  if (e.rel === 'sibling' && !d.fatherId && !d.motherId) return 'f.errSibling';
  if (d.fatherId && d.fatherId === d.motherId) return 'f.errParents';
  const dates = [d.birthDate, d.deathDate, DATED_SITUATIONS.has(d.situation) ? d.situationDate : '',
    ...e.unions.filter((u) => !u.removed).flatMap((u) => [u.date, u.endDate]), ...e.events.filter((x) => !x.removed).map((x) => x.date)];
  return dates.some(isImpossibleDate) ? 'f.errDate' : '';
}
