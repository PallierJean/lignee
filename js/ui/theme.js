/**
 * Interface appearance: colour theme (data-theme attribute on <html>, see css/tokens.css)
 * and text size (data-text attribute, see css/base.css).
 */
import { S } from '../state.js';
import { $ } from '../utils/dom.js';
import { setFootprints } from './footprints.js';
import { setSky } from './sky.js';
import { setRain } from './rain.js';
import { setAmbient } from './ambient.js';

/**
 * Seasonal theme on date `d`: Christmas from 1 December to Epiphany, Halloween from 20 October
 * to 2 November, then spring, summer and autumn; in midwinter, the system theme.
 */
export function seasonTheme(d = new Date()) {
  const md = (d.getMonth() + 1) * 100 + d.getDate(); // 1105: 5 November
  if (md >= 1201 || md <= 106) return 'noel';
  if (md >= 1020 && md <= 1102) return 'halloween';
  if (md >= 320 && md < 621) return 'printemps';
  if (md >= 621 && md < 923) return 'ete';
  if (md >= 923) return 'automne';
  return 'auto';
}

/** Applies the chosen theme and text size, and updates the selectors. */
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
  setAmbient(theme);
  $('#themeSel').value = S.theme;
  $('#textSel').value = S.textSize;
}
