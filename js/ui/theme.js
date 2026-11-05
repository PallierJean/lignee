/**
 * Apparence de l'interface : thème de couleur (attribut data-theme de <html>, voir css/tokens.css)
 * et taille du texte (attribut data-text, voir css/base.css).
 */
import { S } from '../state.js';
import { $ } from '../utils/dom.js';
import { setFootprints } from './footprints.js';
import { setSky } from './sky.js';
import { setRain } from './rain.js';
import { setSnow } from './snow.js';

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

/** Applique le thème et la taille du texte choisis, et met les sélecteurs à jour. */
export function applyTheme() {
  const root = document.documentElement.dataset;
  const theme = S.theme === 'season' ? seasonTheme() : S.theme;
  if (theme === 'auto') delete root.theme;
  else root.theme = theme;
  if (S.textSize === 'normal') delete root.text;
  else root.text = S.textSize;
  setFootprints(theme === 'maraudeur');
  setSky(theme === 'constellations');
  setRain(theme === 'matrix');
  setSnow(theme === 'noel');
  $('#themeSel').value = S.theme;
  $('#textSel').value = S.textSize;
}
