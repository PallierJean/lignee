/**
 * Thème « Noël » : la neige tombe sur la toile, sous l'arbre, et une guirlande lumineuse pend
 * en haut. Les flocons ont chacun leur taille, leur vitesse et leur balancement (les plus gros,
 * plus proches, tombent plus vite) ; quelques-uns sont des cristaux à six branches. Les ampoules
 * de la guirlande s'allument par vagues. Arrêté hors de ce thème ou si le système demande moins
 * d'animations (le motif de flocons du fond reste), en pause quand l'onglet est caché.
 */
import { reduced } from '../config.js';

const FRAME = 40;                 // ms entre deux images
const DENSITY = 1 / 7000;         // flocons par pixel de toile
const BULBS = ['#FF4D4D', '#FFD45C', '#4DDB7A', '#5CB8FF'];
const GAP = 46;                   // px entre deux ampoules

let layer = null;
let timer = null;
let flakes = [];

const rand = (a, b) => a + Math.random() * (b - a);

/** Un flocon, en haut (`top`) ou n'importe où dans la hauteur `h`. */
function flake(w, h, top) {
  const r = rand(0.8, 3.6);
  return {
    x: rand(0, w), y: top ? rand(-20, 0) : rand(0, h), r,
    speed: 0.25 + r * 0.32, sway: rand(0.4, 1.4), phase: rand(0, 2 * Math.PI),
    crystal: r > 2.8 && Math.random() < 0.6, spin: rand(0, Math.PI),
  };
}

/** Cristal à six branches, chacune avec deux petites barbes. */
function crystal(ctx, f) {
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.rotate(f.spin);
  ctx.beginPath();
  const len = f.r * 2.4;
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -len);
    ctx.moveTo(0, -len * 0.55);
    ctx.lineTo(len * 0.25, -len * 0.75);
    ctx.moveTo(0, -len * 0.55);
    ctx.lineTo(-len * 0.25, -len * 0.75);
  }
  ctx.stroke();
  ctx.restore();
}

/** La guirlande : un fil qui pend entre des attaches, des ampoules qui s'allument par vagues. */
function garland(ctx, w, now) {
  const span = 260;
  ctx.strokeStyle = 'rgba(20, 40, 28, .9)';
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  for (let x0 = 0; x0 < w; x0 += span) {
    ctx.moveTo(x0, 4);
    ctx.quadraticCurveTo(x0 + span / 2, 34, x0 + span, 4);
  }
  ctx.stroke();
  for (let x = GAP / 2, i = 0; x < w; x += GAP, i++) {
    const t = (x % span) / span;
    const y = 4 + 60 * t * (1 - t); // sur le fil (courbe de Bézier : 4 px aux attaches, 19 px au milieu)
    const color = BULBS[i % BULBS.length];
    const lit = 0.35 + 0.65 * Math.max(0, Math.sin(now / 600 - i * 0.7));
    ctx.globalAlpha = lit;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14 * lit;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y + 5, 3.6, 5.2, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#2A3A2E';
    ctx.fillRect(x - 2, y - 1, 4, 3);
  }
}

/** Une image : les flocons descendent en se balançant ; ceux sortis par le bas repartent d'en haut. */
function frame() {
  if (document.hidden) return;
  const canvas = layer.firstChild;
  const box = layer.parentElement;
  const w = box.clientWidth;
  const h = box.clientHeight;
  const ratio = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const count = Math.round(w * h * DENSITY);
    flakes = Array.from({ length: count }, () => flake(w, h, false));
  }
  const now = Date.now();
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255, 255, 255, .85)';
  ctx.strokeStyle = 'rgba(255, 255, 255, .85)';
  ctx.lineWidth = 0.9;
  ctx.shadowColor = 'rgba(255, 255, 255, .8)';
  for (const [i, f] of flakes.entries()) {
    f.y += f.speed;
    f.x += Math.sin(now / 900 * f.sway + f.phase) * 0.35;
    f.spin += 0.004 * f.sway;
    if (f.y > h + 10) flakes[i] = flake(w, h, true);
    ctx.shadowBlur = f.r * 1.5;
    if (f.crystal) crystal(ctx, f);
    else {
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
  garland(ctx, w, now);
}

/** Lance (`on`) ou arrête la neige et la guirlande. */
export function setSnow(on) {
  const box = document.getElementById('canvas');
  const can = on && !reduced && box && typeof document.createElement('canvas').getContext === 'function';
  if (!can) {
    clearInterval(timer);
    timer = null;
    if (layer) layer.remove();
    layer = null;
    return;
  }
  if (layer) return;
  layer = document.createElement('div');
  layer.className = 'snow';
  layer.setAttribute('aria-hidden', 'true');
  layer.append(document.createElement('canvas'));
  box.prepend(layer);
  flakes = [];
  frame();
  timer = setInterval(frame, FRAME);
}
