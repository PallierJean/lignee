/**
 * Animations des thèmes « fêtes et saisons », dessinées sur un calque sous l'arbre : neige et
 * guirlande à Noël, chauves-souris et fantômes à Halloween, pétales et papillons au printemps,
 * la plage l'été (vagues, écume, baigneurs flous, mouettes), et en automne des arbres qui
 * perdent leurs feuilles de couleur, au gré des coups de vent, en un tapis qui s'efface au sol.
 * Chaque objet a sa taille, sa vitesse et son balancement, tirés au hasard. Arrêtées hors de ces
 * thèmes ou si le système demande moins d'animations (le motif du fond reste), en pause quand
 * l'onglet est caché.
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

/* ---------- Ce qui vole : papillons, chauves-souris, fantômes ---------- */

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

/* ---------- Été : la plage ---------- */

/** Mouette : deux ailes en accent circonflexe qui battent. */
function gull(ctx, x, y, b, now) {
  const f = Math.sin(now / 160 + b.phase) * 3;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = 'rgba(70, 70, 75, .7)';
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-b.r, -f);
  ctx.quadraticCurveTo(-b.r / 2, -b.r / 2 - f, 0, 0);
  ctx.quadraticCurveTo(b.r / 2, -b.r / 2 - f, b.r, -f);
  ctx.stroke();
  ctx.restore();
}

/** Baigneur flou : tête et bonnet qui dépassent de l'eau, bercés par les vagues. */
function swimmer(ctx, p, now, horizon, shore) {
  const k = 0.9 + p.depth * 1.1;
  const x = p.x + Math.sin(now / 5000 + p.phase) * 12;
  const y = horizon + (shore - horizon) * (0.15 + p.depth * 0.6) + Math.sin(now / 900 + p.phase) * 2.2 * k;
  ctx.save();
  ctx.filter = `blur(${(1.8 - p.depth).toFixed(1)}px)`;
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = '#B07A5A';
  ctx.beginPath();
  ctx.ellipse(x, y + 4 * k, 7 * k, 3.5 * k, 0, 0, TAU); // épaules, à fleur d'eau
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y - 2 * k, 4.2 * k, 0, TAU);
  ctx.fill();
  ctx.fillStyle = p.cap;
  ctx.beginPath();
  ctx.arc(x, y - 3 * k, 4.4 * k, Math.PI, 0);
  ctx.fill();
  if (p.wave && Math.sin(now / 700 + p.phase) > 0.4) { // un bras qui salue
    ctx.strokeStyle = '#B07A5A';
    ctx.lineWidth = 2 * k;
    ctx.beginPath();
    ctx.moveTo(x + 5 * k, y + 2 * k);
    ctx.lineTo(x + 9 * k, y - 8 * k + Math.sin(now / 150) * 2 * k);
    ctx.stroke();
  }
  ctx.filter = 'none';
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x, y + 4.5 * k, 9 * k, 2 * k, 0, 0, TAU); // remous autour du baigneur
  ctx.stroke();
  ctx.restore();
}

/** La plage : soleil, mer et vagues jusqu'à l'horizon, écume qui va et vient sur le sable. */
function beach(ctx, s, now, w, h) {
  const horizon = h * 0.62;
  const shore = h * 0.9;
  const wash = Math.sin(now / 2600); // la vague monte et redescend sur le sable
  const shoreY = (x) => shore + Math.sin(x / 70 + now / 1400) * 3 + wash * 9;
  // Soleil voilé de lumière
  const sun = ctx.createRadialGradient(w * 0.82, horizon - h * 0.28, 0, w * 0.82, horizon - h * 0.28, 90);
  sun.addColorStop(0, 'rgba(255, 214, 120, .9)');
  sun.addColorStop(0.3, 'rgba(255, 200, 90, .45)');
  sun.addColorStop(1, 'rgba(255, 200, 90, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(w * 0.82 - 90, horizon - h * 0.28 - 90, 180, 180);
  // Mer : du turquoise de l'horizon au bleu du rivage
  const sea = ctx.createLinearGradient(0, horizon, 0, shore);
  sea.addColorStop(0, 'rgba(120, 190, 210, .55)');
  sea.addColorStop(1, 'rgba(46, 140, 176, .6)');
  ctx.fillStyle = sea;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(w, horizon);
  for (let x = w; x >= 0; x -= 12) ctx.lineTo(x, shoreY(x));
  ctx.closePath();
  ctx.fill();
  // Vagues : des lignes d'écume qui ondulent, plus grandes près du rivage
  ctx.strokeStyle = 'rgba(255, 255, 255, .55)';
  for (let k = 0; k < 6; k++) {
    const y0 = horizon + (shore - horizon) * ((k + 0.6) / 6.5);
    const amp = 1 + k * 0.8;
    ctx.lineWidth = 0.6 + k * 0.25;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 10) {
      const y = y0 + Math.sin(x / (40 + k * 12) + now / (1300 - k * 120) + k) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Baigneurs au loin, flous
  for (const p of s.swimmers) swimmer(ctx, p, now, horizon, shore);
  // Sable mouillé et écume du rivage
  ctx.fillStyle = 'rgba(205, 180, 135, .35)';
  ctx.beginPath();
  for (let x = 0; x <= w; x += 12) ctx.lineTo(x, shoreY(x));
  for (let x = w; x >= 0; x -= 12) ctx.lineTo(x, shoreY(x) + 16 - wash * 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, .85)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 12) {
    if (x === 0) ctx.moveTo(x, shoreY(x));
    else ctx.lineTo(x, shoreY(x));
  }
  ctx.stroke();
  // Reflets du soleil sur l'eau, mouettes
  release(s.glints, 5, 0.05, () => ({ x: rand(0, w), y: rand(horizon + 4, shore - 10), r: rand(4, 8), born: now }));
  s.glints = s.glints.filter((g) => glint(ctx, g, now));
  release(s.gulls, 3, 0.006, () => ({ ...flyer(w, h, [0.8, 1.6], [7, 11]), y: rand(0.08, 0.45) * h }));
  s.gulls = s.gulls.filter((b) => {
    const at = fly(b, now, w);
    if (at) gull(ctx, ...at, b, now);
    return !!at;
  });
}

/* ---------- Automne : les arbres ---------- */

const AUTUMN = ['#C8642A', '#D9A13B', '#9C4A2A', '#B5651D', '#A83F1E', '#E3B23C', '#7A8A2E'];

/**
 * Un arbre planté en (x, sol) : tronc et branches qui se ramifient au hasard (traits), et une
 * couronne de feuilles au bout des rameaux, chacune avec sa couleur.
 */
function tree(x, ground, height) {
  const branches = [];
  const leaves = [];
  const grow = (x0, y0, angle, len, width, depth) => {
    const x1 = x0 + Math.cos(angle) * len;
    const y1 = y0 + Math.sin(angle) * len;
    branches.push([x0, y0, x1, y1, width]);
    if (depth === 0) {
      for (let i = 0; i < 10; i++) {
        leaves.push({ x: x1 + rand(-13, 13), y: y1 + rand(-12, 9), r: rand(4, 6), color: pick(AUTUMN), spin: rand(0, TAU), phase: rand(0, TAU), on: true, back: 0 });
      }
      return;
    }
    const forks = depth > 3 ? 2 : pick([2, 3]);
    for (let i = 0; i < forks; i++) {
      const spread = forks === 2 ? (i ? 1 : -1) * rand(0.25, 0.45) : (i - 1) * rand(0.3, 0.5);
      grow(x1, y1, angle + spread + rand(-0.12, 0.12), len * rand(0.68, 0.8), width * 0.68, depth - 1);
    }
  };
  grow(x, ground, -Math.PI / 2 + rand(-0.06, 0.06), height * 0.32, Math.max(5, height / 30), 5);
  return { branches, leaves };
}

/** Dessine un arbre : branches brunes, puis les feuilles encore accrochées (elles frémissent au vent). */
function drawTree(ctx, t, now, wind) {
  ctx.strokeStyle = 'rgba(90, 58, 34, .85)';
  ctx.lineCap = 'round';
  for (const [x0, y0, x1, y1, width] of t.branches) {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  for (const l of t.leaves) {
    if (!l.on) continue;
    const shake = Math.sin(now / 300 + l.phase) * (0.08 + wind * 0.1);
    ctx.save();
    ctx.globalAlpha = Math.min(1, l.back);
    leaf(ctx, { ...l, spin: l.spin + shake }, 0);
    ctx.restore();
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
    make: (w) => ({
      // Surtout sur les côtés, là où les fiches de l'arbre les cachent moins
      swimmers: [0.05, 0.13, 0.22, 0.5, 0.79, 0.88, 0.95].map((at, i) => ({
        x: (at + rand(-0.02, 0.02)) * w, depth: rand(0, 1), phase: rand(0, TAU),
        cap: pick(['#E0483E', '#F2C94C', '#3A7BD5', '#FFFFFF', '#E58CB0']), wave: i === 1 || i === 5,
      })),
      glints: [], gulls: [],
    }),
    draw: (ctx, s, now, w, h) => beach(ctx, s, now, w, h),
  },
  automne: {
    make: (w, h) => ({
      trees: [tree(w * 0.045, h + 4, h * 0.62), tree(w * 0.955, h + 4, h * 0.55)],
      falling: [], ground: [],
      drift: Array.from({ length: Math.round((w * h) / 70000) }, () => faller(w, h, false, [4, 7], AUTUMN)),
    }),
    draw(ctx, s, now, w, h) {
      // Coups de vent : la brise forcit puis retombe
      const wind = Math.max(0, Math.sin(now / 4000)) ** 3 * 2.2;
      for (const t of s.trees) {
        drawTree(ctx, t, now, wind);
        for (const l of t.leaves) {
          // Une feuille repousse peu à peu ; une autre se détache, plus souvent quand il vente
          if (l.on && l.back < 1) l.back += 0.01;
          if (!l.on && now > l.regrow) Object.assign(l, { on: true, back: 0, color: pick(AUTUMN) });
          if (l.on && l.back >= 1 && Math.random() < 0.0009 + wind * 0.002) {
            l.on = false;
            l.regrow = now + rand(15000, 40000);
            s.falling.push({ ...faller(w, h, false, [l.r, l.r], [l.color]), x: l.x, y: l.y, speed: rand(0.6, 1.2) });
          }
        }
      }
      // Les feuilles détachées tombent puis se posent au sol, où elles s'effacent peu à peu
      s.falling = s.falling.filter((f) => {
        f.y += f.speed;
        f.x += Math.sin((now / 900) * f.sway + f.phase) * 0.6 + wind * 0.7;
        f.spin += f.spinSpeed * 2;
        if (f.y < h - rand(2, 10)) return true;
        s.ground.push({ ...f, y: Math.min(f.y, h - 3), landed: now });
        return false;
      });
      if (s.ground.length > 160) s.ground.splice(0, s.ground.length - 160);
      s.ground = s.ground.filter((f) => now - f.landed < 45000);
      ctx.shadowColor = 'rgba(80, 40, 10, .25)';
      ctx.shadowBlur = 3;
      for (const f of s.ground) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (45000 - (now - f.landed)) / 8000);
        ctx.translate(f.x, f.y);
        ctx.scale(1, 0.45);
        leaf(ctx, { ...f, x: 0, y: 0 }, 0);
        ctx.restore();
      }
      for (const f of s.falling) leaf(ctx, f, now);
      fall(s.drift, w, h, now, wind, (top) => faller(w, h, top, [4, 7], AUTUMN));
      for (const f of s.drift) leaf(ctx, f, now);
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
    if (document.documentElement.dataset) delete document.documentElement.dataset.ambient;
    return;
  }
  if (scene && scene.name === theme) return;
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'ambient';
    layer.setAttribute('aria-hidden', 'true');
    layer.append(document.createElement('canvas'));
    box.prepend(layer);
  }
  const canvas = layer.firstChild;
  canvas.width = 0; // nouvelle scène : préparée à la première image
  scene = { name: theme, state: null };
  document.documentElement.dataset.ambient = theme; // le CSS peut alléger le motif fixe du fond
  frame();
  // Après une première image réussie : une erreur de dessin ne laisse pas de minuteur tourner
  if (!timer) timer = setInterval(frame, FRAME);
}
