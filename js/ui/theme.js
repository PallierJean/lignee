/** Thème de couleur de l'interface : attribut data-theme de <html>, voir css/tokens.css. */
import { S } from '../state.js';
import { $ } from '../utils/dom.js';

/**
 * Thème de la saison à la date `d` : Noël du 1er décembre à l'Épiphanie, Halloween du 20 octobre
 * au 2 novembre, puis printemps, été et automne ; en plein hiver, le thème du système.
 */
export function seasonTheme(d = new Date()) {
  const md = (d.getMonth() + 1) * 100 + d.getDate(); // 1105 : 5 novembre
  if (md >= 1201 || md <= 106) return 'noel';
  if (md >= 1020 && md <= 1102) return 'halloween';
  if (md >= 320 && md < 621) return 'printemps';
  if (md >= 621 && md < 923) return 'ete';
  if (md >= 923) return 'automne';
  return 'auto';
}

/** Applique le thème choisi et met le sélecteur à jour. */
export function applyTheme() {
  const theme = S.theme === 'season' ? seasonTheme() : S.theme;
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  $('#themeSel').value = S.theme;
}
