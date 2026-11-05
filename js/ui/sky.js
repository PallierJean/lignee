/**
 * Thème « Constellations » : des constellations naissent çà et là (leurs traits se tracent, leurs
 * étoiles brillent et pulsent, puis elles s'effacent), des étoiles s'allument et s'éteignent, et
 * une étoile filante traverse la toile de temps en temps (animations de css/themes.css). Positions,
 * formes et directions sont tirées au hasard. Arrêté hors de ce thème ou si le système demande
 * moins d'animations (le ciel du fond reste, avec une constellation figée).
 */
import { reduced } from '../config.js';

const NS = 'http://www.w3.org/2000/svg';
const TWINKLE = 450;       // une étoile qui scintille toutes les … ms
const SHOOT = 7000;        // une étoile filante toutes les … ms (en moyenne)
const CONSTEL = 5000;      // une constellation naît toutes les … ms
const LIFE = 15000;        // durée de vie d'une constellation

let timers = [];
let layer = null;

const rand = (a, b) => a + Math.random() * (b - a);

function element(tag, attrs, parent) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  parent.append(el);
  return el;
}

/** Taille de la zone visible ; le calque la suit. */
function area() {
  const svg = layer.firstChild;
  const canvas = layer.parentElement;
  svg.setAttribute('width', canvas.clientWidth);
  svg.setAttribute('height', canvas.clientHeight);
  return [svg, canvas.clientWidth, canvas.clientHeight];
}

/** Une étoile s'allume puis s'éteint, à un endroit au hasard. */
function twinkle() {
  if (document.hidden) return;
  const [svg, w, h] = area();
  const star = element('circle', { class: 'twinkle', cx: rand(0, w).toFixed(0), cy: rand(0, h).toFixed(0), r: rand(0.8, 2).toFixed(1) }, svg);
  setTimeout(() => star.remove(), 3300);
}

/**
 * Une constellation : 4 à 7 étoiles reliées par une ligne brisée qui se trace, la plus brillante
 * ornée d'un éclat ; chaque étoile pulse à son rythme.
 */
/** Forme au hasard : 4 à 7 étoiles, chacune à quelques dizaines de pixels de la précédente. */
function shape(w, h) {
  const pts = [[rand(0.08, 0.92) * w, rand(0.08, 0.92) * h]];
  let heading = rand(0, 2 * Math.PI);
  const count = Math.round(rand(4, 7));
  while (pts.length < count) {
    heading += rand(-1.1, 1.1);
    const [x, y] = pts[pts.length - 1];
    const step = rand(40, 90);
    pts.push([x + Math.cos(heading) * step, y + Math.sin(heading) * step]);
  }
  return pts;
}

/** Parmi quelques formes, celle dont le moins d'étoiles tombent sous une fiche (qui les cacherait). */
function freeShape(w, h) {
  const box = layer.parentElement.getBoundingClientRect();
  const cards = [...layer.parentElement.querySelectorAll('.card, .fan-s')].map((c) => c.getBoundingClientRect())
    .map((r) => [r.left - box.left - 8, r.top - box.top - 8, r.right - box.left + 8, r.bottom - box.top + 8]);
  const hidden = (pts) => pts.filter(([x, y]) => x < 0 || y < 0 || x > w || y > h
    || cards.some(([l, t, r, b]) => x > l && x < r && y > t && y < b)).length;
  let best = null;
  for (let i = 0; i < 14 && (!best || best.n); i++) {
    const pts = shape(w, h);
    const n = hidden(pts);
    if (!best || n < best.n) best = { pts, n };
  }
  return best.pts;
}

function constellation() {
  if (document.hidden) return;
  const [svg, w, h] = area();
  const pts = freeShape(w, h);
  const count = pts.length;
  const g = element('g', { class: 'constel' }, svg);
  g.style.setProperty('--life', `${LIFE}ms`);
  const len = pts.slice(1).reduce((s, [x, y], i) => s + Math.hypot(x - pts[i][0], y - pts[i][1]), 0);
  const line = element('path', { class: 'constel-line', d: 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') }, g);
  line.style.setProperty('--len', len.toFixed(0));
  const bright = Math.floor(rand(0, count));
  pts.forEach(([x, y], i) => {
    const star = element('circle', { class: 'constel-star', cx: x.toFixed(1), cy: y.toFixed(1), r: (i === bright ? 3.4 : rand(2, 2.8)).toFixed(1) }, g);
    star.style.animationDelay = `${(-rand(0, 2.2)).toFixed(2)}s`;
    if (i === bright) element('path', { class: 'constel-flare', d: `M${x - 11} ${y}H${x + 11}M${x} ${y - 11}V${y + 11}` }, g);
  });
  setTimeout(() => g.remove(), LIFE + 200);
}

/** Une étoile filante : une traînée qui file en biais, dans une direction au hasard. */
function shoot() {
  if (!document.hidden) {
    const [svg, w, h] = area();
    const angle = rand(15, 40) * (Math.random() < 0.5 ? 1 : -1) + (Math.random() < 0.5 ? 0 : 180);
    const g = element('g', { transform: `translate(${rand(0.15, 0.85) * w} ${rand(0.1, 0.6) * h}) rotate(${angle.toFixed(0)})` }, svg);
    const trail = element('g', { class: 'shoot' }, g);
    element('line', { x1: -90, y1: 0, x2: 0, y2: 0, stroke: 'url(#skyTrail)', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, trail);
    element('circle', { cx: 0, cy: 0, r: 1.8, fill: '#FFFFFF' }, trail);
    setTimeout(() => g.remove(), 1500);
  }
  timers.push(setTimeout(shoot, rand(0.5, 1.5) * SHOOT));
}

/** Lance (`on`) ou arrête le ciel animé. */
export function setSky(on) {
  const canvas = document.getElementById('canvas');
  const can = on && !reduced && canvas && typeof document.createElementNS === 'function';
  if (!can) {
    for (const t of timers) {
      clearTimeout(t);
      clearInterval(t);
    }
    timers = [];
    if (layer) layer.remove();
    layer = null;
    return;
  }
  if (layer) return;
  layer = document.createElement('div');
  layer.className = 'sky';
  layer.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS(NS, 'svg');
  layer.append(svg);
  // Traînée : transparente au départ, blanche à la tête
  const defs = element('defs', {}, svg);
  const grad = element('linearGradient', { id: 'skyTrail', x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
  element('stop', { offset: 0, 'stop-color': '#FFFFFF', 'stop-opacity': 0 }, grad);
  element('stop', { offset: 1, 'stop-color': '#FFFFFF', 'stop-opacity': 0.9 }, grad);
  canvas.prepend(layer);
  constellation(); // avant les minuteurs : une erreur n'en laisse pas un tourner
  timers.push(setInterval(twinkle, TWINKLE));
  timers.push(setInterval(constellation, CONSTEL));
  timers.push(setTimeout(shoot, 1500));
}
