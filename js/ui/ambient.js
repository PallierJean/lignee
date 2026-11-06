/**
 * Animations des thèmes « fêtes et saisons », et de Grand Line, dessinées sur un calque sous
 * l'arbre : neige et guirlande tout autour de la toile à Noël ; à Halloween, lune et nuages,
 * citrouilles qui vacillent, brume, araignée, chauves-souris et fantômes ; au printemps, branches
 * de cerisier en fleur, prairie fleurie, pétales, papillons et hirondelles ; l'été, la plage
 * (vagues, écume, baigneurs flous, petit requin, mouettes) ; en automne, des arbres qui perdent
 * leurs feuilles de couleur au gré des coups de vent ; sur Grand Line, une planche de manga (trait
 * d'encre, trame, onomatopées) où vogue un navire pirate, poursuivi par la marine qui tire au
 * canon, dont le matelot aux bras élastiques rattrape son chapeau de paille ; îles, mouettes et
 * monstre marin. Chaque objet a sa taille, sa vitesse et son balancement,
 * tirés au hasard. Arrêtées hors de ces thèmes ou si le système demande moins d'animations (le
 * motif du fond reste), en pause quand l'onglet est caché.
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

/* ---------- Printemps : cerisier en fleur, prairie, hirondelles ---------- */

const BLOSSOMS = ['#F7A8C4', '#FBC6D8', '#F48FB8', '#FFFFFF'];

/**
 * Branche de cerisier qui part d'un coin : rameaux qui se ramifient (traits), et des fleurs à
 * cinq pétales en grappes au bout et le long des rameaux.
 */
function cherry(x, y, angle, len) {
  const twigs = [];
  const flowers = [];
  const grow = (x0, y0, a, l, width, depth) => {
    const x1 = x0 + Math.cos(a) * l;
    const y1 = y0 + Math.sin(a) * l;
    twigs.push([x0, y0, x1, y1, width]);
    for (let i = 0; i < (depth ? 2 : 6); i++) {
      const t = depth ? rand(0.4, 1) : 1;
      flowers.push({ x: x0 + (x1 - x0) * t + rand(-10, 10), y: y0 + (y1 - y0) * t + rand(-9, 9), r: rand(3.2, 5.2), color: pick(BLOSSOMS), turn: rand(0, TAU) });
    }
    if (depth === 0) return;
    grow(x1, y1, a + rand(-0.5, -0.2), l * rand(0.6, 0.75), width * 0.65, depth - 1);
    grow(x1, y1, a + rand(0.2, 0.55), l * rand(0.6, 0.75), width * 0.65, depth - 1);
  };
  grow(x, y, angle, len, 7, 4);
  return { x, y, twigs, flowers };
}

/** Dessine une branche qui se balance doucement autour de son attache. */
function drawCherry(ctx, b, now, phase) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.sin(now / 2200 + phase) * 0.025);
  ctx.translate(-b.x, -b.y);
  ctx.strokeStyle = '#5B3B2A';
  ctx.lineCap = 'round';
  for (const [x0, y0, x1, y1, width] of b.twigs) {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  for (const f of b.flowers) {
    ctx.fillStyle = f.color;
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = f.turn + (k * TAU) / 5;
      ctx.moveTo(f.x + Math.cos(a) * f.r, f.y + Math.sin(a) * f.r);
      ctx.arc(f.x + Math.cos(a) * f.r, f.y + Math.sin(a) * f.r, f.r * 0.62, 0, TAU);
    }
    ctx.fill();
    ctx.fillStyle = '#F2C94C';
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * 0.32, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** La prairie : herbes hautes qui ondulent au vent, tulipes et pâquerettes. */
function meadow(ctx, m, w, h, now) {
  const wind = (x, k) => Math.sin(now / 900 + x / 60) * k;
  const blades = (list) => {
    for (const g of list) {
      ctx.strokeStyle = g.color;
      ctx.lineWidth = g.width;
      ctx.beginPath();
      ctx.moveTo(g.x, h);
      ctx.quadraticCurveTo(g.x + g.lean * 0.4, h - g.height * 0.6, g.x + g.lean + wind(g.x, 6), h - g.height);
      ctx.stroke();
    }
  };
  blades(m.back);
  for (const f of m.flowers) {
    const sway = wind(f.x, 4);
    const top = [f.x + sway, h - f.height];
    ctx.strokeStyle = '#4E8A3A';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(f.x, h);
    ctx.quadraticCurveTo(f.x, h - f.height * 0.5, ...top);
    ctx.stroke();
    if (f.kind === 'tulip') {
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.moveTo(top[0] - 6, top[1] - 2);
      ctx.quadraticCurveTo(top[0] - 7, top[1] + 9, top[0], top[1] + 9);
      ctx.quadraticCurveTo(top[0] + 7, top[1] + 9, top[0] + 6, top[1] - 2);
      ctx.lineTo(top[0] + 3, top[1] + 2);
      ctx.lineTo(top[0], top[1] - 4);
      ctx.lineTo(top[0] - 3, top[1] + 2);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = (k * TAU) / 10;
        ctx.moveTo(top[0], top[1]);
        ctx.ellipse(top[0] + Math.cos(a) * 4.5, top[1] + Math.sin(a) * 4.5, 3.6, 1.4, a, 0, TAU);
      }
      ctx.fill();
      ctx.fillStyle = '#F2C21B';
      ctx.beginPath();
      ctx.arc(top[0], top[1], 2.4, 0, TAU);
      ctx.fill();
    }
  }
  blades(m.front);
}

/** Herbes et fleurs de la prairie, sur toute la largeur. */
function makeMeadow(w) {
  const grass = (n, tall, colors) => Array.from({ length: n }, () => ({
    x: rand(0, w), height: rand(...tall), lean: rand(-10, 10), width: rand(1.2, 2.4), color: pick(colors),
  }));
  return {
    back: grass(Math.round(w / 6), [22, 46], ['#7CB85A', '#8FC86A', '#6AA84E']),
    front: grass(Math.round(w / 10), [14, 30], ['#5E9E44', '#4E8A3A']),
    flowers: Array.from({ length: Math.round(w / 45) }, () => ({
      x: rand(0, w), height: rand(26, 60), kind: Math.random() < 0.55 ? 'tulip' : 'daisy',
      color: pick(['#E53950', '#F2B91B', '#F06AA0', '#FF8A3D']),
    })),
  };
}

/** Hirondelle : ailes en croissant et queue fourchue, elle file vite. */
function swallow(ctx, x, y, b, now) {
  const f = Math.sin(now / 110 + b.phase) * 0.35;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(b.dir, 1);
  ctx.fillStyle = '#1E2A4A';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.quadraticCurveTo(-2, -12 - f * 10, -10, -10 - f * 12);
  ctx.quadraticCurveTo(-4, -3, -6, 0);
  ctx.lineTo(-14, 4);
  ctx.lineTo(-7, 2);
  ctx.lineTo(-13, 7);
  ctx.quadraticCurveTo(-4, 3, -2, 1);
  ctx.quadraticCurveTo(-2, 9 + f * 10, -8, 12 + f * 12);
  ctx.quadraticCurveTo(2, 6, 6, 0);
  ctx.fill();
  ctx.restore();
}

/* ---------- Halloween : lune, citrouilles, brume, araignée ---------- */

/** Pleine lune voilée de lumière, devant laquelle passent des nuages sombres. */
function moon(ctx, w, h, now) {
  const x = w * 0.86;
  const y = h * 0.17;
  const r = 36;
  const halo = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 3);
  halo.addColorStop(0, 'rgba(255, 236, 190, .35)');
  halo.addColorStop(1, 'rgba(255, 236, 190, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  ctx.fillStyle = '#F3E6C2';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(190, 170, 130, .35)'; // mers lunaires
  for (const [dx, dy, cr] of [[-10, -8, 8], [9, 6, 6], [-4, 14, 5], [13, -12, 4]]) {
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, cr, 0, TAU);
    ctx.fill();
  }
  // Nuages : ils traversent lentement, de gauche à droite, et masquent la lune en passant
  ctx.fillStyle = 'rgba(28, 18, 42, .75)';
  for (const [speed, dy, size] of [[22, -6, 1], [34, 18, 0.7]]) {
    const cx = ((now / speed) % (w * 0.5 + 300)) + w * 0.6 - 150;
    ctx.beginPath();
    ctx.ellipse(cx, y + dy, 46 * size, 11 * size, 0, 0, TAU);
    ctx.ellipse(cx + 26 * size, y + dy - 8 * size, 26 * size, 12 * size, 0, 0, TAU);
    ctx.ellipse(cx - 24 * size, y + dy - 4 * size, 22 * size, 9 * size, 0, 0, TAU);
    ctx.fill();
  }
}

/** Citrouille sculptée : côtes, tige, visage éclairé par une bougie qui vacille. */
function pumpkin(ctx, x, y, s, now, seed) {
  const flicker = 0.75 + 0.25 * Math.sin(now / 90 + seed) * Math.sin(now / 37 + seed * 2);
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 70 * s);
  glow.addColorStop(0, `rgba(255, 170, 60, ${(0.35 * flicker).toFixed(2)})`);
  glow.addColorStop(1, 'rgba(255, 170, 60, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 70 * s, y - 70 * s, 140 * s, 140 * s);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = '#C85A12';
  for (const [dx, rx] of [[-11, 11], [11, 11], [0, 12]]) {
    ctx.beginPath();
    ctx.ellipse(dx, 0, rx, 16, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#E8781A';
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 15.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#4E6B2A';
  ctx.fillRect(-2, -20, 4, 7);
  // Visage : yeux en triangle, bouche en dents de scie, lumière de la bougie
  ctx.fillStyle = `rgba(255, ${Math.round(200 + 40 * flicker)}, 90, ${(0.75 + 0.25 * flicker).toFixed(2)})`;
  ctx.shadowColor = '#FFB347';
  ctx.shadowBlur = 10 * flicker;
  ctx.beginPath();
  ctx.moveTo(-12, -4); ctx.lineTo(-5, -4); ctx.lineTo(-8.5, -10); ctx.closePath();
  ctx.moveTo(12, -4); ctx.lineTo(5, -4); ctx.lineTo(8.5, -10); ctx.closePath();
  ctx.moveTo(-13, 3);
  for (let i = 0; i <= 8; i++) ctx.lineTo(-13 + i * 3.25, i % 2 ? 6 : 3);
  ctx.lineTo(13, 3); ctx.quadraticCurveTo(0, 14, -13, 3);
  ctx.fill();
  ctx.restore();
}

/** Brume au ras du sol : des nappes violacées qui dérivent lentement. */
function fog(ctx, w, h, now) {
  for (let i = 0; i < 5; i++) {
    const x = ((now / (60 + i * 17) + i * 300) % (w + 600)) - 300;
    const y = h - 20 - (i % 2) * 18;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(4, 1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
    g.addColorStop(0, 'rgba(190, 170, 225, .16)');
    g.addColorStop(1, 'rgba(190, 170, 225, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 60, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

/** Araignée : elle monte et descend au bout de son fil, en agitant les pattes. */
function spider(ctx, x, h, now) {
  const y = 40 + (0.5 + 0.5 * Math.sin(now / 2600)) * h * 0.32;
  ctx.strokeStyle = 'rgba(220, 210, 240, .45)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.strokeStyle = '#0B0612';
  ctx.lineWidth = 1.3;
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const wiggle = Math.sin(now / 120 + k) * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y + 2 + k * 1.5);
      ctx.quadraticCurveTo(x + side * 7, y - 3 + k * 3 + wiggle, x + side * 11, y + 4 + k * 3 + wiggle);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#0B0612';
  ctx.shadowColor = 'rgba(177, 138, 224, .6)';
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 4.5, 5.5, 0, 0, TAU);
  ctx.arc(x, y, 3, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#E0483E'; // deux yeux rouges
  ctx.fillRect(x - 1.8, y - 0.8, 1.2, 1.2);
  ctx.fillRect(x + 0.6, y - 0.8, 1.2, 1.2);
}

/* ---------- Noël : la guirlande ---------- */

const BULBS = ['#FF4D4D', '#FFD45C', '#4DDB7A', '#5CB8FF'];

/**
 * La guirlande, tout autour de la toile : sur chaque côté, un fil qui pend vers l'intérieur entre
 * des attaches, et des ampoules tournées vers le centre. Une vague de lumière fait le tour du cadre.
 */
function garland(ctx, w, h, now) {
  const span = 230;  // px entre deux attaches
  const sag = 26;    // le fil pend de … px vers l'intérieur
  const gap = 44;    // px entre deux ampoules
  const m = 4;       // marge au bord
  // Côtés dans le sens des aiguilles d'une montre : départ, arrivée, direction de l'intérieur
  const sides = [[m, m, w - m, m, 0, 1], [w - m, m, w - m, h - m, -1, 0], [w - m, h - m, m, h - m, 0, -1], [m, h - m, m, m, 1, 0]];
  let bulb = 0;
  for (const [x0, y0, x1, y1, nx, ny] of sides) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const ux = (x1 - x0) / len;
    const uy = (y1 - y0) / len;
    const count = Math.max(1, Math.round(len / span));
    const seg = len / count;
    // Point du fil à la distance d du départ : courbe de Bézier entre deux attaches, creusée vers l'intérieur
    const at = (d) => {
      const t = (d % seg) / seg;
      const dip = 2 * t * (1 - t) * sag;
      return [x0 + ux * d + nx * dip, y0 + uy * d + ny * dip];
    };
    ctx.strokeStyle = 'rgba(20, 40, 28, .9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k < count; k++) {
      const a = k * seg;
      ctx.moveTo(x0 + ux * a, y0 + uy * a);
      ctx.quadraticCurveTo(x0 + ux * (a + seg / 2) + nx * sag, y0 + uy * (a + seg / 2) + ny * sag, x0 + ux * (a + seg), y0 + uy * (a + seg));
    }
    ctx.stroke();
    const angle = Math.atan2(ny, nx) - Math.PI / 2; // ampoule tournée vers l'intérieur
    for (let d = gap / 2; d < len; d += gap, bulb++) {
      const [x, y] = at(d);
      const color = BULBS[bulb % BULBS.length];
      const lit = 0.35 + 0.65 * Math.max(0, Math.sin(now / 600 - bulb * 0.5));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = '#2A3A2E';
      ctx.fillRect(-2, -1, 4, 3);
      ctx.globalAlpha = lit;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14 * lit;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 6, 3.6, 5.2, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
}

/* ---------- Grand Line : une planche de manga d'aventure en mer ---------- */

const INK = '#141414';           // encre du trait
const SFX_FONT = '"Noto Sans CJK JP", "Hiragino Kaku Gothic Pro", "Yu Gothic", "Meiryo", sans-serif';

/** Trame de points, comme sur une planche imprimée (motif répété, préparé une fois). */
function screentone(ctx, s) {
  if (!s.tone) {
    const tile = document.createElement('canvas');
    tile.width = 7;
    tile.height = 7;
    const t = tile.getContext('2d');
    t.fillStyle = INK;
    t.beginPath();
    t.arc(3.5, 3.5, 1.1, 0, TAU);
    t.fill();
    s.tone = ctx.createPattern(tile, 'repeat');
  }
  return s.tone;
}

/** Remplit puis cerne d'encre le tracé courant. */
function inked(ctx, fill, width = 2) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Nuage de manga : des bulles blanches cernées d'encre (le trait ne reste qu'au contour). */
function mangaCloud(ctx, x, y, s) {
  const puffs = [[-36, 6, 18], [-15, -6, 24], [10, -11, 27], [34, 2, 20], [0, 9, 22]];
  const path = () => {
    ctx.beginPath();
    for (const [dx, dy, r] of puffs) {
      ctx.moveTo(x + (dx + r) * s, y + dy * s);
      ctx.arc(x + dx * s, y + dy * s, r * s, 0, TAU);
    }
  };
  path();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5 * s;
  ctx.stroke();
  path();
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.fillStyle = 'rgba(120, 170, 215, .35)'; // ombre sous le nuage
  ctx.beginPath();
  ctx.ellipse(x, y + 16 * s, 40 * s, 8 * s, 0, 0, Math.PI);
  ctx.fill();
}

/** Soleil de manga : disque cerné et rayons pointus qui tournent lentement. */
function mangaSun(ctx, x, y, now) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(now / 9000);
  for (let k = 0; k < 12; k++) {
    ctx.rotate(TAU / 12);
    ctx.beginPath();
    ctx.moveTo(-8, 42);
    ctx.lineTo(0, 82);
    ctx.lineTo(8, 42);
    inked(ctx, '#FFC93C', 1.5);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y, 36, 0, TAU);
  inked(ctx, '#FFE066', 2.5);
}

/** Île : butte de sable, rochers et palmier, cernés d'encre. */
function island(ctx, x, y, s) {
  ctx.beginPath();
  ctx.ellipse(x, y, 52 * s, 14 * s, 0, Math.PI, 0);
  inked(ctx, '#EBCB7E', 2);
  ctx.beginPath();
  ctx.moveTo(x - 6 * s, y - 10 * s);
  ctx.quadraticCurveTo(x + 2 * s, y - 34 * s, x + 12 * s, y - 52 * s);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6 * s;
  ctx.stroke();
  ctx.strokeStyle = '#8A5A2B';
  ctx.lineWidth = 3.5 * s;
  ctx.stroke();
  for (const a of [-2.7, -2.1, -1.3, -0.6, 0.1]) {
    ctx.beginPath();
    ctx.ellipse(x + 12 * s + Math.cos(a) * 15 * s, y - 52 * s + Math.sin(a) * 7 * s, 17 * s, 4.5 * s, a, 0, TAU);
    inked(ctx, '#2FAA52', 1.5);
  }
}

/** Rangée de vagues de manga : la mer cernée d'encre au sommet, crêtes d'écume en volutes. */
function mangaWaves(ctx, y, w, now, speed, amp, color, foam) {
  const shift = (now / speed) % 120;
  const at = (x) => y + Math.sin((x - shift) / 19) * amp;
  ctx.beginPath();
  ctx.moveTo(-120, y + 400);
  for (let x = -120 + shift; x <= w + 120; x += 10) ctx.lineTo(x, at(x));
  ctx.lineTo(w + 120, y + 400);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  for (let x = -120 + shift; x <= w + 120; x += 10) {
    if (x === -120 + shift) ctx.moveTo(x, at(x));
    else ctx.lineTo(x, at(x));
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  if (!foam) return;
  for (let x = -120 + shift; x <= w + 120; x += 120) {
    const cy = y - amp;
    ctx.beginPath();
    ctx.moveTo(x, cy + 5);
    ctx.quadraticCurveTo(x + 16, cy - 14, x + 34, cy + 2);
    ctx.quadraticCurveTo(x + 26, cy - 3, x + 22, cy + 7);
    ctx.quadraticCurveTo(x + 15, cy - 5, x, cy + 5);
    inked(ctx, '#FFFFFF', 1.6);
  }
}

/** Tête de mort et tibias croisés, cernés : pour la voile et le pavillon. */
function skull(ctx, x, y, s, ink, bone) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineCap = 'round';
  for (const [width, color] of [[6, ink], [3.4, bone]]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(-12, 13);
    ctx.lineTo(12, -2);
    ctx.moveTo(12, 13);
    ctx.lineTo(-12, -2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, -5, 8.5, 0, TAU);
  ctx.rect(-4.5, 1, 9, 6);
  inked(ctx, bone, 1.4);
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(-3.2, -5.5, 2.4, 0, TAU);
  ctx.arc(3.2, -5.5, 2.4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// Le matelot, dans le repère du navire : tête, épaule droite (d'où part le bras élastique)
const SAILOR = { head: [-27, -52], shoulder: [-19, -41] };
const SKIN = '#F2C29B';

/** Matelot original : cheveux noirs en bataille, marinière rayée ; bras droit le long du corps s'il n'est pas étiré. */
function sailor(ctx, armOut) {
  const [hx, hy] = SAILOR.head;
  ctx.beginPath(); // jambes (le bas est caché par la coque)
  ctx.rect(-33, -26, 5, 18);
  ctx.rect(-26, -26, 5, 18);
  inked(ctx, '#2B2D42', 1.2);
  ctx.beginPath(); // marinière
  ctx.roundRect(-36, -46, 18, 22, 4);
  inked(ctx, '#FFFFFF', 1.6);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#1F3A6E';
  for (let y = -44; y < -24; y += 4) ctx.fillRect(-36, y, 18, 1.8);
  ctx.restore();
  for (const [x0, y0, x1, y1] of armOut ? [[-35, -42, -40, -29]] : [[-35, -42, -40, -29], [-19, -42, -15, -29]]) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5.4;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = SKIN;
    ctx.lineWidth = 3.2;
    ctx.stroke();
  }
  ctx.beginPath(); // tête
  ctx.arc(hx, hy, 8.5, 0, TAU);
  inked(ctx, SKIN, 1.6);
  ctx.beginPath(); // cheveux en bataille
  ctx.moveTo(hx - 9, hy - 1);
  for (let k = 0; k <= 6; k++) ctx.lineTo(hx - 9 + k * 3, hy - 8 - (k % 2 ? 5 : 1));
  ctx.lineTo(hx + 9, hy - 1);
  ctx.quadraticCurveTo(hx, hy - 6, hx - 9, hy - 1);
  inked(ctx, INK, 1);
  ctx.fillStyle = INK; // œil et grand sourire
  ctx.beginPath();
  ctx.arc(hx + 3.5, hy, 1.3, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(hx + 2, hy + 3, 3.5, 0.1, Math.PI - 0.6);
  ctx.stroke();
}

/** Bras élastique : du caoutchouc qui ondule de l'épaule à la main, et un poing au bout. */
function rubberArm(ctx, from, to, s, now) {
  const [x0, y0] = from;
  const [x1, y1] = to;
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const px = -(y1 - y0) / len;
  const py = (x1 - x0) / len;
  const point = (t) => {
    const wave = Math.sin(t * Math.PI * 4 - now / 60) * 4 * s * Math.sin(t * Math.PI);
    return [x0 + (x1 - x0) * t + px * wave, y0 + (y1 - y0) * t + py * wave];
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [width, color] of [[6.5 * s, INK], [4 * s, SKIN]]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let k = 0; k <= 24; k++) {
      const [x, y] = point(k / 24);
      if (k) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x1, y1, 4.6 * s, 0, TAU);
  inked(ctx, SKIN, 1.6);
}

/**
 * Le chapeau du matelot : sur sa tête ; un coup de vent l'emporte, son bras s'étire en caoutchouc
 * (« ビヨ〜ン! »), l'attrape au vol et le lui remet. `ship` : position et échelle du navire.
 */
function hatAndArm(ctx, s, now, ship) {
  const world = ([lx, ly]) => [ship.x + lx * ship.s, ship.y + ly * ship.s];
  const head = world(SAILOR.head);
  const top = [head[0], head[1] - 9 * ship.s];
  const shoulder = world(SAILOR.shoulder);
  const size = 0.42 * ship.s;
  const hat = s.hat;
  const ease = (t) => 1 - (1 - t) ** 3;
  // Le vent l'emporte vers l'arrière, à hauteur du pont (plus haut, les fiches de l'arbre le cacheraient),
  // quand le navire est bien dans la toile
  if (hat.mode === 'head' && now > s.nextBlow && ship.x > ship.w * 0.3 && ship.x < ship.w * 0.85) {
    Object.assign(hat, { mode: 'fly', x: top[0], y: top[1], vx: -rand(2.6, 3.4), vy: -0.9, born: now });
  }
  if (hat.mode === 'fly' || hat.mode === 'reach') {
    hat.x += hat.vx;
    hat.y += hat.vy;
    hat.vy = Math.min(hat.vy + 0.03, 0.5);
    if (hat.mode === 'fly' && now - hat.born > 1300) Object.assign(hat, { mode: 'reach', armFrom: now });
  }
  let hand = null;
  if (hat.mode === 'reach') {
    const p = Math.min(1, (now - hat.armFrom) / 420);
    hand = [shoulder[0] + (hat.x - shoulder[0]) * ease(p), shoulder[1] + (hat.y - shoulder[1]) * ease(p)];
    if (p >= 1) Object.assign(hat, { mode: 'back', backFrom: now, caught: [hat.x, hat.y] });
  }
  if (hat.mode === 'back') {
    const q = Math.min(1, (now - hat.backFrom) / 650);
    hand = [hat.caught[0] + (top[0] - hat.caught[0]) * ease(q), hat.caught[1] + (top[1] - hat.caught[1]) * ease(q)];
    [hat.x, hat.y] = hand;
    if (q >= 1) {
      hat.mode = 'head';
      s.nextBlow = now + rand(12000, 22000);
    }
  }
  if (hand) rubberArm(ctx, shoulder, hand, ship.s, now);
  if (hat.mode === 'head') strawHat(ctx, top[0], top[1], size, 0);
  else strawHat(ctx, hat.x, hat.y, size, hat.mode === 'back' ? 0 : Math.sin(now / 120) * 0.8);
  if (hand) {
    const since = now - hat.armFrom;
    if (since < 1300) sfx(ctx, 'ビヨ〜ン!', (shoulder[0] + hand[0]) / 2 + 20, Math.min(shoulder[1], hand[1]) - 26, 30, -0.12, since / 260);
  }
}

/**
 * Navire pirate à tête de mouton, cerné d'encre comme dans un manga (cap à droite si dir = 1) :
 * coque de planches, figure de proue laineuse, mât et nid-de-pie, grande voile gonflée à tête de
 * mort, foc, pavillon qui claque. Il tangue sur la houle.
 */
function pirateShip(ctx, x, y, s, dir, now, crew) {
  const roll = Math.sin(now / 900) * 0.05;
  const bob = Math.sin(now / 700) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(roll);
  ctx.scale(s * dir, s);
  ctx.lineJoin = 'round';
  // Mât, foc et grande voile (derrière la coque)
  ctx.beginPath();
  ctx.rect(-3, -134, 6, 128);
  inked(ctx, '#7A4A22', 1.6);
  ctx.beginPath();
  ctx.moveTo(4, -120);
  ctx.quadraticCurveTo(42, -70, 74, -24);
  ctx.lineTo(6, -28);
  ctx.closePath();
  inked(ctx, '#FFFDF4', 2);
  const puff = 9 + Math.sin(now / 600) * 2.5;
  ctx.beginPath();
  ctx.moveTo(-48, -104);
  ctx.quadraticCurveTo(0, -104 + puff / 2, 42, -104);
  ctx.quadraticCurveTo(42 + puff, -72, 42, -38);
  ctx.quadraticCurveTo(0, -38 + puff, -48, -38);
  ctx.quadraticCurveTo(-48 + puff, -72, -48, -104);
  inked(ctx, '#FFFDF4', 2.2);
  ctx.strokeStyle = 'rgba(20, 20, 20, .25)'; // plis de la toile
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-30, -98);
  ctx.quadraticCurveTo(-26 + puff / 2, -72, -30, -44);
  ctx.moveTo(24, -98);
  ctx.quadraticCurveTo(28 + puff / 2, -72, 24, -44);
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(-52, -108, 98, 5);
  inked(ctx, '#7A4A22', 1.4);
  skull(ctx, -3, -72, 1.5, INK, '#FFFFFF');
  // Nid-de-pie et pavillon noir qui claque au vent
  ctx.beginPath();
  ctx.rect(-10, -120, 20, 8);
  inked(ctx, '#8B5A2B', 1.4);
  ctx.beginPath();
  ctx.moveTo(3, -152);
  for (let k = 0; k <= 4; k++) ctx.lineTo(3 - k * 9, -152 + Math.sin(now / 130 + k) * 3 * (k / 4));
  for (let k = 4; k >= 0; k--) ctx.lineTo(3 - k * 9, -134 + Math.sin(now / 130 + k) * 3 * (k / 4));
  ctx.closePath();
  inked(ctx, INK, 1);
  skull(ctx, -15, -144, 0.48, INK, '#FFFFFF');
  // Coque de planches
  ctx.beginPath();
  ctx.moveTo(-66, -26);
  ctx.lineTo(-50, -26);
  ctx.lineTo(-50, -8);
  ctx.lineTo(52, -8);
  ctx.quadraticCurveTo(66, -12, 74, -24);
  ctx.quadraticCurveTo(72, 12, 40, 26);
  ctx.lineTo(-44, 26);
  ctx.quadraticCurveTo(-64, 14, -66, -26);
  ctx.closePath();
  inked(ctx, '#A0662F', 2.6);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const yy of [3, 11, 18]) {
    ctx.moveTo(-60, yy);
    ctx.lineTo(58, yy);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(-50, -13, 102, 5);
  inked(ctx, '#D39A55', 1.4);
  for (const hx of [-30, -10, 10, 30]) {
    ctx.beginPath();
    ctx.arc(hx, 6, 3.4, 0, TAU);
    inked(ctx, '#FFE7A3', 1.2);
  }
  // Le matelot, debout derrière le bastingage (son bras droit, s'il est étiré, est dessiné à part)
  sailor(ctx, crew && crew.armOut);
  // Figure de proue : un mouton laineux, cerné, à corne en spirale
  ctx.beginPath();
  for (const [dx, dy, r] of [[78, -32, 8], [86, -36, 7], [90, -27, 7], [82, -22, 7], [72, -25, 6]]) {
    ctx.moveTo(dx + r, dy);
    ctx.arc(dx, dy, r, 0, TAU);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#FFF6DE';
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(89, -32, 1.8, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(78, -34, 4.5, Math.PI * 0.2, Math.PI * 1.9);
  ctx.stroke();
  ctx.strokeStyle = '#E8C46A';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.restore();
}

/** Monstre marin : une tête de serpent géant cernée d'encre, qui surgit puis replonge. `age` : 0 à 1. */
function seaMonster(ctx, x, base, age, now) {
  const rise = Math.sin(Math.min(1, age) * Math.PI);
  const top = base - rise * 170;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 140, 0, 280, base + 4);
  ctx.clip();
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 28, base + 10);
  ctx.quadraticCurveTo(x - 32, top + 66, x - 10, top + 22);
  ctx.quadraticCurveTo(x + 12, top, x + 38, top + 14);
  ctx.quadraticCurveTo(x + 58, top + 26, x + 44, top + 44);
  ctx.quadraticCurveTo(x + 22, top + 48, x + 16, top + 66);
  ctx.quadraticCurveTo(x + 14, top + 110, x + 28, base + 10);
  ctx.closePath();
  inked(ctx, '#3FA36B', 2.6);
  ctx.beginPath(); // ventre
  ctx.moveTo(x + 16, top + 68);
  ctx.quadraticCurveTo(x + 14, top + 110, x + 26, base + 10);
  ctx.lineTo(x + 19, base + 10);
  ctx.quadraticCurveTo(x + 8, top + 110, x + 11, top + 68);
  inked(ctx, '#F1E3A0', 1.4);
  for (let k = 0; k < 5; k++) { // crête
    const cy = top + 22 + k * 20;
    ctx.beginPath();
    ctx.moveTo(x - 14 - k * 2, cy);
    ctx.lineTo(x - 34 - k * 2, cy + 7);
    ctx.lineTo(x - 16 - k * 2, cy + 14);
    inked(ctx, '#1F7A4C', 1.4);
  }
  ctx.beginPath(); // gueule
  ctx.moveTo(x + 44, top + 34);
  ctx.lineTo(x + 26, top + 36);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath(); // œil
  ctx.arc(x + 24, top + 16, 7, 0, TAU);
  inked(ctx, '#FFFFFF', 2);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x + 26 + Math.sin(now / 500) * 2, top + 16, 3.4, 0, TAU);
  ctx.fill();
  ctx.restore();
  for (let k = 0; k < 8; k++) { // gerbe d'écume
    ctx.beginPath();
    ctx.arc(x - 34 + k * 10, base - 2 - Math.abs(Math.sin(now / 160 + k)) * 8 * rise, 5.5, 0, TAU);
    inked(ctx, '#FFFFFF', 1.4);
  }
}

/** Lignes de vitesse : des rayons d'encre qui partent d'un point, pour un moment fort. */
function speedLines(ctx, x, y, w, h, strength, now) {
  const far = Math.hypot(w, h);
  ctx.save();
  ctx.strokeStyle = `rgba(20, 20, 20, ${(0.28 * strength).toFixed(2)})`;
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * TAU + Math.sin(k * 12.9898) * 0.04;
    const inner = 110 + ((k * 37) % 60) + Math.sin(now / 90 + k) * 6;
    ctx.lineWidth = 1 + (k % 3);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner);
    ctx.lineTo(x + Math.cos(a) * far, y + Math.sin(a) * far);
    ctx.stroke();
  }
  ctx.restore();
}

/** Onomatopée de manga : grosses lettres noires cernées de blanc, qui surgissent. */
function sfx(ctx, text, x, y, size, rot, pop) {
  const k = pop < 1 ? 0.5 + 0.7 * Math.sin((pop * Math.PI) / 2) : 1.2 - Math.min(0.2, (pop - 1) * 0.4);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(k, k);
  ctx.font = `900 ${size}px ${SFX_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = size / 6;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = INK;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Chapeau de paille du matelot : sur sa tête (`spin` nul) ou emporté par le vent, en tournoyant. */
function strawHat(ctx, x, y, size, spin) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.scale(size, size);
  ctx.beginPath();
  ctx.ellipse(0, 6, 34, 9, 0, 0, TAU); // bord
  inked(ctx, '#F2C24E', 2.2);
  ctx.beginPath();
  ctx.moveTo(-17, 4);
  ctx.bezierCurveTo(-18, -20, 18, -20, 17, 4); // calotte
  inked(ctx, '#F2C24E', 2.2);
  ctx.beginPath();
  ctx.moveTo(-17, 3);
  ctx.bezierCurveTo(-17, -4, 17, -4, 17, 3); // ruban bleu marine
  ctx.lineTo(17.5, -2);
  ctx.bezierCurveTo(17, -9, -17, -9, -17.5, -2);
  ctx.closePath();
  inked(ctx, '#1F3A6E', 1.6);
  ctx.strokeStyle = 'rgba(140, 100, 30, .55)'; // tressage
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let a = -28; a <= 28; a += 7) {
    ctx.moveTo(a, 1);
    ctx.lineTo(a * 1.12, 12);
  }
  ctx.stroke();
  ctx.restore();
}

/** Marin : casquette blanche, col bleu ; il s'agite (bras levé par moments). */
function marine(ctx, x, y, now, k) {
  ctx.beginPath();
  ctx.rect(x - 4, y - 14, 8, 12); // vareuse
  inked(ctx, '#FFFFFF', 1.2);
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 14);
  ctx.lineTo(x, y - 9);
  ctx.lineTo(x + 4, y - 14);
  inked(ctx, '#2E5AAC', 1); // col bleu
  ctx.beginPath();
  ctx.arc(x, y - 19, 4.5, 0, TAU);
  inked(ctx, SKIN, 1.2);
  ctx.beginPath();
  ctx.rect(x - 5, y - 25, 10, 3.5); // casquette
  inked(ctx, '#FFFFFF', 1);
  const wave = Math.sin(now / 180 + k * 1.7) > 0.3;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 4, y - 12);
  ctx.lineTo(x + 9, wave ? y - 24 : y - 6);
  ctx.stroke();
}

/**
 * Navire de la marine (cap à droite) : coque blanche rayée de bleu, sabords et canons, grande voile
 * à ancre marquée « MARINE », pavillon bleu à ancre, marins sur le pont. Il tangue lui aussi.
 */
function navyShip(ctx, x, y, s, now) {
  ctx.save();
  ctx.translate(x, y + Math.sin(now / 760 + 1) * 3);
  ctx.rotate(Math.sin(now / 980 + 1) * 0.04);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.beginPath(); // mât
  ctx.rect(-3, -140, 6, 134);
  inked(ctx, '#7A6A55', 1.6);
  const puff = 8 + Math.sin(now / 650) * 2;
  ctx.beginPath(); // grande voile
  ctx.moveTo(-50, -110);
  ctx.quadraticCurveTo(0, -110 + puff / 2, 44, -110);
  ctx.quadraticCurveTo(44 + puff, -76, 44, -42);
  ctx.quadraticCurveTo(0, -42 + puff, -50, -42);
  ctx.quadraticCurveTo(-50 + puff, -76, -50, -110);
  inked(ctx, '#FFFFFF', 2.2);
  ctx.save(); // ancre bleue
  ctx.translate(-3, -84);
  ctx.strokeStyle = '#2E5AAC';
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(0, 12);
  ctx.moveTo(-9, -8);
  ctx.lineTo(9, -8);
  ctx.moveTo(-13, 4);
  ctx.quadraticCurveTo(-10, 14, 0, 14);
  ctx.quadraticCurveTo(10, 14, 13, 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -17, 3.5, 0, TAU);
  ctx.stroke();
  ctx.restore();
  ctx.font = '800 11px "Atkinson Hyperlegible", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2E5AAC';
  ctx.fillText('MARINE', -3, -54);
  ctx.beginPath(); // pavillon bleu à ancre, qui claque
  ctx.moveTo(3, -158);
  for (let k = 0; k <= 4; k++) ctx.lineTo(3 - k * 9, -158 + Math.sin(now / 130 + k + 2) * 3 * (k / 4));
  for (let k = 4; k >= 0; k--) ctx.lineTo(3 - k * 9, -140 + Math.sin(now / 130 + k + 2) * 3 * (k / 4));
  ctx.closePath();
  inked(ctx, '#2E5AAC', 1);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(-17, -152, 4, 8);
  ctx.fillRect(-21, -149, 12, 2.5);
  // Marins sur le pont, derrière le bastingage
  for (const [mx, k] of [[-40, 0], [-22, 1], [22, 2], [40, 3]]) marine(ctx, mx, -8, now, k);
  // Coque blanche rayée de bleu, sabords et canons
  ctx.beginPath();
  ctx.moveTo(-70, -22);
  ctx.lineTo(-56, -22);
  ctx.lineTo(-56, -8);
  ctx.lineTo(56, -8);
  ctx.quadraticCurveTo(70, -12, 78, -20);
  ctx.quadraticCurveTo(74, 14, 42, 26);
  ctx.lineTo(-46, 26);
  ctx.quadraticCurveTo(-66, 14, -70, -22);
  ctx.closePath();
  inked(ctx, '#E9EDF2', 2.6);
  ctx.beginPath();
  ctx.rect(-64, 6, 132, 6);
  inked(ctx, '#2E5AAC', 1.2);
  for (const cx of [-34, -10, 14, 38]) {
    ctx.beginPath();
    ctx.rect(cx - 5, -4, 10, 8);
    inked(ctx, '#2B2D42', 1.2);
    ctx.beginPath();
    ctx.rect(cx + 3, -2, 8, 4);
    inked(ctx, '#3A3A3A', 1);
  }
  ctx.restore();
}

/** Tir de canon : éclair et fumée à la bouche, boulet en arc, gerbe d'eau à l'arrivée. `t` : 0 à 1. */
function cannonShot(ctx, from, to, t) {
  if (t < 0.2) { // éclair et fumée
    const k = t / 0.2;
    ctx.beginPath();
    ctx.arc(from[0] + 10, from[1], 10 + k * 16, 0, TAU);
    inked(ctx, k < 0.4 ? '#FFD45A' : '#F2F2F2', 1.4);
  }
  if (t < 0.75) { // boulet en arc de cercle
    const k = t / 0.75;
    const x = from[0] + (to[0] - from[0]) * k;
    const y = from[1] + (to[1] - from[1]) * k - Math.sin(k * Math.PI) * 120;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, TAU);
    inked(ctx, '#2B2B2B', 1.4);
  } else { // gerbe d'eau
    const k = (t - 0.75) / 0.25;
    const tall = Math.sin(k * Math.PI) * 70;
    ctx.beginPath();
    ctx.moveTo(to[0] - 18, to[1]);
    ctx.quadraticCurveTo(to[0] - 10, to[1] - tall, to[0], to[1] - tall * 1.1);
    ctx.quadraticCurveTo(to[0] + 10, to[1] - tall, to[0] + 18, to[1]);
    ctx.closePath();
    inked(ctx, '#FFFFFF', 1.6);
  }
}

/**
 * La planche : ciel tramé, soleil, nuages, îles, mer en couches cernées d'encre, navire, mouettes ;
 * de temps en temps, un monstre marin qui surgit (lignes de vitesse et « ドン!! »), un « ザザーン »
 * de vagues, le chapeau du matelot que le vent emporte et qu'il rattrape d'un bras élastique, et un
 * navire de la marine qui le poursuit et tire au canon (« ドーン! », « ドボン! »).
 */
function grandLine(ctx, s, now, w, h) {
  const horizon = h * 0.6;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#3FA9E6');
  sky.addColorStop(1, '#C9ECFA');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);
  // Trame dans le haut du ciel
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = screentone(ctx, s);
  ctx.fillRect(0, 0, w, horizon * 0.6);
  ctx.restore();
  mangaSun(ctx, w * 0.85, h * 0.16, now);
  for (const c of s.clouds) mangaCloud(ctx, ((c.x + now / c.speed) % (w + 300)) - 150, c.y * h, c.s);
  island(ctx, w * 0.16, horizon + 2, 0.95);
  island(ctx, w * 0.72, horizon + 2, 0.6);
  mangaWaves(ctx, horizon, w, now, 90, 2, '#6CC3EC', false);
  mangaWaves(ctx, horizon + h * 0.07, w, now, 60, 4, '#3DA2DA', true);
  // Monstre marin : il surgit, lignes de vitesse et « ドン!! », puis replonge
  if (!s.monster && now > s.nextMonster) s.monster = { x: rand(0.2, 0.8) * w, born: now };
  if (s.monster) {
    const age = (now - s.monster.born) / 7000;
    const base = horizon + h * 0.08;
    const peak = Math.max(0, Math.sin(Math.min(1, age) * Math.PI));
    if (age > 0.12 && age < 0.8) speedLines(ctx, s.monster.x + 20, base - 120 * peak, w, h, peak, now);
    seaMonster(ctx, s.monster.x, base, age, now);
    // En haut, dans le ciel : au milieu de la toile, les fiches de l'arbre le cacheraient
    if (age > 0.18 && age < 0.85) sfx(ctx, 'ドン!!', s.monster.x < w / 2 ? w * 0.3 : w * 0.62, h * 0.11, 92, -0.15, (age - 0.18) * 8);
    if (age > 1) {
      s.monster = null;
      s.nextMonster = now + rand(16000, 28000);
    }
  }
  // Le navire traverse en boucle au bas de la toile, sous les fiches de l'arbre
  const crossing = (w + 400) / 0.035;
  const shipX = ((now % crossing) / crossing) * (w + 400) - 200;
  const shipY = h * 0.9;
  for (let k = 1; k < 6; k++) { // sillage
    ctx.beginPath();
    ctx.ellipse(shipX - k * 28, shipY + 20 + Math.sin(now / 300 + k) * 2, 15 - k, 3.5, 0, 0, TAU);
    inked(ctx, '#FFFFFF', 1.2);
  }
  mangaWaves(ctx, horizon + h * 0.17, w, now, 40, 6, '#2B88C8', true);
  const shipScale = Math.min(1.4, h / 540);
  // La marine le poursuit, un peu en arrière (plus loin, donc plus petite) ; elle tire de temps en temps
  const navyX = shipX - w * 0.42;
  const navyY = shipY - h * 0.05;
  navyShip(ctx, navyX, navyY, shipScale * 0.82, now);
  if (!s.shot && now > s.nextShot && navyX > w * 0.08 && shipX < w * 0.95) s.shot = { born: now };
  if (s.shot) {
    const t = (now - s.shot.born) / 2200;
    const from = [navyX + 82 * shipScale * 0.82, navyY - 2];
    const to = [shipX - 140 * shipScale, shipY + 20]; // juste derrière la poupe : raté !
    if (t > 1) {
      s.shot = null;
      s.nextShot = now + rand(6000, 11000);
    } else {
      cannonShot(ctx, from, to, t);
      if (t < 0.35) sfx(ctx, 'ドーン!', from[0] + 30, from[1] - 60, 36, -0.1, t * 10);
      if (t > 0.75) sfx(ctx, 'ドボン!', to[0], to[1] - 70, 30, 0.1, (t - 0.75) * 12);
    }
  }
  const armOut = s.hat.mode === 'reach' || s.hat.mode === 'back';
  pirateShip(ctx, shipX, shipY, shipScale, 1, now, { armOut });
  mangaWaves(ctx, h * 0.93, w, now, 28, 8, '#1A6AA6', true);
  hatAndArm(ctx, s, now, { x: shipX, y: shipY + Math.sin(now / 700) * 3, s: shipScale, w });
  // « ザザーン » : le bruit des vagues, de temps en temps, sur l'eau
  if (!s.wash && now > s.nextWash) s.wash = { x: rand(0.1, 0.9) * w, born: now };
  if (s.wash) {
    const age = (now - s.wash.born) / 2600;
    if (age > 1) {
      s.wash = null;
      s.nextWash = now + rand(9000, 16000);
    } else {
      ctx.save();
      ctx.globalAlpha = Math.sin(age * Math.PI);
      sfx(ctx, 'ザザーン', s.wash.x, h * 0.965, 34, -0.08, age * 4);
      ctx.restore();
    }
  }
  // Mouettes
  release(s.gulls, 4, 0.01, () => ({ ...flyer(w, h, [1, 2], [8, 12]), y: rand(0.08, 0.4) * h }));
  s.gulls = s.gulls.filter((b) => {
    const at = fly(b, now, w);
    if (at) gull(ctx, ...at, b, now);
    return !!at;
  });
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

/** Petit requin : un aileron qui fend l'eau, son sillage d'écume, sa silhouette devinée dessous. */
function shark(ctx, k, now, horizon, shore) {
  const y = horizon + (shore - horizon) * k.depth + Math.sin(now / 700 + k.phase) * 1.5;
  const x = k.x;
  const z = 0.8 + k.depth * 0.6; // plus proche, plus grand
  ctx.save();
  // Silhouette sous l'eau
  ctx.fillStyle = 'rgba(30, 60, 80, .18)';
  ctx.beginPath();
  ctx.ellipse(x - k.dir * 6 * z, y + 5 * z, 26 * z, 5 * z, 0, 0, TAU);
  ctx.fill();
  // Sillage : deux traînées d'écume en V derrière l'aileron
  ctx.strokeStyle = 'rgba(255, 255, 255, .75)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const side of [-1, 1]) {
    ctx.moveTo(x - k.dir * 4 * z, y);
    ctx.quadraticCurveTo(x - k.dir * 20 * z, y + side * 3 * z, x - k.dir * 38 * z, y + side * 6 * z);
  }
  ctx.stroke();
  // Aileron : bord d'attaque bombé, bord de fuite creusé
  ctx.fillStyle = '#5F6E7A';
  ctx.beginPath();
  ctx.moveTo(x + k.dir * 7 * z, y);
  ctx.quadraticCurveTo(x + k.dir * 3 * z, y - 10 * z, x - k.dir * 4 * z, y - 15 * z);
  ctx.quadraticCurveTo(x - k.dir * 4 * z, y - 6 * z, x - k.dir * 9 * z, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, .8)'; // écume au pied de l'aileron
  ctx.beginPath();
  ctx.ellipse(x, y + 0.5, 9 * z, 1.6 * z, 0, 0, TAU);
  ctx.fill();
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
  // De temps en temps, un petit requin traverse la mer
  if (!s.shark && now > s.nextShark) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    s.shark = { x: dir > 0 ? -40 : w + 40, dir, depth: rand(0.25, 0.75), speed: rand(1.6, 2.4), phase: rand(0, TAU) };
  }
  if (s.shark) {
    s.shark.x += s.shark.dir * s.shark.speed;
    shark(ctx, s.shark, now, horizon, shore);
    if (s.shark.x < -60 || s.shark.x > w + 60) {
      s.shark = null;
      s.nextShark = now + rand(8000, 20000);
    }
  }
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

const WINGS = ['#F06AA0', '#4FA3E8', '#F2B91B', '#9B6BE0', '#FF8A3D', '#3FBF7F'];

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
      garland(ctx, w, h, now);
    },
  },
  halloween: {
    make: () => ({ bats: [], ghosts: [], nextSwarm: Date.now() + 5000 }),
    draw(ctx, s, now, w, h) {
      moon(ctx, w, h, now);
      fog(ctx, w, h, now);
      pumpkin(ctx, w * 0.05, h - 28, 1.3, now, 1);
      pumpkin(ctx, w * 0.95, h - 24, 1, now, 2);
      pumpkin(ctx, w * 0.9, h - 20, 0.7, now, 3);
      spider(ctx, w * 0.27, h, now);
      // Des chauves-souris passent ; de temps en temps, une nuée jaillit d'un côté
      release(s.bats, 8, 0.03, () => flyer(w, h, [1.6, 3.4], [9, 18]));
      if (now > s.nextSwarm) {
        const lead = flyer(w, h, [2.6, 3.4], [8, 14]);
        for (let i = 0; i < 12; i++) {
          s.bats.push({ ...lead, x: lead.x - lead.dir * rand(0, 160), y: lead.y + rand(-50, 50), r: rand(7, 14), phase: rand(0, TAU), speed: lead.speed + rand(-0.4, 0.4) });
        }
        s.nextSwarm = now + rand(14000, 24000);
      }
      s.bats = s.bats.filter((b) => {
        const at = fly(b, now, w);
        if (at) bat(ctx, ...at, b, now);
        return !!at;
      });
      release(s.ghosts, 3, 0.015, () => ({ x: rand(0.08, 0.92) * w, y: rand(0.55, 0.95) * h, r: rand(14, 24), born: now, life: rand(5000, 8000), phase: rand(0, TAU) }));
      s.ghosts = s.ghosts.filter((g) => ghost(ctx, g, now, h));
    },
  },
  printemps: {
    make: (w, h) => ({
      branches: [cherry(-10, 18, 0.35, h * 0.15), cherry(w + 10, 26, Math.PI - 0.4, h * 0.14)],
      meadow: makeMeadow(w),
      fall: Array.from({ length: Math.round((w * h) / 30000) }, () => faller(w, h, false, [3, 5.5], BLOSSOMS)),
      flies: [], birds: [],
    }),
    draw(ctx, s, now, w, h) {
      s.branches.forEach((b, i) => drawCherry(ctx, b, now, i * 2));
      meadow(ctx, s.meadow, w, h, now);
      // Pétales : ils s'envolent des branches et tombent en tournoyant
      fall(s.fall, w, h, now, 0.25, (top) => {
        const b = pick(s.branches);
        const f = pick(b.flowers);
        return top ? { ...faller(w, h, true, [3, 5.5], BLOSSOMS), x: f.x, y: f.y } : faller(w, h, false, [3, 5.5], BLOSSOMS);
      });
      ctx.shadowColor = 'rgba(180, 80, 120, .25)';
      ctx.shadowBlur = 3;
      for (const f of s.fall) petal(ctx, f, now);
      ctx.shadowBlur = 0;
      release(s.flies, 5, 0.02, () => ({ ...flyer(w, h, [0.7, 1.5], [7, 11]), y: rand(0.25, 0.85) * h, color: pick(WINGS) }));
      s.flies = s.flies.filter((b) => {
        const at = fly(b, now, w);
        if (at) butterfly(ctx, ...at, b, now);
        return !!at;
      });
      release(s.birds, 2, 0.005, () => ({ ...flyer(w, h, [4, 6], [10, 10]), y: rand(0.1, 0.4) * h, wave: rand(15, 35) }));
      s.birds = s.birds.filter((b) => {
        const at = fly(b, now, w);
        if (at) swallow(ctx, ...at, b, now);
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
      glints: [], gulls: [], shark: null, nextShark: Date.now() + 1500,
    }),
    draw: (ctx, s, now, w, h) => beach(ctx, s, now, w, h),
  },
  grandline: {
    make: () => ({
      clouds: [{ x: 0, y: 0.12, s: 1.1, speed: 70 }, { x: 420, y: 0.24, s: 0.8, speed: 95 }, { x: 900, y: 0.08, s: 0.9, speed: 80 }, { x: 1300, y: 0.3, s: 0.7, speed: 110 }],
      gulls: [], monster: null, nextMonster: Date.now() + 5000,
      wash: null, nextWash: Date.now() + 2500, hat: { mode: 'head' }, nextBlow: Date.now() + 4000, tone: null,
      shot: null, nextShot: Date.now() + 3000,
    }),
    draw: (ctx, s, now, w, h) => grandLine(ctx, s, now, w, h),
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

/** État de la scène en cours (pour les tests : déclencher un moment sans attendre le hasard). */
export const ambientState = () => (scene ? scene.state : null);

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
