/** Frise chronologique d'une personne ou de sa famille proche, avec les repères historiques. */
import { S } from '../state.js';
import { yearOf, longDate } from '../utils/dates.js';
import { t, getLang } from '../i18n.js';
import { P, fullName, partnersOf, childrenOf, eventsOf, eventLabel, isDead, unionTypeLabel, UNION_ENDS } from './people.js';
import { HISTORY } from './history-data.js';

/** Personnes de la frise : la personne seule, ou avec parents, conjoints et enfants. */
function peopleOf(id, family) {
  if (!family) return [id];
  const p = P(id);
  return [...new Set([id, p.fatherId, p.motherId, ...partnersOf(id).map((x) => x.id), ...childrenOf(id)])].filter((x) => x && S.people.has(x));
}

/** Lignes { year, kind: 'birth'|'union'|'event'|'death'|'history', label, date, id? }, par année. */
export function timelineOf(id, family, now = new Date()) {
  const ids = peopleOf(id, family);
  const rows = [];
  const add = (kind, date, label, who) => {
    const year = yearOf(date);
    if (year) rows.push({ year, kind, label, date: longDate(date), id: who });
  };
  const seenUnions = new Set();
  for (const x of ids) {
    const p = P(x);
    const named = (label) => (family ? `${label} · ${fullName(p)}` : label);
    add('birth', p.birthDate, named(t('birth')), x);
    for (const e of eventsOf(p)) add('event', e.date, named([eventLabel(e), e.note].filter(Boolean).join(' : ')), x);
    add('death', p.deathDate, named(t('death')), x);
    for (const { id: other, uid } of partnersOf(x)) {
      if (!uid || seenUnions.has(uid)) continue;
      seenUnions.add(uid);
      const u = S.unions.get(uid);
      add('union', u.date, `${unionTypeLabel(u) || t('union')} · ${fullName(p)} × ${fullName(P(other))}`, x);
      if (UNION_ENDS.includes(u.end)) add('event', u.endDate, `${t('ue.' + u.end)} · ${fullName(p)} × ${fullName(P(other))}`, x);
    }
  }
  if (!rows.length) return [];
  const main = P(id);
  const first = Math.min(...rows.map((r) => r.year));
  const last = family || isDead(main) ? Math.max(...rows.map((r) => r.year)) : now.getFullYear();
  for (const [year, fr, en] of HISTORY) {
    if (year >= first && year <= last) rows.push({ year, kind: 'history', label: getLang() === 'fr' ? fr : en, date: '' });
  }
  return rows.sort((a, b) => a.year - b.year || (a.kind === 'history') - (b.kind === 'history'));
}
