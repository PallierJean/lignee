/**
 * Thème « Constellations » : des étoiles s'allument et s'éteignent çà et là, et une étoile filante
 * traverse la toile de temps en temps (animations twinkle et shoot, css/themes.css). Positions et
 * directions sont tirées au hasard. Arrêté hors de ce thème ou si le système demande moins
 * d'animations (le ciel du fond reste).
 */
import { reduced } from '../config.js';

const NS = 'http://www.w3.org/2000/svg';
const TWINKLE = 450;       // une étoile qui scintille toutes les … ms
const SHOOT = 7000;        // une étoile filante toutes les … ms (en moyenne)

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
  timers.push(setInterval(twinkle, TWINKLE));
  timers.push(setTimeout(shoot, 1500));
}
