import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { S } from '../js/state.js';
import { fanSize, fanSVG, MAX_FAN_GENS } from '../js/tree/fan.js';
import { fanHover, fanRecenter, renderFanNav } from '../js/ui/fan-hover.js';
import { loadTree, person } from './helpers.js';

describe('roue d’ascendance', () => {
  test('générations comptées, bornées, noms échappés, boucle sans effet', () => {
    loadTree([
      person('a', { given: '<b>', fatherId: 'b', sex: 'M' }), person('b', { fatherId: 'c', sex: 'M' }), person('c'),
    ]);
    S.focus = 'a';
    assert.equal(fanSize().gens, 2);
    assert.ok(fanSVG().includes('&lt;b&gt;'));
    assert.equal((fanSVG().match(/class="fan-s"/g) || []).length, 3);
    // Sans attribut style (interdit par la politique de sécurité) : classes à l'écran, couleurs à l'impression
    assert.ok(!fanSVG().includes('style='));
    assert.match(fanSVG(), /class="fan-sector sx-M"/);
    const ink = { text: '#111', muted: '#555', line: '#ccc', empty: '#eee', M: '#fff', F: '#fff', U: '#fff', stroke: { M: '#00f', F: '#f0f', U: '#ccc' } };
    assert.match(fanSVG(ink), /fill="#fff" stroke="#00f" stroke-width="2"/);

    // Dix générations ; dans les anneaux serrés, prénom et nom sur une seule ligne
    loadTree(Array.from({ length: 11 }, (_, i) => person('g' + i, { given: 'P' + i, surname: 'Nom', fatherId: i < 10 ? 'g' + (i + 1) : null })));
    S.focus = 'g0';
    assert.equal(fanSize().gens, 10);
    assert.match(fanSVG(), />P10 NOM<\/tspan>/);
    assert.match(fanSVG(), />P4<\/tspan>/);
    // Une seule lignée : recadrée sur ses secteurs, sans réserver le demi-disque entier (2876 × 1532)
    assert.deepEqual([fanSize().W, fanSize().H], [1556, 366]);
    loadTree([person('k', { fatherId: 'f', motherId: 'm' }), person('f'), person('m')]);
    S.focus = 'k';
    assert.deepEqual([fanSize().W, fanSize().H], [360, 274], 'roue complète : le demi-disque');

    loadTree([person('a', { fatherId: 'b' }), person('b', { fatherId: 'a' })]);
    S.focus = 'a';
    assert.equal(fanSize().gens, MAX_FAN_GENS);
  });
});

describe('roue d’ascendance : survol et recentrage', () => {
  // Secteur de la roue tel que le voit le navigateur : data-id, data-sosa
  const sector = (id, sosa) => {
    const el = { dataset: { id, sosa: String(sosa) }, contains: () => false, getBoundingClientRect: () => ({ left: 0, top: 0, width: 10, height: 10 }) };
    return { closest: (sel) => (sel === '#fan .fan-s' ? el : null) };
  };

  test('étiquette : nom, Sosa, génération, naissance', () => {
    loadTree([person('a', { fatherId: 'b' }), person('b', { given: 'Jean', surname: 'Roux', birthDate: '1864', birthPlace: 'Lyon (69)', fatherId: 'c' }), person('c')]);
    S.focus = 'a';
    assert.match(fanSVG(), /data-id="b" data-sosa="2"/);
    fanHover(sector('b', 2), true, { clientX: 5, clientY: 5 });
    const tip = document.getElementById('fanTip');
    assert.equal(tip.hidden, false);
    assert.match(tip.innerHTML, /<b>Jean ROUX<\/b><small>Sosa 2 · 1re génération<\/small><span>° 1864, Lyon \(69\)<\/span>/);
    assert.match(tip.innerHTML, /Double-clic : centrer la roue ici/);
    fanHover(sector('b', 2), false, { relatedTarget: null });
    assert.equal(tip.hidden, true);
  });

  test('double-clic : centre sur l’ancêtre, puis au centre revient', () => {
    loadTree([person('a', { fatherId: 'b' }), person('b', { fatherId: 'c' }), person('c')]);
    S.focus = 'a';
    assert.equal(fanRecenter(sector('c', 4)), 'c');
    S.focus = 'c';
    fanHover(sector('c', 1), true, { clientX: 5, clientY: 5 });
    assert.match(document.getElementById('fanTip').innerHTML, /Double-clic : revenir à/);
    assert.equal(fanRecenter(sector('c', 1)), 'a');
    assert.equal(fanRecenter(sector('a', 1)), null, 'plus rien à retrouver');
    assert.equal(fanRecenter({ closest: () => null }), null, 'hors de la roue');
  });

  test('barre : revenir, descendre vers un descendant, aucun ancêtre', () => {
    loadTree([person('a', { fatherId: 'b' }), person('b', { given: 'Léonard', surname: 'Roux' })]);
    S.focus = 'a';
    assert.equal(fanRecenter(sector('b', 2)), 'b');
    S.focus = 'b';
    renderFanNav(true);
    const nav = document.getElementById('fanNav');
    assert.equal(nav.hidden, false);
    assert.match(nav.innerHTML, /data-act="fan-back">← Revenir à /);
    assert.match(nav.innerHTML, /<select class="btn small" id="fanKids"[^>]*><option value="">↓ Descendre vers…<\/option><optgroup label="Enfants \(1\)"><option value="a">/);
    assert.match(nav.innerHTML, /Aucun ancêtre connu/);
    // Plusieurs enfants
    loadTree([person('a', { fatherId: 'b' }), person('c', { fatherId: 'b' }), person('d', { fatherId: 'b' }), person('b')]);
    renderFanNav(true);
    assert.match(nav.innerHTML, /<select class="btn small" id="fanKids"[^>]*><option value="">↓ Descendre vers…<\/option><optgroup label="Enfants \(3\)"><option value="a">/);
    // Tous les descendants, jusqu'au plus lointain, rangés par génération
    loadTree([person('k'), person('e', { fatherId: 'k' }), person('pe', { fatherId: 'e' }), person('ape', { fatherId: 'pe' }), person('g4', { fatherId: 'ape' })]);
    S.focus = 'k';
    renderFanNav(true);
    assert.match(nav.innerHTML, /label="Enfants \(1\)".*label="Petits-enfants \(1\)".*label="Arrière-petits-enfants \(1\)".*label="4e génération \(1\)"><option value="g4">/);
    // Sans descendant : la liste reste, grisée
    S.focus = 'g4';
    renderFanNav(true);
    assert.equal(nav.hidden, false);
    assert.match(nav.innerHTML, /id="fanKids"[^>]* disabled><option value="">↓ Aucun descendant connu<\/option><\/select>/);
    renderFanNav(false);
    assert.equal(nav.hidden, true);
  });
});

describe('éventail : filtres et mode photos', () => {
  const family = () => loadTree([
    person('c', { given: 'Centre', fatherId: 'f', motherId: 'm' }),
    person('f', { given: 'Père', sex: 'M', deceased: true, deathDate: '1990' }),
    person('m', { given: 'Mère', sex: 'F', photo: 'data:image/png;base64,AAAA' }),
  ]);
  const group = (svg, id) => svg.match(new RegExp(`<g class="([^"]*)"[^>]*data-id="${id}"`))[1];

  test('les filtres estompent les secteurs écartés, pas l’impression', () => {
    family();
    S.focus = 'c';
    S.filter = 'living';
    try {
      const svg = fanSVG();
      assert.equal(group(svg, 'f'), 'fan-s is-faded');
      assert.equal(group(svg, 'm'), 'fan-s');
      assert.ok(!fanSVG({ text: '#000', muted: '#000', empty: '#fff', line: '#000', M: '#fff', F: '#fff', U: '#fff', stroke: {} }).includes('is-faded'));
    } finally {
      S.filter = '';
    }
  });

  test('mode photos : une photo ronde par secteur, le nom au survol, le texte à l’impression', () => {
    family();
    S.focus = 'c';
    S.photos = true;
    try {
      const svg = fanSVG();
      assert.ok(svg.includes('<image href="data:image/png;base64,AAAA"'), 'photo de la mère');
      assert.ok(svg.includes('href="images/avatar_homme.jpeg"'), 'avatar du père');
      assert.ok(svg.includes('<title>Père'));
      assert.ok(!svg.includes('<tspan'), 'pas de texte dans les secteurs');
      const printed = fanSVG({ text: '#000', muted: '#000', empty: '#fff', line: '#000', M: '#fff', F: '#fff', U: '#fff', stroke: {} });
      assert.ok(!printed.includes('<image') && printed.includes('<tspan'));
    } finally {
      S.photos = false;
    }
  });
});
