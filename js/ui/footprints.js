/**
 * Thème « Carte du Maraudeur » : des empreintes rouges cheminent sur la toile, chaque trajet suivi
 * d'un petit parchemin au nom d'une personne de l'arbre, comme sur la carte du roman. Chaque trajet a
 * son départ, sa direction, sa courbure et sa longueur, tirés au hasard ; ses pas s'impriment l'un
 * après l'autre puis s'effacent (animation step-print, css/tokens.css). Rien ne se répète d'un
 * endroit à l'autre, contrairement à un motif de fond. Arrêté hors de ce thème ou si le système
 * demande moins d'animations (les empreintes sont alors fixes, dans le fond).
 */
import { reduced } from '../config.js';
import { S } from '../state.js';
import { fullName } from '../model/people.js';

const NS = 'http://www.w3.org/2000/svg';
const EVERY = 2200;       // un nouveau trajet toutes les … ms
const STEP = 380;         // ms entre deux pas
const STRIDE = 26;        // px entre deux pas
const LIFE = 6500;        // durée de vie d'un pas (animation step-print)
const FOOT = ['M0-9c3.2 0 4.4 3.4 4 6.4-.4 2.6-1.8 4-4 4s-3.4-1.6-3.6-4.2C.2-5.6-3.2-9 0-9z', 'M3 6.6a2.7 3 0 1 1-5.4 0a2.7 3 0 1 1 5.4 0z'];

let timer = null;
let layer = null;

const rand = (a, b) => a + Math.random() * (b - a);

/** Un pas : semelle et talon, tournés de `angle` degrés, pied gauche en miroir. */
function foot(x, y, angle, left, delay) {
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'step');
  g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(0)}) scale(${left ? -1 : 1} 1)`);
  g.style.animationDelay = `${delay}ms`;
  for (const d of FOOT) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    g.append(path);
  }
  return g;
}

/** Parchemin au nom d'une personne de l'arbre, tirée au hasard ; vide si l'arbre est vide. */
function nameTag() {
  const people = [...S.people.values()];
  if (!people.length) return null;
  const name = fullName(people[Math.floor(Math.random() * people.length)]);
  const half = name.length * 3.3 + 9;
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'step-name');
  const scroll = document.createElementNS(NS, 'path');
  scroll.setAttribute('d', `M${-half} -9H${half}l-5 9 5 9H${-half}l5-9z`);
  const text = document.createElementNS(NS, 'text');
  text.setAttribute('y', '4');
  text.setAttribute('text-anchor', 'middle');
  text.textContent = name;
  g.append(scroll, text);
  return g;
}

/** Un trajet au hasard dans la zone visible : il tourne peu à peu, puis ses pas s'effacent. */
function walk() {
  if (document.hidden) return;
  const svg = layer.firstChild;
  const canvas = layer.parentElement;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  svg.setAttribute('width', w);
  svg.setAttribute('height', h);
  let x = rand(0.05, 0.95) * w;
  let y = rand(0.05, 0.95) * h;
  let heading = rand(0, 360);
  const turn = rand(-7, 7); // degrés par pas : une courbe douce
  const steps = Math.round(rand(5, 11));
  const trail = document.createElementNS(NS, 'g');
  const tag = nameTag();
  for (let i = 0; i < steps; i++) {
    const rad = (heading * Math.PI) / 180;
    const side = i % 2 ? 1 : -1;
    trail.append(foot(x + Math.cos(rad) * 5 * side, y + Math.sin(rad) * 5 * side, heading, side < 0, i * STEP));
    // Le parchemin suit les pas, juste au-dessus
    if (tag) setTimeout((at) => tag.setAttribute('transform', at), i * STEP, `translate(${x.toFixed(1)} ${(y - 24).toFixed(1)})`);
    x += Math.sin(rad) * STRIDE;
    y -= Math.cos(rad) * STRIDE;
    heading += turn;
  }
  if (tag) {
    trail.append(tag);
    setTimeout(() => tag.setAttribute('class', 'step-name on'), 0);
    setTimeout(() => tag.setAttribute('class', 'step-name'), steps * STEP + LIFE * 0.5);
  }
  svg.append(trail);
  setTimeout(() => trail.remove(), steps * STEP + LIFE);
}

/** Lance (`on`) ou arrête les empreintes. */
export function setFootprints(on) {
  const canvas = document.getElementById('canvas');
  const can = on && !reduced && canvas && typeof document.createElementNS === 'function';
  if (!can) {
    clearInterval(timer);
    timer = null;
    if (layer) layer.remove();
    layer = null;
    return;
  }
  if (timer) return;
  layer = document.createElement('div');
  layer.className = 'steps';
  layer.setAttribute('aria-hidden', 'true');
  layer.append(document.createElementNS(NS, 'svg'));
  canvas.prepend(layer);
  walk();
  timer = setInterval(walk, EVERY);
}
