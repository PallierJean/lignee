/**
 * Freely entered dates: "12/03/1932", "03/1932", "1932", "12 mars 1932", "1er mars 1932",
 * "mars 1932", "vers 1850", "avant 1901", "après 1790" (or "about", "before", "after").
 * They are shown in the interface language, in the format "04 Août 1961".
 * Remaining free text is shown as is.
 */
import { t, DICT } from '../i18n.js';
import { norm } from './helpers.js';

/** Year contained in the date, or null. */
export function yearOf(s) {
  const m = /(\d{4})/.exec(s || '');
  return m ? +m[1] : null;
}

// Prefixes recognised on input, in French and English
const QUALIFIERS = [
  ['abt', /^(vers|env\.?|environ|ca\.?|c\.|about|abt\.?|circa|~)\s*/i],
  ['bef', /^(avant|av\.|before|bef\.?)\s*/i],
  ['aft', /^(apr[eè]s|ap\.|after|aft\.?)\s*/i],
];

/** Splits "vers 1850" into { q: 'abt', rest: '1850' } (q empty with no prefix). */
export function splitQualifier(s) {
  s = String(s || '').trim();
  for (const [q, re] of QUALIFIERS) {
    const m = re.exec(s);
    if (m) return { q, rest: s.slice(m[0].length) };
  }
  return { q: '', rest: s };
}

/** True if the day exists in that month (leap years included). */
const validDay = (d, m, y) => m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();

// Months written in full, in French and English, ignoring case and accents
const MONTH_NUMBER = new Map(Object.values(DICT).flatMap((d) => d.months.map((name, i) => [norm(name), i + 1])));

/**
 * Recognised date: { q, y, m?, d? } for "dd/mm/yyyy", "mm/yyyy", "yyyy", "dd month yyyy"
 * or "month yyyy", with or without a prefix. null for free text or an impossible date
 * (31/02/1900, 13/1900).
 */
export function dateParts(s) {
  const { q, rest } = splitQualifier(s);
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(rest);
  if (m) return validDay(+m[1], +m[2], +m[3]) ? { q, y: +m[3], m: +m[2], d: +m[1] } : null;
  m = /^(\d{1,2})\/(\d{4})$/.exec(rest);
  if (m) return +m[1] >= 1 && +m[1] <= 12 ? { q, y: +m[2], m: +m[1] } : null;
  m = /^(\d{1,2})(?:er)?\s+(\p{L}+)\s+(\d{4})$/u.exec(rest);
  if (m) {
    const month = MONTH_NUMBER.get(norm(m[2]));
    return month && validDay(+m[1], month, +m[3]) ? { q, y: +m[3], m: month, d: +m[1] } : null;
  }
  m = /^(\p{L}+)\s+(\d{4})$/u.exec(rest);
  if (m) return MONTH_NUMBER.has(norm(m[1])) ? { q, y: +m[2], m: MONTH_NUMBER.get(norm(m[1])) } : null;
  m = /^(\d{4})$/.exec(rest);
  return m ? { q, y: +m[1] } : null;
}

/** True if the date has the form dd/mm/yyyy, mm/yyyy or "dd month yyyy" but doesn't exist. */
export function isImpossibleDate(s) {
  const { rest } = splitQualifier(s);
  const words = /^\d{1,2}\s+(\p{L}+)\s+\d{4}$/u.exec(rest);
  const shaped = /^\d{1,2}\/(\d{1,2}\/)?\d{4}$/.test(rest) || (words && MONTH_NUMBER.has(norm(words[1])));
  return !!shaped && !dateParts(s);
}

/** Short form for tree cards: "1932", "v. 1850" ("c. 1850" in English). */
export function shortDate(s) {
  s = String(s || '').trim();
  if (!s) return '';
  const y = yearOf(s);
  const { q } = splitQualifier(s);
  return y ? (q ? t('date.' + q + 'Short') : '') + y : s.slice(0, 12);
}

const capitalized = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Long form for the detailed record: "04 Août 1961", "Mars 1932", "vers 1850". */
export function longDate(s) {
  const { q, rest } = splitQualifier(s);
  if (!rest) return String(s || '').trim();
  const months = t('months').map(capitalized);
  const prefix = q ? t('date.' + q) : '';
  const p = dateParts(s);
  if (p && p.d) return prefix + String(p.d).padStart(2, '0') + ' ' + months[p.m - 1] + ' ' + p.y;
  if (p && p.m) return prefix + months[p.m - 1] + ' ' + p.y;
  return prefix + rest; // year alone, free text or impossible date: as entered
}

/** Full date dd/mm/yyyy (no prefix) split up, or null. */
export function fullDate(s) {
  const p = dateParts(s);
  return p && !p.q && p.d ? { y: p.y, m: p.m, d: p.d } : null;
}

/**
 * Bounds of a date as yyyymmdd numbers: { lo, hi }, or null for free text.
 * "1932" covers the year, "vers" adds five years on each side, "avant" and "après"
 * leave one side open. Checks only flag what these bounds make certain.
 */
export function dateBounds(s) {
  const p = dateParts(s);
  if (!p) return null;
  const lo = p.y * 10000 + (p.m || 1) * 100 + (p.d || 1);
  const hi = p.y * 10000 + (p.m || 12) * 100 + (p.d || 31);
  if (p.q === 'abt') return { lo: lo - 50000, hi: hi + 50000 };
  if (p.q === 'bef') return { lo: -Infinity, hi };
  if (p.q === 'aft') return { lo, hi: Infinity };
  return { lo, hi };
}

/** Number of full years between two yyyymmdd numbers. */
export const yearsBetween = (from, to) => Math.floor((to - from) / 10000);
