/**
 * Complétude d'une fiche : ce qui est renseigné parmi les faits attendus.
 * Naissance (date, lieu), décès s'il y a lieu (date, lieu), père, mère, et une source
 * pour la naissance et le décès. Une date sans le jour compte pour moitié.
 *
 * completeness(id) : { score (0 à 100), missing: [critère...] } ; un critère est une clé
 * de CRITERIA, avec « Day » au bout quand seul le jour manque (« birthDateDay »).
 */
import { S } from '../state.js';
import { dateParts, yearOf } from '../utils/dates.js';
import { P, isDead, sourcesOf } from './people.js';
import { t } from '../i18n.js';

export const CRITERIA = ['birthDate', 'birthPlace', 'deathDate', 'deathPlace', 'father', 'mother', 'birthSource', 'deathSource'];
const DEATH = new Set(['deathDate', 'deathPlace', 'deathSource']);

/** 1 pour une date au jour près, 0,5 pour une année ou un mois, 0 sans date. */
function dateValue(s) {
  const p = dateParts(s);
  if (p) return p.d && !p.q ? 1 : 0.5;
  return yearOf(s) ? 0.5 : 0;
}

/** Valeur de chaque critère applicable à la personne : { critère: 0 à 1 }. */
function values(p) {
  const cited = new Set(sourcesOf(p).map((s) => s.fact));
  const all = {
    birthDate: dateValue(p.birthDate),
    birthPlace: String(p.birthPlace || '').trim() ? 1 : 0,
    deathDate: dateValue(p.deathDate),
    deathPlace: String(p.deathPlace || '').trim() ? 1 : 0,
    father: p.fatherId && S.people.has(p.fatherId) ? 1 : 0,
    mother: p.motherId && S.people.has(p.motherId) ? 1 : 0,
    birthSource: cited.has('birth') ? 1 : 0,
    deathSource: cited.has('death') ? 1 : 0,
  };
  const dead = isDead(p);
  return Object.fromEntries(CRITERIA.filter((c) => dead || !DEATH.has(c)).map((c) => [c, all[c]]));
}

export function completeness(id) {
  const v = values(P(id));
  const keys = Object.keys(v);
  const score = Math.round((keys.reduce((sum, k) => sum + v[k], 0) / keys.length) * 100);
  const missing = keys.filter((k) => v[k] < 1).map((k) => (v[k] > 0 ? k + 'Day' : k));
  return { score, missing };
}

/** Ce qui manque à une fiche, en clair : « Manque : lieu de naissance, source du décès », ou « Rien n'est renseigné ». */
export function missingText({ score, missing }) {
  if (!missing.length) return '';
  return score ? t('cmp.missing', missing.map((k) => t('cmp.' + k)).join(', ')) : t('cmp.nothing');
}

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

/**
 * Bilan de l'arbre : score moyen, part des fiches où chaque critère est rempli
 * (parmi celles où il s'applique), et les fiches les plus pauvres de la lignée directe.
 */
export function completenessReport(focus, limit = 15) {
  const scores = [...S.people.keys()].map((id) => completeness(id).score);
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const criteria = CRITERIA.map((c) => {
    const applicable = [...S.people.values()].map(values).filter((v) => c in v);
    const filled = applicable.filter((v) => v[c] === 1).length;
    return { key: c, filled, total: applicable.length, pct: applicable.length ? (filled / applicable.length) * 100 : 0 };
  }).filter((c) => c.total);
  const line = focus && S.people.has(focus)
    ? directLine(focus).map((x) => ({ ...x, ...completeness(x.id) }))
    : [];
  const lineAverage = line.length ? Math.round(line.reduce((a, x) => a + x.score, 0) / line.length) : null;
  const poorest = line.slice().sort((a, b) => a.score - b.score || a.sosa - b.sosa).slice(0, limit);
  return { average, criteria, lineAverage, lineCount: line.length, poorest };
}
