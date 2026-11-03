/**
 * Livre de famille complet : un chapitre par branche de la personne centrale.
 * D'abord elle, ses parents, ses conjoints et ses enfants ; puis une branche par grand-parent
 * (Sosa 4 à 7) avec tous ses ancêtres ; enfin les autres personnes de l'arbre.
 * Chaque branche a sa frise (naissances, unions, décès, repères historiques) et son album.
 */
import { S } from '../state.js';
import { t, getLang } from '../i18n.js';
import { yearOf } from '../utils/dates.js';
import { P, partnersOf, childrenOf, mediaOf, maiden, surname } from './people.js';
import { timelineOf } from './timeline.js';
import { HISTORY } from './history-data.js';
import { personEntry, withPartners } from './narrative.js';

/** Lignée directe : la personne et ses ancêtres, avec leur numéro Sosa (le plus petit en cas d'implexe). */
export function directLine(focus) {
  const out = new Map();
  let level = [[focus, 1]];
  while (level.length) {
    const next = [];
    for (const [id, sosa] of level) {
      if (out.has(id) || !S.people.has(id)) continue;
      out.set(id, sosa);
      const p = P(id);
      next.push([p.fatherId, 2 * sosa], [p.motherId, 2 * sosa + 1]);
    }
    level = next.filter(([id]) => id);
  }
  return [...out].map(([id, sosa]) => ({ id, sosa }));
}

/** Branche d'un numéro Sosa : 4 à 7 (le grand-parent dont il descend), ou lui-même en dessous de 4. */
export const branchOf = (sosa) => (sosa < 4 ? sosa : sosa >> (Math.floor(Math.log2(sosa)) - 2));

/** Clé d'un fait : une union vue de chaque conjoint (« A × B », « B × A ») est un seul fait. */
function sameFact(label) {
  const i = label.lastIndexOf(' · ');
  const names = label.slice(i + 3).split(' × ');
  return names.length === 2 ? label.slice(0, i + 3) + names.sort().join(' × ') : label;
}

/** Frise des personnes `ids` : leurs faits datés, puis les repères historiques de la période. */
export function branchTimeline(ids) {
  const set = new Set(ids);
  const seen = new Set();
  const rows = [];
  for (const id of ids) {
    for (const r of timelineOf(id, true)) {
      const key = r.year + '|' + sameFact(r.label);
      if (r.kind === 'history' || !set.has(r.id) || seen.has(key)) continue;
      seen.add(key);
      rows.push(r);
    }
  }
  if (!rows.length) return [];
  const [first, last] = [Math.min(...rows.map((r) => r.year)), Math.max(...rows.map((r) => r.year))];
  for (const [year, fr, en] of HISTORY) {
    if (year >= first && year <= last) rows.push({ year, kind: 'history', label: getLang() === 'fr' ? fr : en, date: '' });
  }
  return rows.sort((a, b) => a.year - b.year || (a.kind === 'history') - (b.kind === 'history'));
}

/** Photos et documents de la galerie des personnes `ids`, sans doublon. */
function albumOf(ids) {
  const seen = new Set();
  return ids.flatMap((id) => mediaOf(id)).filter(({ owner, m }) => {
    const key = owner + '/' + m.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Années couvertes par des personnes : « 1611 – 1938 », ou vide. */
function span(ids) {
  const years = ids.map((id) => yearOf(P(id).birthDate)).filter(Boolean);
  if (!years.length) return '';
  const [lo, hi] = [Math.min(...years), Math.max(...years)];
  return lo === hi ? String(lo) : lo + ' – ' + hi;
}

const chapter = (title, sub, ids, withExtras = true) => ({
  title, sub: [sub, span(ids)].filter(Boolean).join(' · '), people: ids.map(personEntry),
  timeline: withExtras ? branchTimeline(ids) : [], album: withExtras ? albumOf(ids) : [],
});

/** Chapitres : [{ title, sub, people, timeline, album }], ou [] sans personne centrale. */
export function bookChapters(focus) {
  if (!focus || !S.people.has(focus)) return [];
  const line = directLine(focus);
  const used = new Set();
  const take = (ids) => {
    const fresh = [...new Set(ids)].filter((id) => S.people.has(id) && !used.has(id));
    for (const id of fresh) used.add(id);
    return fresh;
  };
  const out = [];

  const self = take([...line.filter((x) => x.sosa <= 3).sort((a, b) => a.sosa - b.sosa).map((x) => x.id),
    ...partnersOf(focus).map((x) => x.id), ...childrenOf(focus)]);
  out.push(chapter(t('bb.self'), '', self));

  for (const root of [4, 5, 6, 7]) {
    // Les plus anciens d'abord : génération puis numéro Sosa
    const members = line.filter((x) => x.sosa >= 4 && branchOf(x.sosa) === root)
      .sort((a, b) => Math.floor(Math.log2(b.sosa)) - Math.floor(Math.log2(a.sosa)) || a.sosa - b.sosa);
    const ids = take(members.map((x) => x.id));
    if (!ids.length) continue;
    const head = P(line.find((x) => x.sosa === root)?.id);
    const name = head ? maiden(head) || surname(head) : '';
    out.push(chapter(name ? t('bb.branch', name) : t('bb.branchUnknown'), t('bb.side' + root), ids));
  }

  // Les autres, par naissance, chacun suivi de ses conjoints
  const rest = [...S.people.keys()].filter((id) => !used.has(id));
  if (rest.length) out.push(chapter(t('bb.others'), '', withPartners(rest), false));
  return out;
}
