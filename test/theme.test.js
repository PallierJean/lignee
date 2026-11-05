import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { readFileSync } from 'node:fs';
import { S, savePrefs, loadPrefs } from '../js/state.js';
import { THEMES } from '../js/config.js';
import { seasonTheme, applyTheme } from '../js/ui/theme.js';

describe('thèmes de couleur', () => {
  test('selon la saison', () => {
    const on = (m, d) => seasonTheme(new Date(2026, m - 1, d));
    assert.equal(on(12, 1), 'noel');
    assert.equal(on(1, 6), 'noel');
    assert.equal(on(1, 7), 'auto', 'plein hiver : le thème du système');
    assert.equal(on(10, 20), 'halloween');
    assert.equal(on(11, 2), 'halloween');
    assert.equal(on(11, 5), 'automne');
    assert.equal(on(3, 20), 'printemps');
    assert.equal(on(7, 14), 'ete');
    assert.equal(on(9, 23), 'automne');
  });

  test('appliqué sur <html>, gardé dans les préférences', () => {
    S.theme = 'halloween';
    applyTheme();
    assert.equal(document.documentElement.dataset.theme, 'halloween');
    assert.equal(document.getElementById('themeSel').value, 'halloween');
    savePrefs();
    S.theme = 'auto';
    loadPrefs();
    assert.equal(S.theme, 'halloween');
    S.theme = 'auto';
    applyTheme();
    assert.equal('theme' in document.documentElement.dataset, false, 'automatique : le thème du système');
  });

  test('le sélecteur propose chaque thème, et chacun a ses couleurs', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');
    for (const theme of THEMES) {
      assert.match(html, new RegExp(`<option value="${theme}"`), theme);
      if (!['auto', 'season', 'light'].includes(theme)) assert.match(css, new RegExp(`:root\\[data-theme="${theme}"\\] \\{`), theme);
    }
  });
});
