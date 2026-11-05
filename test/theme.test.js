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
    const css = ['tokens', 'themes'].map((f) => readFileSync(new URL(`../css/${f}.css`, import.meta.url), 'utf8')).join('\n');
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
    // Thèmes illustrés : texte lisible (AA) sur les panneaux, et sur le fond pour le texte principal
    const illustrated = readFileSync(new URL('../css/themes.css', import.meta.url), 'utf8');
    const blocks = [...illustrated.matchAll(/:root\[data-theme="([\w-]+)"\] \{([^}]*--paper[^}]*)\}/g)];
    assert.equal(blocks.length, 3, 'trois thèmes illustrés');
    for (const [, theme, block] of blocks) {
      const tv = Object.fromEntries([...block.matchAll(/--([\w-]+): (#[0-9A-F]{6});/gi)].map((m) => [m[1], m[2]]));
      for (const k of ['ink', 'muted', 'warn', 'danger', 'ok']) assert.ok(ratio(tv[k], tv.surface) >= 4.5, `${theme} : --${k}`);
      assert.ok(ratio(tv.ink, tv.paper) >= 4.5, `${theme} : texte sur le fond`);
      assert.ok(ratio(tv['accent-ink'], tv.accent) >= 4.5, `${theme} : texte sur l’accent`);
    }

    // Carte du Maraudeur : parchemin lisible (AA), police à l'ancienne servie par le site
    const fonts = readFileSync(new URL('../css/fonts.css', import.meta.url), 'utf8');
    assert.match(fonts, /font-family: 'IM Fell English';[\s\S]*?src: url\('\.\.\/assets\/fonts\/im-fell-english-normal-latin\.woff2'\)/);
    const parchment = css.match(/:root\[data-theme="maraudeur"\] \{([^}]*)\}/)[1];
    assert.match(parchment, /--f-display: "IM Fell English"/);
    const pv = Object.fromEntries([...parchment.matchAll(/--([\w-]+): (#[0-9A-F]{6});/gi)].map((m) => [m[1], m[2]]));
    for (const k of ['ink', 'muted', 'warn', 'danger', 'ok']) assert.ok(ratio(pv[k], pv.surface) >= 4.5, `maraudeur : --${k}`);
    assert.ok(ratio(pv['accent-ink'], pv.accent) >= 4.5, 'maraudeur : texte sur l’accent');

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

describe('empreintes du thème Maraudeur', () => {
  test('trajets au hasard, pas imprimés l’un après l’autre, arrêtés hors du thème', async () => {
    const { setFootprints } = await import('../js/ui/footprints.js');
    // Faux éléments SVG : juste ce que le module utilise
    const make = (tag) => {
      const el = {
        tag, attrs: {}, style: {}, children: [], parentElement: null,
        setAttribute(k, v) { el.attrs[k] = String(v); },
        append(c) { c.parentElement = el; el.children.push(c); },
        prepend(c) { c.parentElement = el; el.children.unshift(c); },
        remove() { if (el.parentElement) el.parentElement.children.splice(el.parentElement.children.indexOf(el), 1); },
        get firstChild() { return el.children[0]; },
      };
      return el;
    };
    const canvas = Object.assign(make('div'), { clientWidth: 800, clientHeight: 600 });
    const saved = { create: document.createElement, ns: document.createElementNS, byId: document.getElementById };
    Object.assign(document, {
      createElement: make, createElementNS: (ns, tag) => make(tag), getElementById: (id) => (id === 'canvas' ? canvas : saved.byId(id)),
    });
    try {
      setFootprints(true);
      const layer = canvas.children[0];
      assert.equal(layer.className, 'steps');
      const svg = layer.firstChild;
      assert.equal(svg.attrs.width, '800');
      const [trail] = svg.children;
      const steps = trail.children;
      assert.ok(steps.length >= 5 && steps.length <= 11);
      assert.deepEqual(steps.map((s) => s.style.animationDelay), steps.map((s, i) => `${i * 380}ms`), 'un pas après l’autre');
      assert.match(steps[0].attrs.transform, /^translate\([\d.-]+ [\d.-]+\) rotate\(-?\d+\) scale\(-1 1\)$/, 'pied gauche en miroir');
      // Deux trajets ne partent pas du même endroit
      setFootprints(false);
      setFootprints(true);
      const other = canvas.children[0].firstChild.children[0].children[0].attrs.transform;
      assert.notEqual(other, steps[0].attrs.transform);
      setFootprints(false);
      assert.equal(canvas.children.length, 0, 'calque retiré hors du thème');
    } finally {
      Object.assign(document, { createElement: saved.create, createElementNS: saved.ns, getElementById: saved.byId });
    }
  });
});

describe('ciel du thème Constellations : le vrai ciel de Bordeaux', () => {
  test('positions des étoiles vues de Bordeaux, selon la saison', async () => {
    const { horizontal, skyAt, siderealDeg } = await import('../js/model/sky.js');
    const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what} : ${a.toFixed(1)} au lieu de ${b}`);
    // Temps sidéral de Greenwich le 1er janvier 2000 à 12 h TU : 280,46°
    close(siderealDeg(new Date('2000-01-01T12:00:00Z'), 0), 280.46, 0.01, 'temps sidéral');
    // La Polaire, à la hauteur de la latitude de Bordeaux, toute l'année
    for (const iso of ['2027-01-15T21:00:00Z', '2026-08-15T20:00:00Z']) close(horizontal(2.53, 89.26, new Date(iso)).alt, 44.84, 1, 'Polaire');
    // Orion haut au sud un soir d'hiver, couché un soir d'été ; Véga presque au zénith en août
    const winter = horizontal(5.92, 7.41, new Date('2027-01-15T21:00:00Z'));
    assert.ok(winter.alt > 40 && winter.az > 130 && winter.az < 180, 'Bételgeuse en janvier');
    assert.ok(horizontal(5.92, 7.41, new Date('2026-07-15T20:00:00Z')).alt < 0, 'Bételgeuse en juillet');
    assert.ok(horizontal(18.62, 38.78, new Date('2026-08-15T20:00:00Z')).alt > 70, 'Véga en août');
    // Antarès ne monte jamais haut à Bordeaux (90 − 44,84 − 26,43 = 18,7° au plus)
    assert.ok(horizontal(16.49, -26.43, new Date('2026-06-15T21:30:00Z')).alt < 19);
    // Toutes les constellations, avec leurs étoiles et des traits entre étoiles connues
    const sky = skyAt(new Date('2027-01-15T21:00:00Z'));
    assert.ok(sky.length >= 25);
    for (const c of sky) for (const line of c.lines) for (const key of line) assert.ok(c.stars[key], `${c.fr} : ${key}`);
    assert.ok(sky.find((c) => c.fr === 'Orion').stars.bet.alt > 40);
  });

  test('ciel dessiné sous l’arbre : étoiles, traits, noms, légende ; retiré hors du thème', async () => {
    const { setSky } = await import('../js/ui/sky.js');
    const calls = [];
    const ctx = new Proxy({}, {
      get: (target, key) => (key in target ? target[key] : (...args) => calls.push([key, ...args])),
      set: (target, key, value) => { target[key] = value; return true; },
    });
    ctx.createLinearGradient = () => ({ addColorStop() {} });
    const make = (tag) => {
      const el = {
        tag, style: {}, children: [], parentElement: null, width: 0, height: 0,
        setAttribute() {},
        append(c) { c.parentElement = el; el.children.push(c); },
        prepend(c) { c.parentElement = el; el.children.unshift(c); },
        remove() { if (el.parentElement) el.parentElement.children.splice(el.parentElement.children.indexOf(el), 1); },
        get firstChild() { return el.children[0]; },
        getContext: () => ctx,
      };
      return el;
    };
    const box = Object.assign(make('div'), { clientWidth: 900, clientHeight: 600 });
    const saved = { create: document.createElement, byId: document.getElementById };
    Object.assign(document, { createElement: make, getElementById: (id) => (id === 'canvas' ? box : saved.byId(id)) });
    try {
      setSky(true);
      setSky(true); // déjà lancé : un seul ciel
      assert.equal(box.children.length, 1);
      assert.equal(box.children[0].className, 'sky');
      const texts = calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
      assert.ok(calls.filter((c) => c[0] === 'arc').length > 20, 'des dizaines d’étoiles dans le cadre');
      assert.ok(calls.some((c) => c[0] === 'lineTo'), 'les traits des constellations');
      assert.ok(texts.some((x) => /^Ciel de Bordeaux · .+ · .+/.test(x)), 'la légende, à l’heure qu’il est');
      assert.ok(texts.some((x) => /^Ciel de Bordeaux · .+ · .+/.test(x)), 'la légende');
      setSky(false);
      assert.equal(box.children.length, 0);
    } finally {
      Object.assign(document, { createElement: saved.create, getElementById: saved.byId });
    }
  });
});

describe('pluie du thème Matrix', () => {
  test('colonnes de signes retournés qui tombent, retirées hors du thème', async () => {
    const { setRain } = await import('../js/ui/rain.js');
    const drawn = [];
    const ctx = {
      setTransform() {}, fillRect() {}, clearRect() {}, save() {}, restore() {}, translate() {},
      scale(x) { drawn.push(['scale', x]); },
      fillText(t, x, y) { drawn.push(['text', t, y]); },
    };
    const make = (tag) => {
      const el = {
        tag, style: {}, children: [], parentElement: null, width: 0, height: 0,
        setAttribute() {},
        append(c) { c.parentElement = el; el.children.push(c); },
        prepend(c) { c.parentElement = el; el.children.unshift(c); },
        remove() { if (el.parentElement) el.parentElement.children.splice(el.parentElement.children.indexOf(el), 1); },
        get firstChild() { return el.children[0]; },
        getContext: () => ctx,
      };
      return el;
    };
    const box = Object.assign(make('div'), { clientWidth: 160, clientHeight: 320 });
    const saved = { create: document.createElement, byId: document.getElementById };
    Object.assign(document, { createElement: make, getElementById: (id) => (id === 'canvas' ? box : saved.byId(id)) });
    try {
      setRain(true);
      setRain(true); // déjà lancée : une seule pluie
      assert.equal(box.children.length, 1);
      assert.equal(box.children[0].className, 'rain');
      const canvas = box.children[0].firstChild;
      assert.deepEqual([canvas.width, canvas.height], [160, 320], 'à la taille de la zone visible');
      // Quelques images : les colonnes avancent et dessinent des signes retournés (miroir)
      await new Promise((r) => setTimeout(r, 400));
      const texts = drawn.filter((x) => x[0] === 'text');
      assert.ok(texts.length > 0, 'des signes tombent');
      assert.ok(texts.every(([, t]) => t.length === 1));
      assert.ok(drawn.some((x) => x[0] === 'scale' && x[1] === -1));
      setRain(false);
      assert.equal(box.children.length, 0);
    } finally {
      Object.assign(document, { createElement: saved.create, getElementById: saved.byId });
    }
  });
});

describe('animations des thèmes fêtes et saisons', () => {
  test('chaque thème a sa scène ; une seule animation à la fois ; arrêtée hors de ces thèmes', async () => {
    const { setAmbient } = await import('../js/ui/ambient.js');
    const calls = [];
    const ctx = new Proxy({}, {
      get: (target, key) => (key in target ? target[key] : (...args) => calls.push([key, ...args])),
      set: (target, key, value) => { target[key] = value; return true; },
    });
    ctx.createLinearGradient = () => ({ addColorStop() {} });
    ctx.createRadialGradient = () => ({ addColorStop() {} });
    const make = (tag) => {
      const el = {
        tag, style: {}, children: [], parentElement: null, width: 0, height: 0,
        setAttribute() {},
        append(c) { c.parentElement = el; el.children.push(c); },
        prepend(c) { c.parentElement = el; el.children.unshift(c); },
        remove() { if (el.parentElement) el.parentElement.children.splice(el.parentElement.children.indexOf(el), 1); },
        get firstChild() { return el.children[0]; },
        getContext: () => ctx,
      };
      return el;
    };
    const box = Object.assign(make('div'), { clientWidth: 700, clientHeight: 500 });
    const saved = { create: document.createElement, byId: document.getElementById };
    Object.assign(document, { createElement: make, getElementById: (id) => (id === 'canvas' ? box : saved.byId(id)) });
    const random = Math.random;
    try {
      const drawn = (theme) => {
        calls.length = 0;
        setAmbient(theme);
        return new Set(calls.map((c) => c[0]));
      };
      // Noël : flocons et guirlande
      const noel = drawn('noel');
      assert.ok(noel.has('arc') && noel.has('quadraticCurveTo') && noel.has('ellipse'));
      setAmbient('noel'); // même thème : une seule animation
      assert.equal(box.children.length, 1);
      assert.equal(box.children[0].className, 'ambient');
      // Printemps : pétales (courbes) ; automne : arbres (branches) et feuilles ; été : la mer et ses vagues
      assert.ok(drawn('printemps').has('bezierCurveTo'));
      const automne = drawn('automne');
      assert.ok(automne.has('bezierCurveTo') && automne.has('lineTo'));
      const ete = drawn('ete');
      assert.ok(ete.has('lineTo') && ete.has('closePath') && ete.has('arc'), 'mer, rivage et baigneurs');
      // Halloween : chauves-souris et fantômes lâchés au hasard (ici, à coup sûr)
      Math.random = () => 0.001;
      assert.ok(drawn('halloween').has('quadraticCurveTo'));
      Math.random = random;
      assert.equal(box.children.length, 1, 'toujours un seul calque');
      setAmbient('auto');
      assert.equal(box.children.length, 0);
    } finally {
      Math.random = random;
      Object.assign(document, { createElement: saved.create, getElementById: saved.byId });
    }
  });
});
