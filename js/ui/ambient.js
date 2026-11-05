/**
 * Animations des thèmes « fêtes et saisons », dessinées sur un calque sous l'arbre : neige et
 * guirlande à Noël, chauves-souris et fantômes à Halloween, pétales et papillons au printemps,
 * aigrettes de pissenlit, papillons et éclats de soleil l'été, feuilles et coups de vent en
 * automne. Chaque objet a sa taille, sa vitesse et son balancement, tirés au hasard. Arrêtées hors
 * de ces thèmes ou si le système demande moins d'animations (le motif du fond reste), en pause
 * quand l'onglet est caché.
 */
import { reduced } from '../config.js';

const FRAME = 40;   // ms entre deux images
const TAU = 2 * Math.PI;

let layer = null;
let timer = null;
let scene = null;   // { name, things, w, h }

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

/* ---------- Ce qui tombe : flocons, pétales, feuilles ---------- */

/** Un objet qui tombe, en haut (`top`) ou n'importe où dans la hauteur `h`. */
function faller(w, h, top, size, colors) {
  const r = rand(...size);
  return {
    x: rand(0, w), y: top ? rand(-30, -5) : rand(0, h), r,
    speed: 0.25 + r * 0.12, sway: rand(0.4, 1.4), phase: rand(0, TAU),
    spin: rand(0, TAU), spinSpeed: rand(-0.04, 0.04), color: pick(colors), crystal: Math.random() < 0.35,
  };
}

/** Fait tomber les objets ; ceux sortis par le bas repartent d'en haut. `wind` les pousse de côté. */
function fall(list, w, h, now, wind, make) {
  list.forEach((f, i) => {
    f.y += f.speed;
    f.x += Math.sin((now / 900) * f.sway + f.phase) * 0.45 + wind * (0.6 + f.r * 0.08);
    f.spin += f.spinSpeed;
    if (f.y > h + 20 || f.x < -40 || f.x > w + 40) list[i] = make(true);
  });
}

/** Cristal de neige à six branches, chacune avec deux petites barbes. */
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

/** Pétale de cerisier : deux lobes arrondis et une encoche ; il se retourne en tombant. */
function petal(ctx, f, now) {
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.rotate(f.spin);
  ctx.scale(1, Math.max(0.25, Math.abs(Math.cos(now / 500 + f.phase))));
  const s = f.r;
  ctx.fillStyle = f.color;
  ctx.beginPath();
  ctx.moveTo(0, s);
  ctx.bezierCurveTo(-s * 1.2, s * 0.2, -s * 0.9, -s, -s * 0.2, -s * 0.9);
  ctx.lineTo(0, -s * 0.55);
  ctx.lineTo(s * 0.2, -s * 0.9);
  ctx.bezierCurveTo(s * 0.9, -s, s * 1.2, s * 0.2, 0, s);
  ctx.fill();
  ctx.restore();
}

/** Feuille d'automne : limbe pointu et nervure ; elle tourne et se retourne. */
function leaf(ctx, f, now) {
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.rotate(f.spin);
  ctx.scale(Math.max(0.3, Math.abs(Math.cos(now / 700 + f.phase))), 1);
  const s = f.r;
  ctx.fillStyle = f.color;
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.4);
  ctx.bezierCurveTo(s, -s * 0.8, s * 1.1, s * 0.4, 0, s * 1.2);
  ctx.bezierCurveTo(-s * 1.1, s * 0.4, -s, -s * 0.8, 0, -s * 1.4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 245, 225, .45)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.2);
  ctx.lineTo(0, s * 1.6);
  ctx.stroke();
  ctx.restore();
}

/* ---------- Ce qui vole : papillons, chauves-souris, fantômes, aigrettes ---------- */

/** Un objet qui traverse la toile d'un bord à l'autre, en ondulant. */
function flyer(w, h, speed, size) {
  const right = Math.random() < 0.5;
  return {
    x: right ? -30 : w + 30, y: rand(0.08, 0.9) * h, dir: right ? 1 : -1,
    speed: rand(...speed), wave: rand(10, 40), period: rand(1200, 2600), phase: rand(0, TAU),
    r: rand(...size), born: Date.now(),
  };
}

/** Avance un objet volant ; renvoie sa position du moment, ou null s'il est sorti. */
function fly(b, now, w) {
  b.x += b.dir * b.speed;
  if (b.x < -60 || b.x > w + 60) return null;
  return [b.x, b.y + Math.sin(now / b.period * TAU + b.phase) * b.wave];
}

/** Papillon : quatre ailes qui battent (vues de dessus, elles se replient). */
function butterfly(ctx, x, y, b, now) {
  const flap = Math.abs(Math.sin(now / 90 + b.phase));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(b.dir * 0.25);
  ctx.fillStyle = b.color;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side * (0.25 + 0.75 * flap), 1);
    ctx.beginPath();
    ctx.ellipse(b.r * 0.7, -b.r * 0.45, b.r * 0.8, b.r * 0.6, -0.5, 0, TAU);
    ctx.ellipse(b.r * 0.55, b.r * 0.45, b.r * 0.55, b.r * 0.42, 0.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#3A2A1E';
  ctx.fillRect(-0.8, -b.r * 0.8, 1.6, b.r * 1.6);
  ctx.restore();
}

/** Chauve-souris : ailes festonnées qui battent, petites oreilles. */
function bat(ctx, x, y, b, now) {
  const f = Math.sin(now / 80 + b.phase);
  const s = b.r / 14;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * b.dir, s);
  ctx.fillStyle = '#0B0612';
  ctx.shadowColor = 'rgba(177, 138, 224, .55)';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-6, -4 - 6 * f, -15, -2 - 9 * f);
  ctx.quadraticCurveTo(-11, 1, -8, 3);
  ctx.quadraticCurveTo(-5, 1, -3, 4);
  ctx.lineTo(0, 2);
  ctx.lineTo(3, 4);
  ctx.quadraticCurveTo(5, 1, 8, 3);
  ctx.quadraticCurveTo(11, 1, 15, -2 - 9 * f);
  ctx.quadraticCurveTo(6, -4 - 6 * f, 0, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 1, 2.4, 3.8, 0, 0, TAU);
  ctx.moveTo(-2, -2);
  ctx.lineTo(-1.2, -4.5);
  ctx.lineTo(-0.3, -2.5);
  ctx.moveTo(2, -2);
  ctx.lineTo(1.2, -4.5);
  ctx.lineTo(0.3, -2.5);
  ctx.fill();
  ctx.restore();
}

/** Fantôme : il monte en ondulant, translucide, puis s'évanouit. */
function ghost(ctx, g, now, h) {
  const age = (now - g.born) / g.life;
  if (age > 1) return false;
  const alpha = Math.sin(age * Math.PI) * 0.55;
  const x = g.x + Math.sin(now / 700 + g.phase) * 10;
  const y = g.y - age * h * 0.35;
  const r = g.r;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.fillStyle = '#F4ECFF';
  ctx.shadowColor = '#D9C8FF';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, 0);
  ctx.lineTo(r, r * 1.3);
  for (let i = 0; i < 4; i++) {
    const x0 = r - (i + 1) * (r / 2);
    ctx.quadraticCurveTo(x0 + r / 4, r * (1.3 + (i % 2 ? -0.25 : 0.25)) + Math.sin(now / 200 + i) * 2, x0, r * 1.3);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#2A1E38';
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.1, r * 0.16, r * 0.24, 0, 0, TAU);
  ctx.ellipse(r * 0.35, -r * 0.1, r * 0.16, r * 0.24, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  return true;
}

/** Aigrette de pissenlit : une tige et une couronne de filaments, portée par le vent. */
function seed(ctx, s, now) {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(Math.sin(now / 1100 + s.phase) * 0.4);
  ctx.strokeStyle = 'rgba(110, 92, 60, .55)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, s.r * 1.6);
  for (let a = -2.4; a <= -0.7; a += 0.28) {
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * s.r, Math.sin(a) * s.r);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(110, 92, 60, .6)';
  ctx.beginPath();
  ctx.ellipse(0, s.r * 1.7, 0.9, 1.6, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Éclat de soleil : une petite étoile dorée qui scintille un instant. */
function glint(ctx, g, now) {
  const age = (now - g.born) / 1400;
  if (age > 1) return false;
  const len = Math.sin(age * Math.PI) * g.r;
  ctx.save();
  ctx.strokeStyle = `rgba(240, 160, 32, ${(Math.sin(age * Math.PI) * 0.8).toFixed(2)})`;
  ctx.shadowColor = '#F0A020';
  ctx.shadowBlur = 8;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(g.x - len, g.y);
  ctx.lineTo(g.x + len, g.y);
  ctx.moveTo(g.x, g.y - len);
  ctx.lineTo(g.x, g.y + len);
  ctx.stroke();
  ctx.restore();
  return true;
}

/* ---------- Noël : la guirlande ---------- */

const BULBS = ['#FF4D4D', '#FFD45C', '#4DDB7A', '#5CB8FF'];

/** La guirlande : un fil qui pend entre des attaches, des ampoules qui s'allument par vagues. */
function garland(ctx, w, now) {
  const span = 260;
  ctx.strokeStyle = 'rgba(20, 40, 28, .9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x0 = 0; x0 < w; x0 += span) {
    ctx.moveTo(x0, 4);
    ctx.quadraticCurveTo(x0 + span / 2, 34, x0 + span, 4);
  }
  ctx.stroke();
  for (let x = 23, i = 0; x < w; x += 46, i++) {
    const t = (x % span) / span;
    const y = 4 + 60 * t * (1 - t); // sur le fil (courbe de Bézier : 4 px aux attaches, 19 px au milieu)
    const color = BULBS[i % BULBS.length];
    const lit = 0.35 + 0.65 * Math.max(0, Math.sin(now / 600 - i * 0.7));
    ctx.save();
    ctx.globalAlpha = lit;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14 * lit;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y + 5, 3.6, 5.2, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#2A3A2E';
    ctx.fillRect(x - 2, y - 1, 4, 3);
  }
}

/* ---------- Les scènes ---------- */

const WINGS = ['#E58CB0', '#9CC8F0', '#F2C94C', '#B79AE0'];

/** Lâche de temps en temps un objet volant dans la liste, jusqu'à `max`. */
function release(list, max, chance, make) {
  if (list.length < max && Math.random() < chance) list.push(make());
}

const SCENES = {
  noel: {
    make: (w, h) => ({ fall: Array.from({ length: Math.round((w * h) / 7000) }, () => faller(w, h, false, [0.8, 3.6], ['#FFFFFF'])) }),
    draw(ctx, s, now, w, h) {
      fall(s.fall, w, h, now, 0, (top) => faller(w, h, top, [0.8, 3.6], ['#FFFFFF']));
      ctx.fillStyle = 'rgba(255, 255, 255, .85)';
      ctx.strokeStyle = 'rgba(255, 255, 255, .85)';
      ctx.lineWidth = 0.9;
      ctx.shadowColor = 'rgba(255, 255, 255, .8)';
      for (const f of s.fall) {
        ctx.shadowBlur = f.r * 1.5;
        if (f.crystal && f.r > 2.8) crystal(ctx, f);
        else {
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, TAU);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
      garland(ctx, w, now);
    },
  },
  halloween: {
    make: () => ({ bats: [], ghosts: [] }),
    draw(ctx, s, now, w, h) {
      release(s.bats, 5, 0.02, () => flyer(w, h, [1.6, 3.2], [9, 18]));
      s.bats = s.bats.filter((b) => {
        const at = fly(b, now, w);
        if (at) bat(ctx, ...at, b, now);
        return !!at;
      });
      release(s.ghosts, 2, 0.006, () => ({ x: rand(0.1, 0.9) * w, y: rand(0.55, 0.95) * h, r: rand(11, 18), born: now, life: rand(6000, 9000), phase: rand(0, TAU) }));
      s.ghosts = s.ghosts.filter((g) => ghost(ctx, g, now, h));
    },
  },
  printemps: {
    make: (w, h) => ({ fall: Array.from({ length: Math.round((w * h) / 16000) }, () => faller(w, h, false, [3, 6], ['#F6B7C8', '#F9D3DE', '#FFFFFF', '#F2A7C3'])), flies: [] }),
    draw(ctx, s, now, w, h) {
      fall(s.fall, w, h, now, 0.15, (top) => faller(w, h, top, [3, 6], ['#F6B7C8', '#F9D3DE', '#FFFFFF', '#F2A7C3']));
      ctx.shadowColor = 'rgba(180, 80, 120, .25)';
      ctx.shadowBlur = 3;
      for (const f of s.fall) petal(ctx, f, now);
      ctx.shadowBlur = 0;
      release(s.flies, 2, 0.006, () => ({ ...flyer(w, h, [0.7, 1.4], [6, 9]), color: pick(WINGS) }));
      s.flies = s.flies.filter((b) => {
        const at = fly(b, now, w);
        if (at) butterfly(ctx, ...at, b, now);
        return !!at;
      });
    },
  },
  ete: {
    make: (w, h) => ({ seeds: Array.from({ length: Math.round((w * h) / 45000) }, () => ({ ...faller(w, h, false, [5, 8], ['#000']), speed: rand(-0.25, 0.1) })), flies: [], glints: [] }),
    draw(ctx, s, now, w, h) {
      // Les aigrettes flottent, montent un peu, poussées par une brise
      s.seeds.forEach((f, i) => {
        f.y += f.speed + Math.sin(now / 1500 + f.phase) * 0.2;
        f.x += 0.35 + Math.sin(now / 1200 * f.sway + f.phase) * 0.3;
        if (f.x > w + 30 || f.y < -30 || f.y > h + 30) s.seeds[i] = { ...faller(w, h, false, [5, 8], ['#000']), x: -20, speed: rand(-0.25, 0.1) };
        seed(ctx, f, now);
      });
      release(s.flies, 2, 0.005, () => ({ ...flyer(w, h, [0.7, 1.4], [6, 9]), color: pick(WINGS) }));
      s.flies = s.flies.filter((b) => {
        const at = fly(b, now, w);
        if (at) butterfly(ctx, ...at, b, now);
        return !!at;
      });
      release(s.glints, 4, 0.03, () => ({ x: rand(0, w), y: rand(0, h), r: rand(5, 10), born: now }));
      s.glints = s.glints.filter((g) => glint(ctx, g, now));
    },
  },
  automne: {
    make: (w, h) => ({ fall: Array.from({ length: Math.round((w * h) / 20000) }, () => faller(w, h, false, [4, 8], ['#C8642A', '#D9A13B', '#9C4A2A', '#B5651D', '#A83F1E'])) }),
    draw(ctx, s, now, w, h) {
      // Coups de vent : la brise forcit puis retombe
      const wind = Math.max(0, Math.sin(now / 4000)) ** 3 * 2.2;
      fall(s.fall, w, h, now, wind, (top) => faller(w, h, top, [4, 8], ['#C8642A', '#D9A13B', '#9C4A2A', '#B5651D', '#A83F1E']));
      ctx.shadowColor = 'rgba(80, 40, 10, .25)';
      ctx.shadowBlur = 3;
      for (const f of s.fall) leaf(ctx, f, now);
      ctx.shadowBlur = 0;
    },
  },
};

/** Une image de la scène en cours. */
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
    scene.state = SCENES[scene.name].make(w, h);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, w, h);
  SCENES[scene.name].draw(ctx, scene.state, Date.now(), w, h);
}

/** Lance l'animation du thème `theme` s'il en a une, sinon l'arrête. */
export function setAmbient(theme) {
  const box = document.getElementById('canvas');
  const can = SCENES[theme] && !reduced && box && typeof box.prepend === 'function'
    && typeof document.createElement('canvas').getContext === 'function';
  if (!can) {
    clearInterval(timer);
    timer = null;
    if (layer) layer.remove();
    layer = null;
    scene = null;
    return;
  }
  if (scene && scene.name === theme) return;
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'ambient';
    layer.setAttribute('aria-hidden', 'true');
    layer.append(document.createElement('canvas'));
    box.prepend(layer);
    timer = setInterval(frame, FRAME);
  }
  const canvas = layer.firstChild;
  canvas.width = 0; // nouvelle scène : préparée à la première image
  scene = { name: theme, state: null };
  frame();
}
