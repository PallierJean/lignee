/** Register export as CSV, readable by Excel and LibreOffice. */
import { S } from '../state.js';
import { t } from '../i18n.js';
import { P, fullName, given, surname, maiden, cmpName, partnersOf, childrenOf, situationLabel, currentSituation } from '../model/people.js';

/**
 * CSV cell: quoted if needed. Text starting with = + - or @ would be taken as a formula
 * by the spreadsheet (an imported record could contain one): it gets an apostrophe prefix.
 */
function cell(value, sep) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s.includes(sep) || /["\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function buildRegisterCsv() {
  const sep = t('csv.sep');
  const names = (ids) => ids.map((id) => fullName(P(id))).join(', ');
  const parent = (id) => (P(id) ? fullName(P(id)) : '');
  const rows = [[
    t('f.surname'), t('f.given'), t('f.maiden'), t('f.sex'), t('birth'), t('csv.birthPlace'), t('death'),
    t('csv.deathPlace'), t('f.occupation'), t('situation'), t('father'), t('mother'), t('unions'), t('children'), t('notes'),
  ]];
  const people = [...S.people].sort((a, b) => cmpName(a[1], b[1]));
  for (const [id, p] of people) {
    rows.push([
      surname(p), given(p), maiden(p), p.sex === 'M' || p.sex === 'F' ? t('sex.' + p.sex) : '',
      p.birthDate, p.birthPlace, p.deathDate, p.deathPlace, p.occupation, situationLabel(currentSituation(id), p.sex),
      parent(p.fatherId), parent(p.motherId), names(partnersOf(id).map((x) => x.id)), names(childrenOf(id)), p.notes,
    ]);
  }
  // The BOM tells Excel the file is UTF-8; otherwise it mangles accents
  return '﻿' + rows.map((r) => r.map((v) => cell(v, sep)).join(sep)).join('\r\n') + '\r\n';
}
