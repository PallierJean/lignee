/** Export du registre au format CSV, lisible par Excel et LibreOffice. */
import { S } from '../state.js';
import { t } from '../i18n.js';
import { P, fullName, given, surname, maiden, cmpName, partnersOf, childrenOf, situationLabel, currentSituation } from '../model/people.js';

/**
 * Cellule CSV : entre guillemets si besoin. Un texte commençant par = + - ou @ serait pris pour
 * une formule par le tableur (une fiche importée pourrait en contenir) : on le préfixe d'une apostrophe.
 */
function cell(value, sep) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s.includes(sep) || /["\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function buildRegistreCsv() {
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
  // Le BOM indique l'UTF-8 à Excel, qui sinon abîme les accents
  return '﻿' + rows.map((r) => r.map((v) => cell(v, sep)).join(sep)).join('\r\n') + '\r\n';
}
