/** Éphémérides : naissances, unions et décès qui tombent un jour ou un mois donné. */
import { S } from '../state.js';
import { dateParts } from '../utils/dates.js';
import { partnersOf, DATED_SITUATIONS } from './people.js';

/** Dates exactes (ni « vers », ni « avant », ni « après ») avec au moins le mois. */
function parts(s) {
  const p = dateParts(s);
  return p && !p.q && p.m ? { y: p.y, m: p.m, d: p.d || null } : null;
}

/** Tous les anniversaires : [{ kind: 'birth'|'death'|'union', y, m, d, ids }]. */
export function allDates() {
  const out = [];
  const add = (kind, date, ids) => {
    const p = parts(date);
    if (p) out.push({ kind, ...p, ids });
  };
  for (const [id, p] of S.people) {
    add('birth', p.birthDate, [id]);
    add('death', p.deathDate, [id]);
    // Date de mariage sans union enregistrée (conjoint absent de l'arbre)
    if (DATED_SITUATIONS.has(p.situation) && !partnersOf(id).some((x) => x.uid)) add('union', p.situationDate, [id]);
  }
  for (const u of S.unions.values()) {
    if (S.people.has(u.a) && S.people.has(u.b)) add('union', u.date, [u.a, u.b]);
  }
  return out;
}

const byDay = (a, b) => (a.d || 99) - (b.d || 99) || a.y - b.y;

/** Dates du mois `m` (1 à 12), par jour ; celles sans jour connu à la fin. */
export const datesOfMonth = (m) => allDates().filter((x) => x.m === m).sort(byDay);

/** Dates du jour. Un 29 février se fête le 28 les années non bissextiles. */
export function datesOfDay(now = new Date()) {
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const y = now.getFullYear();
  const leap = new Date(Date.UTC(y, 1, 29)).getUTCMonth() === 1;
  return allDates().filter((x) => x.m === m && (x.d === d || (m === 2 && d === 28 && !leap && x.d === 29))).sort(byDay);
}
