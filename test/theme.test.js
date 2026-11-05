import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { S, savePrefs, loadPrefs } from '../js/state.js';
import { THEMES, TEXT_SIZES } from '../js/config.js';
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
    // Rangés dans le menu « Aa » : l'en-tête tient sur une ligne
    const menu = html.match(/<details class="appearance"[\s\S]*?<\/details>/)[0];
    assert.match(menu, /id="themeSel"[\s\S]*id="textSel"/);
    const css = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');
    for (const theme of THEMES) {
      assert.match(html, new RegExp(`<option value="${theme}"`), theme);
      if (!['auto', 'season', 'light'].includes(theme)) assert.match(css, new RegExp(`:root\\[data-theme="${theme}"\\] \\{`), theme);
    }
  });

  test('taille du texte : appliquée sur <html>, gardée dans les préférences', () => {
    assert.deepEqual(TEXT_SIZES, ['normal', 'large', 'xlarge']);
    S.textSize = 'xlarge';
    applyTheme();
    assert.equal(document.documentElement.dataset.text, 'xlarge');
    assert.equal(document.getElementById('textSel').value, 'xlarge');
    savePrefs();
    S.textSize = 'normal';
    loadPrefs();
    assert.equal(S.textSize, 'xlarge');
    S.textSize = 'normal';
    applyTheme();
    assert.equal('text' in document.documentElement.dataset, false);
    const base = readFileSync(new URL('../css/base.css', import.meta.url), 'utf8');
    assert.match(base, /:root\[data-text="large"\] \{\s+font-size: 125%;/);
    assert.match(base, /:root\[data-text="xlarge"\] \{\s+font-size: 150%;/);
  });

  test('textes de l’interface en rem (ils suivent la taille choisie), sauf l’impression', () => {
    const dir = new URL('../css/', import.meta.url);
    const files = ['base.css', 'layout.css', ...readdirSync(new URL('components/', dir)).map((f) => 'components/' + f)]
      .filter((f) => !['components/print.css', 'components/tree.css'].includes(f));
    for (const f of files) {
      // Seul un plafond min(…rem, …px) peut citer des px : la taille suit le réglage jusqu'à lui
      const css = readFileSync(new URL(f, dir), 'utf8').replace(/min\([\d.]+rem, [\d.]+px\)/g, '');
      assert.doesNotMatch(css, /font(-size)?:[^;]*\dpx|line-height: [\d.]+px/, f);
    }
    // Arbre : la barre d'outils et la légende suivent, les fiches (taille fixe) non
    const tree = readFileSync(new URL('components/tree.css', dir), 'utf8');
    assert.match(tree, /\.legend \{[^}]*font-size: [.\d]+rem/);
    assert.match(tree, /\.card \{[^}]*font-size: 15px/);
  });

  test('thèmes d’accessibilité : contrastes, couleurs distinctes, focus visible', () => {
    const css = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');
    const lum = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    for (const theme of ['daltonisme', 'contraste', 'contraste-sombre']) {
      const block = css.match(new RegExp(`:root\\[data-theme="${theme}"\\] \\{([^}]*)\\}`))[1];
      const v = Object.fromEntries([...block.matchAll(/--([\w-]+): (#[0-9A-F]{6});/gi)].map((m) => [m[1], m[2]]));
      const min = theme === 'daltonisme' ? 4.5 : 7; // AA, ou AAA pour les thèmes de contraste
      for (const k of ['ink', 'muted', 'warn', 'danger', 'ok']) assert.ok(ratio(v[k], v.surface) >= min, `${theme} : --${k}`);
      assert.ok(ratio(v['accent-ink'], v.accent) >= min, `${theme} : texte sur l'accent`);
      // Contours (3:1 au moins) ; le halo de la lignée directe se distingue par sa luminosité
      for (const k of ['male', 'female', 'halo']) assert.ok(ratio(v[k], v.surface) >= 3, `${theme} : --${k}`);
      for (const k of ['male', 'female']) assert.ok(ratio(v.halo, v[k]) >= 2, `${theme} : halo et --${k}`);
      assert.match(css, new RegExp(`:root\\[data-theme="${theme}"\\] :focus-visible`), `${theme} : focus`);
    }
  });
});
