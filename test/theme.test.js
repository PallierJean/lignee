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
    assert.equal(blocks.length, 4, 'quatre thèmes illustrés');
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

describe('ciel du thème Constellations', () => {
  test('calque d’étoiles, constellation qui se trace et brille, retiré hors du thème', async () => {
    const { setSky } = await import('../js/ui/sky.js');
    const make = (tag) => {
      const el = {
        tag, attrs: {}, style: { setProperty(k, v) { this[k] = v; } }, children: [], parentElement: null,
        setAttribute(k, v) { el.attrs[k] = String(v); },
        append(c) { c.parentElement = el; el.children.push(c); },
        prepend(c) { c.parentElement = el; el.children.unshift(c); },
        remove() { if (el.parentElement) el.parentElement.children.splice(el.parentElement.children.indexOf(el), 1); },
        get firstChild() { return el.children[0]; },
      };
      return el;
    };
    // Une fiche couvre le quart haut gauche : les étoiles l'évitent
    const card = { getBoundingClientRect: () => ({ left: 0, top: 0, right: 400, bottom: 300 }) };
    const canvas = Object.assign(make('div'), {
      clientWidth: 800, clientHeight: 600,
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600 }),
      querySelectorAll: () => [card],
    });
    const saved = { create: document.createElement, ns: document.createElementNS, byId: document.getElementById };
    Object.assign(document, {
      createElement: make, createElementNS: (ns, tag) => make(tag), getElementById: (id) => (id === 'canvas' ? canvas : saved.byId(id)),
    });
    try {
      setSky(true);
      setSky(true); // déjà lancé : un seul calque
      assert.equal(canvas.children.length, 1);
      const layer = canvas.children[0];
      assert.equal(layer.className, 'sky');
      const grad = layer.firstChild.children[0].children[0];
      assert.deepEqual([grad.tag, grad.attrs.id], ['linearGradient', 'skyTrail']);
      // Une constellation dès le départ : un tracé à dessiner, 4 à 7 étoiles qui pulsent, un éclat
      const constel = layer.firstChild.children[1];
      assert.equal(constel.attrs.class, 'constel');
      const [line, ...rest] = constel.children;
      assert.equal(line.attrs.class, 'constel-line');
      assert.ok(+line.style['--len'] > 0, 'longueur du tracé, pour l’animation qui le dessine');
      const stars = rest.filter((x) => x.attrs.class === 'constel-star');
      assert.ok(stars.length >= 4 && stars.length <= 7);
      assert.equal(rest.filter((x) => x.attrs.class === 'constel-flare').length, 1);
      const under = stars.filter((x) => +x.attrs.cx < 408 && +x.attrs.cy < 308).length;
      assert.ok(under <= 1, 'presque toutes les étoiles hors de la fiche');
      setSky(false);
      assert.equal(canvas.children.length, 0);
    } finally {
      Object.assign(document, { createElement: saved.create, createElementNS: saved.ns, getElementById: saved.byId });
    }
  });
});

describe('pluie du thème Matrice', () => {
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
