/** Récit du livret de famille : un paragraphe par personne, regroupé par génération. */
import { S } from '../state.js';
import { dateParts, longDate, yearOf } from '../utils/dates.js';
import { t } from '../i18n.js';
import {
  P, given, fullName, longName, lifeYears, byBirth, isDead, ageInfo, partnersOf, childrenOf, eventsOf, eventLabel, sourcesOf, SOURCE_KINDS, unionTypeLabel, unionEndText,
} from './people.js';
import { generationMap } from '../tree/full-layout.js';

const clean = (x) => String(x || '').trim();

/** « le 12 mars 1932 », « en 1932 », « vers 1850 » ; vide sans date. */
export function whenText(date) {
  const p = dateParts(date);
  const text = longDate(date);
  if (!text) return '';
  if (!p) {
    // Texte libre : « 05 Octobre 1863 » est un jour, « Octobre 1863 » un mois, le reste tel quel
    if (/^\d{1,2}\s+\p{L}/u.test(text)) return t('nar.on') + ' ' + text;
    return /^\p{L}+\s+\d{4}$/u.test(text) && yearOf(text) ? t('nar.in') + ' ' + text : text;
  }
  if (p.q) return text;
  return (p.d ? t('nar.on') : t('nar.in')) + ' ' + text;
}

const atPlace = (place) => (clean(place) ? t('nar.at', clean(place)) : '');

/** Phrases sur une personne. */
export function personStory(id) {
  const p = P(id);
  const out = [];
  const birth = [whenText(p.birthDate), atPlace(p.birthPlace)].filter(Boolean).join(' ');
  const father = P(p.fatherId);
  const mother = P(p.motherId);
  const parents = [father, mother].filter(Boolean).map(fullName);
  // Sans naissance ni parents, le nom seul répéterait le titre de la fiche
  if (birth || parents.length) out.push(t('nar.born', given(p) || longName(p), p.sex, birth, parents));
  if (clean(p.occupation)) out.push(t('nar.occupation', clean(p.occupation)));
  for (const { id: other, uid } of partnersOf(id)) {
    const u = uid ? S.unions.get(uid) : null;
    out.push(t('nar.union', fullName(P(other)), [u && whenText(u.date), u && atPlace(u.place)].filter(Boolean).join(' '), unionTypeLabel(u)));
    if (unionEndText(u)) out.push(t('ue.ended', unionEndText(u)).replace(/^./, (c) => c.toUpperCase()) + '.');
  }
  const kids = childrenOf(id).map((k) => fullName(P(k)));
  if (kids.length) out.push(t('nar.children', kids));
  for (const e of eventsOf(p)) {
    out.push([eventLabel(e), [whenText(e.date), atPlace(e.place)].filter(Boolean).join(' '), clean(e.note)].filter(Boolean).join(' ').trim() + '.');
  }
  if (isDead(p)) {
    const age = ageInfo(p);
    out.push(t('nar.died', p.sex, [whenText(p.deathDate), atPlace(p.deathPlace)].filter(Boolean).join(' '), age && age.dead ? age.text : ''));
  }
  return out.join(' ') || t('nar.none');
}

/** « Sources : … » pour une personne, ou vide. */
export function personSources(id) {
  const sources = sourcesOf(P(id)).map((s) => clean(s.title) || t('src.' + (SOURCE_KINDS.includes(s.kind) ? s.kind : 'other')));
  return sources.length ? t('nar.sources', [...new Set(sources)].join(', ')) : '';
}

/** Ordre du livret : par naissance, chaque personne suivie de ses conjoints de la même génération. */
function withPartners(ids) {
  const here = new Set(ids);
  const seen = new Set();
  const out = [];
  const add = (id) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push(id);
  };
  for (const id of ids.slice().sort(byBirth)) {
    add(id);
    for (const x of partnersOf(id)) if (here.has(x.id)) add(x.id);
  }
  return out;
}

/** Sections du livret : [{ gen, people: [{ id, name, text }] }], la plus ancienne d'abord. */
export function bookSections() {
  const gens = new Map();
  for (const [id, g] of generationMap()) {
    if (!gens.has(g)) gens.set(g, []);
    gens.get(g).push(id);
  }
  return [...gens.keys()].sort((a, b) => a - b).map((g, i) => ({
    gen: i + 1,
    people: withPartners(gens.get(g)).map((id) => ({
      id, name: longName(P(id)), years: lifeYears(P(id)), text: personStory(id), sources: personSources(id),
    })),
  }));
}
