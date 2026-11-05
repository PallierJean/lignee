import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { S, savePrefs, loadPrefs } from '../js/state.js';
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
});
