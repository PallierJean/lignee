/**
 * Birth and marriage certificates to request from town halls, as the death certificates of
 * model/insee.js: each one an `act` for deathActsByCommune() ({ type, first, last, date, dateText,
 * place, record: true }), its record or union as `id`, the people it names as `people`.
 * Certificates under 75 years old are only delivered to the people named and their close
 * family: they aren't listed.
 */
import { S } from '../state.js';
import { P, sourcesOf } from './people.js';
import { dateParts } from '../utils/dates.js';
import { parsePlace } from './places.js';
import { isFrance } from './countries.js';

/** Years after which a birth or marriage certificate can be delivered to anyone. */
export const FREE_AFTER = 75;

const sortable = (d) => String(d.y) + String(d.m || 0).padStart(2, '0') + String(d.d || 0).padStart(2, '0');

/** Name at birth: the maiden name of a woman, else the surname. */
const birthName = (p) => (p.sex === 'F' && String(p.maidenName || '').trim()) || String(p.surname || '').trim();
const firstNames = (p) => String(p.given || '').trim().split(/\s+/).filter(Boolean);

/** Date and place of a certificate to request, or null: exact enough, in France, old enough to be delivered. */
function when(dateText, placeText, deptOf, now) {
  const d = dateParts(dateText);
  if (!d || d.q) return null;
  // Over FREE_AFTER years to the day; a month or a day unknown counts as the latest one
  const limit = (now.getFullYear() - FREE_AFTER) * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  if (d.y * 10000 + (d.m || 12) * 100 + (d.d || 31) > limit) return null;
  const place = parsePlace(placeText);
  if (!place.city || !isFrance(place.country)) return null;
  return { date: sortable(d), dateText: String(dateText).trim(), place: { city: place.city, dept: place.dept || deptOf(place.city) || '', country: '' } };
}

/** Whether a picture of `p`'s birth or baptism certificate is in one of their sources. */
export const hasBirthDocument = (p) => sourcesOf(p).some((src) => src.photo && (['birth', 'baptism'].includes(src.kind) || src.fact === 'birth'));

/** Whether a picture of the marriage certificate of union `uid` is among its sources or its spouses'. */
export function hasMarriageDocument(uid) {
  const u = S.unions.get(uid);
  if (!u) return false;
  const docs = [...sourcesOf(u), ...[u.a, u.b].flatMap((id) => sourcesOf(P(id)).filter((src) => src.fact === 'union:' + uid))];
  return docs.some((src) => src.photo);
}

/** Birth certificate of `p` to request, or null. */
export function recordBirthAct(p, deptOf = () => '', now = new Date()) {
  const at = p && when(p.birthDate, p.birthPlace, deptOf, now);
  if (!at) return null;
  const surname = String(p.surname || '').trim();
  return { type: 'birth', first: firstNames(p), last: birthName(p), married: birthName(p) !== surname ? surname : '', sex: p.sex || '', ...at, certificate: '', record: true };
}

/** Marriage certificate of union `u` to request, or null: both spouses in the tree, a marriage (not a civil union). */
export function recordMarriageAct(u, deptOf = () => '', now = new Date()) {
  if (!u || !P(u.a) || !P(u.b) || (u.type && u.type !== 'married' && u.type !== 'remarried')) return null;
  const at = when(u.date, u.place, deptOf, now);
  if (!at) return null;
  const [a, b] = [P(u.a), P(u.b)];
  return {
    type: 'marriage', first: firstNames(a), last: birthName(a), married: '', sex: a.sex || '',
    spouseFirst: firstNames(b), spouseLast: birthName(b), ...at, certificate: '', record: true,
  };
}

/** Birth certificates to request: [{ id, act, people }], those already in hand left out. */
export function birthActRows(deptOf, now) {
  const rows = [];
  for (const [id, p] of S.people) {
    const act = !hasBirthDocument(p) && recordBirthAct(p, deptOf, now);
    if (act) rows.push({ id, act, people: [id] });
  }
  return rows;
}

/** Marriage certificates to request: [{ id: union, act, people: [spouses] }], those already in hand left out. */
export function marriageActRows(deptOf, now) {
  const rows = [];
  for (const [uid, u] of S.unions) {
    const act = !hasMarriageDocument(uid) && recordMarriageAct(u, deptOf, now);
    if (act) rows.push({ id: uid, act, people: [u.a, u.b] });
  }
  return rows;
}
