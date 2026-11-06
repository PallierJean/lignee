/**
 * Generates js/data/communes.js from INSEE's official geographic code
 * (v_commune_<year>.csv: current, delegated and associated communes).
 *
 *   node scripts/build-communes.mjs v_commune_2025.csv
 *
 * Source: https://www.insee.fr/fr/information/2560452 (Etalab open licence).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [, , source] = process.argv;
if (!source) {
  console.error('Usage : node scripts/build-communes.mjs v_commune_<année>.csv');
  process.exit(1);
}

const rows = readFileSync(source, 'utf8').trim().split(/\r?\n/).map((line) => line.split(',').map((x) => x.replace(/^"|"$/g, '')));
const head = rows.shift();
const col = (name) => head.indexOf(name);
const [TYPE, CODE, NAME] = [col('TYPECOM'), col('COM'), col('LIBELLE')];

// A commune's department: its first two characters, three for overseas (971…)
const deptOf = (code) => (code.startsWith('97') ? code.slice(0, 3) : code.slice(0, 2));

const byDept = new Map();
for (const r of rows) {
  if (!['COM', 'COMD', 'COMA'].includes(r[TYPE])) continue;
  const dept = deptOf(r[CODE]);
  if (!byDept.has(dept)) byDept.set(dept, new Set());
  byDept.get(dept).add(r[NAME]);
}

const depts = [...byDept.keys()].sort();
const body = depts.map((d) => `  '${d}': ${JSON.stringify([...byDept.get(d)].sort().join('|'))},`).join('\n');
writeFileSync(new URL('../js/data/communes.js', import.meta.url), `/**
 * Communes de France (actuelles, déléguées et associées) par département, séparées par « | ».
 * Généré par scripts/build-communes.mjs depuis le Code officiel géographique de l'INSEE : ne pas modifier à la main.
 */
export const COMMUNES = {
${body}
};
`);
console.log(`${depts.length} départements, ${[...byDept.values()].reduce((n, s) => n + s.size, 0)} communes`);
