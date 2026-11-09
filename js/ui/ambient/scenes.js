/**
 * Scenes of the animated themes, drawing only (ui/ambient.js runs them, and loads this file
 * the first time an animated theme is shown). The "holidays and seasons" themes and Grand Line,
 * drawn on a layer under the tree: snow and a garland all around the canvas at Christmas; at Halloween, moon and clouds,
 * flickering pumpkins, mist, spider, bats and ghosts; in spring, flowering cherry
 * branches, a flowery meadow, petals, butterflies and swallows; in summer, the beach
 * (waves, foam, blurred swimmers, a small shark, gulls); in autumn, trees losing
 * their coloured leaves in gusts of wind; on Grand Line, a manga page (ink
 * lines, screentone, sound effects) where a pirate ship sails, chased by the navy firing its
 * cannons, whose rubber-armed sailor catches his straw hat; islands, gulls and a
 * sea monster; in the faraway galaxy, drifting stars and nebulae, a ringed planet and twin
 * suns, starfighter and freighter chases with laser bolts and explosions, jumps to hyperspace,
 * a dagger-shaped cruiser, and on the ice a walker brought down by the tow cables of airspeeders.
 * Each object has its own size, speed and sway, drawn at random.
 */

import { t } from '../../i18n.js';

const TAU = 2 * Math.PI;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

/* ---------- What falls: snowflakes, petals, leaves ---------- */

/** A falling object, at the top (`top`) or anywhere in height `h`. */
function faller(w, h, top, size, colors) {
  const r = rand(...size);
  return {
    x: rand(0, w), y: top ? rand(-30, -5) : rand(0, h), r,
    speed: 0.25 + r * 0.12, sway: rand(0.4, 1.4), phase: rand(0, TAU),
    spin: rand(0, TAU), spinSpeed: rand(-0.04, 0.04), color: pick(colors), crystal: Math.random() < 0.35,
  };
}

/** Makes the objects fall; those leaving at the bottom restart from the top. `wind` pushes them sideways. */
function fall(list, w, h, now, wind, make) {
  list.forEach((f, i) => {
    f.y += f.speed;
    f.x += Math.sin((now / 900) * f.sway + f.phase) * 0.45 + wind * (0.6 + f.r * 0.08);
    f.spin += f.spinSpeed;
    if (f.y > h + 20 || f.x < -40 || f.x > w + 40) list[i] = make(true);
  });
}

/** Six-branched snow crystal, each branch with two small barbs. */
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

/** Cherry petal: two rounded lobes and a notch; it flips as it falls. */
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

/** Autumn leaf: pointed blade and vein; it spins and flips. */
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

/* ---------- What flies: butterflies, bats, ghosts ---------- */

/** An object crossing the canvas from one edge to the other, undulating. */
function flyer(w, h, speed, size) {
  const right = Math.random() < 0.5;
  return {
    x: right ? -30 : w + 30, y: rand(0.08, 0.9) * h, dir: right ? 1 : -1,
    speed: rand(...speed), wave: rand(10, 40), period: rand(1200, 2600), phase: rand(0, TAU),
    r: rand(...size), born: Date.now(),
  };
}

/** Moves a flying object; returns its current position, or null if it has left. */
function fly(b, now, w) {
  b.x += b.dir * b.speed;
  if (b.x < -60 || b.x > w + 60) return null;
  return [b.x, b.y + Math.sin(now / b.period * TAU + b.phase) * b.wave];
}

/** Butterfly: four flapping wings (seen from above, they fold). */
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

/** Bat: scalloped flapping wings, small ears. */
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

/** Ghost: it rises undulating, translucent, then vanishes. */
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

/** Sun glint: a small golden star that twinkles for a moment. */
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

/* ---------- Spring: flowering cherry, meadow, swallows ---------- */

const BLOSSOMS = ['#F7A8C4', '#FBC6D8', '#F48FB8', '#FFFFFF'];

/**
 * Cherry branch growing from a corner: twigs that branch out (lines), and five-petal
 * flowers in clusters at the tips and along the twigs.
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

/** Draws a branch that sways gently around its attachment. */
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

/** The meadow: tall grass waving in the wind, tulips and daisies. */
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

/** Grass and flowers of the meadow, across the full width. */
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

/** Swallow: crescent wings and a forked tail, it darts fast. */
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

/* ---------- Halloween: moon, pumpkins, mist, spider ---------- */

/** Full moon veiled in light, with dark clouds passing in front. */
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
  ctx.fillStyle = 'rgba(190, 170, 130, .35)'; // lunar seas
  for (const [dx, dy, cr] of [[-10, -8, 8], [9, 6, 6], [-4, 14, 5], [13, -12, 4]]) {
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, cr, 0, TAU);
    ctx.fill();
  }
  // Clouds: they cross slowly, left to right, and hide the moon as they pass
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

/** Carved pumpkin: ribs, stem, face lit by a flickering candle. */
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
  // Face: triangle eyes, jagged mouth, candlelight
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

/** Mist at ground level: purplish banks drifting slowly. */
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

/** Spider: it goes up and down on its thread, waving its legs. */
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
  ctx.fillStyle = '#E0483E'; // two red eyes
  ctx.fillRect(x - 1.8, y - 0.8, 1.2, 1.2);
  ctx.fillRect(x + 0.6, y - 0.8, 1.2, 1.2);
}

/* ---------- Christmas: the garland ---------- */

const BULBS = ['#FF4D4D', '#FFD45C', '#4DDB7A', '#5CB8FF'];

/**
 * The garland, all around the canvas: on each side, a wire sagging inwards between
 * fastenings, and bulbs facing the centre. A wave of light travels around the frame.
 */
function garland(ctx, w, h, now) {
  const span = 230;  // px entre deux attaches
  const sag = 26;    // the wire sags … px inwards
  const gap = 44;    // px entre deux ampoules
  const m = 4;       // margin at the edge
  // Sides clockwise: start, end, inward direction
  const sides = [[m, m, w - m, m, 0, 1], [w - m, m, w - m, h - m, -1, 0], [w - m, h - m, m, h - m, 0, -1], [m, h - m, m, m, 1, 0]];
  let bulb = 0;
  for (const [x0, y0, x1, y1, nx, ny] of sides) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const ux = (x1 - x0) / len;
    const uy = (y1 - y0) / len;
    const count = Math.max(1, Math.round(len / span));
    const seg = len / count;
    // Wire point at distance d from the start: Bézier curve between two fastenings, sagging inwards
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
    const angle = Math.atan2(ny, nx) - Math.PI / 2; // bulb facing inwards
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

/* ---------- Grand Line: a manga page of adventure at sea ---------- */

const INK = '#141414';           // line ink
const SFX_FONT = '"Noto Sans CJK JP", "Hiragino Kaku Gothic Pro", "Yu Gothic", "Meiryo", sans-serif';

/** Dot screentone, as on a printed page (repeated pattern, prepared once). */
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

/** Fills then inks the outline of the current path. */
function inked(ctx, fill, width = 2) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Manga cloud: white puffs outlined in ink (the line stays only on the outline). */
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
  ctx.fillStyle = 'rgba(120, 170, 215, .35)'; // shadow under the cloud
  ctx.beginPath();
  ctx.ellipse(x, y + 16 * s, 40 * s, 8 * s, 0, 0, Math.PI);
  ctx.fill();
}

/** Manga sun: outlined disc and pointed rays turning slowly. */
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

/** Island: sand mound, rocks and palm tree, outlined in ink. */
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

/** Row of manga waves: the sea inked along its top, foam crests in curls. */
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

/** Skull and crossbones, outlined: for the sail and the flag. */
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

// The sailor, in the ship's frame: head, right shoulder (where the rubber arm starts)
const SAILOR = { head: [-27, -52], shoulder: [-19, -41] };
const SKIN = '#F2C29B';

/** The captain: messy black hair, red sleeveless vest; right arm along the body when not stretched. */
function sailor(ctx, armOut) {
  const [hx, hy] = SAILOR.head;
  ctx.beginPath(); // legs (the lower part is hidden by the hull)
  ctx.rect(-33, -26, 5, 18);
  ctx.rect(-26, -26, 5, 18);
  inked(ctx, '#2B2D42', 1.2);
  ctx.beginPath(); // red sleeveless vest, open, with buttons
  ctx.roundRect(-36, -46, 18, 22, 4);
  inked(ctx, '#C8202E', 1.6);
  ctx.beginPath();
  ctx.moveTo(-27, -46);
  ctx.lineTo(-27, -24);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#FFD45A';
  for (const by of [-41, -35, -29]) ctx.fillRect(-30, by, 2, 2);
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
  ctx.beginPath(); // head
  ctx.arc(hx, hy, 8.5, 0, TAU);
  inked(ctx, SKIN, 1.6);
  ctx.beginPath(); // messy hair
  ctx.moveTo(hx - 9, hy - 1);
  for (let k = 0; k <= 6; k++) ctx.lineTo(hx - 9 + k * 3, hy - 8 - (k % 2 ? 5 : 1));
  ctx.lineTo(hx + 9, hy - 1);
  ctx.quadraticCurveTo(hx, hy - 6, hx - 9, hy - 1);
  inked(ctx, INK, 1);
  ctx.fillStyle = INK; // eye and big grin
  ctx.beginPath();
  ctx.arc(hx + 3.5, hy, 1.3, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(hx + 2, hy + 3, 3.5, 0.1, Math.PI - 0.6);
  ctx.stroke();
}

/** An ink-outlined arm, from (x0, y0) to (x1, y1), colour `color` (skin or sleeve). */
function limb(ctx, x0, y0, x1, y1, color) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.4;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.2;
  ctx.stroke();
}

/**
 * A crew member standing on deck at abscissa `x` (same build as the captain):
 * `top` shirt, `legs` trousers, `hair` hair; `extra(ctx, x, hx, hy, now)` for what sets them
 * apart (sabres, cigarette, long nose…), `arm(now)` for their moving right arm.
 */
function mate(ctx, x, now, { top, legs, hair, hairStyle, arm, extra }) {
  const hx = x;
  const hy = -52 + Math.sin(now / 260 + x) * 0.8;
  ctx.beginPath();
  ctx.rect(x - 7, -26, 5, 18);
  ctx.rect(x + 1, -26, 5, 18);
  inked(ctx, legs, 1.2);
  ctx.beginPath();
  ctx.roundRect(x - 9, -46, 18, 22, 4);
  inked(ctx, top, 1.6);
  limb(ctx, x - 8, -42, x - 12, -29, SKIN);
  const [ax, ay] = arm ? arm(now) : [x + 12, -29];
  limb(ctx, x + 8, -42, ax, ay, SKIN);
  if (hairStyle === 'long') { // long hair, behind the head
    ctx.beginPath();
    ctx.roundRect(hx - 10, hy - 9, 20, 22, 7);
    inked(ctx, hair, 1.2);
  }
  ctx.beginPath();
  ctx.arc(hx, hy, 8.5, 0, TAU);
  inked(ctx, SKIN, 1.6);
  if (hairStyle !== 'none') {
    ctx.beginPath(); // fringe
    ctx.moveTo(hx - 9, hy + 1);
    ctx.quadraticCurveTo(hx - 8, hy - 11, hx + 2, hy - 10);
    ctx.quadraticCurveTo(hx + 10, hy - 9, hx + 9, hy - 1);
    ctx.quadraticCurveTo(hx + 2, hy - 6, hx - 3, hy - 3);
    ctx.closePath();
    inked(ctx, hair, 1);
  }
  ctx.fillStyle = INK; // eye and smile
  ctx.beginPath();
  ctx.arc(hx + 3.5, hy, 1.3, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(hx + 2, hy + 3, 3.2, 0.1, Math.PI - 0.6);
  ctx.stroke();
  if (extra) extra(ctx, x, hx, hy, now);
}

/** The crew, from the mainmast to the bow: navigator, swordsman, cook, sniper. */
const CREW = [
  { // navigator: long orange hair, white top with a blue collar; she waves her map
    x: -7, top: '#FFFFFF', legs: '#3B6FB6', hair: '#F07F2A', hairStyle: 'long',
    arm: (now) => [-1, -64 + Math.sin(now / 400) * 2],
    extra(ctx, x, hx, hy, now) {
      ctx.beginPath(); // blue skirt
      ctx.rect(x - 9, -30, 18, 7);
      inked(ctx, '#3B6FB6', 1);
      ctx.save(); // the map
      ctx.translate(x + 5, -70 + Math.sin(now / 400) * 2);
      ctx.rotate(0.15);
      ctx.beginPath();
      ctx.rect(-3, -9, 10, 13);
      inked(ctx, '#F3E2B3', 1.2);
      ctx.strokeStyle = '#C41E3A';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-1, -5);
      ctx.lineTo(5, 1);
      ctx.moveTo(5, -5);
      ctx.lineTo(-1, 1);
      ctx.stroke();
      ctx.restore();
    },
  },
  { // swordsman: green bandana, white shirt, green sash, three sabres at the hip; arms crossed
    x: 12, top: '#F4F1E6', legs: '#2B2D42', hair: '#6FBF5A', hairStyle: 'short',
    arm: () => [7, -36],
    extra(ctx, x, hx, hy) {
      ctx.beginPath(); // bandana
      ctx.moveTo(hx - 9.5, hy - 1);
      ctx.quadraticCurveTo(hx, hy - 15, hx + 9.5, hy - 1);
      ctx.lineTo(hx - 9.5, hy - 1);
      inked(ctx, '#2F7D3A', 1.2);
      ctx.beginPath();
      ctx.rect(x - 9, -29, 18, 4); // sash
      inked(ctx, '#2F7D3A', 1);
      for (const [k, col] of [[0, '#FFFFFF'], [1, '#141414'], [2, '#C41E3A']]) { // three sabres at the hip
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(x + 6 + k * 2, -30);
        ctx.lineTo(x + 2 + k * 3, -12);
        ctx.stroke();
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    },
  },
  { // cook: blond hair over one eye, black suit, tie; a curl of smoke
    x: 31, top: '#1E1E24', legs: '#1E1E24', hair: '#F2D04B', hairStyle: 'short',
    extra(ctx, x, hx, hy, now) {
      ctx.beginPath(); // the lock hiding one eye
      ctx.moveTo(hx + 1, hy - 9);
      ctx.quadraticCurveTo(hx + 9, hy - 3, hx + 7, hy + 3);
      ctx.lineTo(hx + 1, hy - 2);
      ctx.closePath();
      inked(ctx, '#F2D04B', 1);
      ctx.beginPath(); // shirt and tie
      ctx.moveTo(x - 3, -43);
      ctx.lineTo(x, -32);
      ctx.lineTo(x + 3, -43);
      inked(ctx, '#3B6FB6', 1);
      ctx.strokeStyle = INK; // cigarette and smoke
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(hx + 4, hy + 4);
      ctx.lineTo(hx + 10, hy + 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(80, 80, 80, .6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(hx + 10, hy + 1);
      for (let k = 1; k <= 4; k++) ctx.lineTo(hx + 10 + Math.sin(now / 300 + k) * 3, hy + 1 - k * 4);
      ctx.stroke();
    },
  },
  { // sniper: long nose, checked bandana, curly black hair, overalls; he waves
    x: 50, top: '#C8A46A', legs: '#6B4E2E', hair: '#141414', hairStyle: 'none',
    arm: (now) => [60, -60 + Math.sin(now / 150) * 4],
    extra(ctx, x, hx, hy) {
      ctx.beginPath(); // black curls
      for (const [dx, dy] of [[-8, 3], [-9, -3], [-6, 7]]) {
        ctx.moveTo(hx + dx + 3.5, hy + dy);
        ctx.arc(hx + dx, hy + dy, 3.5, 0, TAU);
      }
      inked(ctx, '#141414', 1);
      ctx.beginPath(); // checked bandana
      ctx.moveTo(hx - 9.5, hy - 1);
      ctx.quadraticCurveTo(hx, hy - 15, hx + 9.5, hy - 1);
      ctx.lineTo(hx - 9.5, hy - 1);
      inked(ctx, '#C9B35A', 1.2);
      ctx.beginPath(); // long nose
      ctx.moveTo(hx + 7, hy - 1);
      ctx.lineTo(hx + 19, hy + 1);
      ctx.lineTo(hx + 7, hy + 3);
      inked(ctx, SKIN, 1.2);
    },
  },
];

/** Rubber arm: rubber wobbling from the shoulder to the hand, with a fist at the end. */
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
 * The sailor's hat: on his head; a gust of wind blows it away, his arm stretches like rubber
 * ("ビヨ〜ン!"), catches it in mid-air and puts it back. `ship`: position and scale of the ship.
 */
function hatAndArm(ctx, s, now, ship) {
  const world = ([lx, ly]) => [ship.x + lx * ship.s, ship.y + ly * ship.s];
  const head = world(SAILOR.head);
  const top = [head[0], head[1] - 9 * ship.s];
  const shoulder = world(SAILOR.shoulder);
  const size = 0.42 * ship.s;
  const hat = s.hat;
  const ease = (t) => 1 - (1 - t) ** 3;
  // The wind blows it backwards, at deck height (higher up, the tree cards would hide it),
  // when the ship is well inside the canvas
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
 * Pirate ship with a sheep's head, inked like a manga (heading right if dir = 1):
 * plank hull, woolly figurehead, mast and crow's nest, billowing mainsail with a
 * skull, jib, flapping flag. It rolls on the swell.
 */
function pirateShip(ctx, x, y, s, dir, now, crew) {
  const roll = Math.sin(now / 900) * 0.05;
  const bob = Math.sin(now / 700) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(roll);
  ctx.scale(s * dir, s);
  ctx.lineJoin = 'round';
  // Mast, jib and mainsail (behind the hull)
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
  ctx.strokeStyle = 'rgba(20, 20, 20, .25)'; // folds of the canvas
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
  // Crow's nest and black flag flapping in the wind
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
  // Plank hull
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
  // The captain and his crew, standing behind the rail (his right arm, when stretched, is drawn separately)
  sailor(ctx, crew && crew.armOut);
  for (const m of CREW) mate(ctx, m.x, now, m);
  // Figurehead: a woolly sheep, outlined, with a spiral horn
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

/** Sea monster: a giant serpent head outlined in ink, which surfaces then dives back. `age`: 0 to 1. */
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
  ctx.beginPath(); // belly
  ctx.moveTo(x + 16, top + 68);
  ctx.quadraticCurveTo(x + 14, top + 110, x + 26, base + 10);
  ctx.lineTo(x + 19, base + 10);
  ctx.quadraticCurveTo(x + 8, top + 110, x + 11, top + 68);
  inked(ctx, '#F1E3A0', 1.4);
  for (let k = 0; k < 5; k++) { // crest
    const cy = top + 22 + k * 20;
    ctx.beginPath();
    ctx.moveTo(x - 14 - k * 2, cy);
    ctx.lineTo(x - 34 - k * 2, cy + 7);
    ctx.lineTo(x - 16 - k * 2, cy + 14);
    inked(ctx, '#1F7A4C', 1.4);
  }
  ctx.beginPath(); // jaws
  ctx.moveTo(x + 44, top + 34);
  ctx.lineTo(x + 26, top + 36);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath(); // eye
  ctx.arc(x + 24, top + 16, 7, 0, TAU);
  inked(ctx, '#FFFFFF', 2);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x + 26 + Math.sin(now / 500) * 2, top + 16, 3.4, 0, TAU);
  ctx.fill();
  ctx.restore();
  for (let k = 0; k < 8; k++) { // spray of foam
    ctx.beginPath();
    ctx.arc(x - 34 + k * 10, base - 2 - Math.abs(Math.sin(now / 160 + k)) * 8 * rise, 5.5, 0, TAU);
    inked(ctx, '#FFFFFF', 1.4);
  }
}

/** Speed lines: ink rays radiating from a point, for a big moment. */
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

/** Manga sound effect: big black letters outlined in white, popping out. */
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

/** The sailor's straw hat: on his head (`spin` zero) or blown away by the wind, spinning. */
function strawHat(ctx, x, y, size, spin) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.scale(size, size);
  ctx.beginPath();
  ctx.ellipse(0, 6, 34, 9, 0, 0, TAU); // brim
  inked(ctx, '#F2C24E', 2.2);
  ctx.beginPath();
  ctx.moveTo(-17, 4);
  ctx.bezierCurveTo(-18, -20, 18, -20, 17, 4); // crown
  inked(ctx, '#F2C24E', 2.2);
  ctx.beginPath();
  ctx.moveTo(-17, 3);
  ctx.bezierCurveTo(-17, -4, 17, -4, 17, 3); // navy-blue ribbon
  ctx.lineTo(17.5, -2);
  ctx.bezierCurveTo(17, -9, -17, -9, -17.5, -2);
  ctx.closePath();
  inked(ctx, '#1F3A6E', 1.6);
  ctx.strokeStyle = 'rgba(140, 100, 30, .55)'; // weave
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let a = -28; a <= 28; a += 7) {
    ctx.moveTo(a, 1);
    ctx.lineTo(a * 1.12, 12);
  }
  ctx.stroke();
  ctx.restore();
}

/** Navy sailor: white cap, blue collar; he moves about (arm raised now and then). */
function marine(ctx, x, y, now, k) {
  ctx.beginPath();
  ctx.rect(x - 4, y - 14, 8, 12); // jumper
  inked(ctx, '#FFFFFF', 1.2);
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 14);
  ctx.lineTo(x, y - 9);
  ctx.lineTo(x + 4, y - 14);
  inked(ctx, '#2E5AAC', 1); // blue collar
  ctx.beginPath();
  ctx.arc(x, y - 19, 4.5, 0, TAU);
  inked(ctx, SKIN, 1.2);
  ctx.beginPath();
  ctx.rect(x - 5, y - 25, 10, 3.5); // cap
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

/** Billowing square sail, from `x0` to `x1` and from `y0` to `y1`, with its two folds. */
function squareSail(ctx, x0, x1, y0, y1, puff) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo((x0 + x1) / 2, y0 + puff / 2, x1, y0);
  ctx.quadraticCurveTo(x1 + puff, (y0 + y1) / 2, x1, y1);
  ctx.quadraticCurveTo((x0 + x1) / 2, y1 + puff, x0, y1);
  ctx.quadraticCurveTo(x0 + puff, (y0 + y1) / 2, x0, y0);
  inked(ctx, '#FFFFFF', 2);
  ctx.strokeStyle = 'rgba(20, 20, 20, .2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const k of [0.3, 0.7]) {
    const x = x0 + (x1 - x0) * k;
    ctx.moveTo(x, y0 + 4);
    ctx.quadraticCurveTo(x + puff / 2, (y0 + y1) / 2, x, y1 - 2);
  }
  ctx.stroke();
  ctx.beginPath(); // yard, with red ends
  ctx.rect(x0 - 6, y0 - 4, x1 - x0 + 12, 4);
  inked(ctx, '#7A6A55', 1.2);
  for (const x of [x0 - 8, x1 + 2]) {
    ctx.beginPath();
    ctx.rect(x, y0 - 5, 6, 6);
    inked(ctx, '#C8202E', 1);
  }
}

/** Red-roofed crow's nest at the top of a mast, and its flapping white pennant. */
function lookout(ctx, x, y, now) {
  ctx.beginPath();
  ctx.rect(x - 8, y, 16, 10);
  inked(ctx, '#F3E2B3', 1.2);
  ctx.beginPath();
  ctx.rect(x - 2, y + 3, 4, 4);
  inked(ctx, '#2B2D42', 0.8);
  ctx.beginPath();
  ctx.moveTo(x - 11, y);
  ctx.lineTo(x, y - 8);
  ctx.lineTo(x + 11, y);
  ctx.closePath();
  inked(ctx, '#C8202E', 1.2);
  ctx.beginPath();
  ctx.moveTo(x, y - 8);
  ctx.lineTo(x, y - 20);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - 20);
  for (let k = 1; k <= 3; k++) ctx.lineTo(x - k * 7, y - 19 + Math.sin(now / 120 + k) * 2 * (k / 3));
  ctx.lineTo(x, y - 14);
  ctx.closePath();
  inked(ctx, '#FFFFFF', 1);
}

/** Figurehead: a bulldog holding a bone, tongue hanging out, spiked collar, long white neck. */
function dogHead(ctx, x, y, now) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.5, 1.5);
  ctx.beginPath(); // white neck joining the stem
  ctx.moveTo(-14, 30);
  ctx.quadraticCurveTo(-6, 10, -4, 0);
  ctx.lineTo(14, 0);
  ctx.quadraticCurveTo(10, 22, 2, 34);
  ctx.closePath();
  inked(ctx, '#FFFFFF', 2);
  ctx.beginPath(); // red spiked collar
  ctx.rect(-8, -2, 26, 7);
  inked(ctx, '#C8202E', 1.4);
  for (const sx of [-6, 3, 12, 20]) {
    ctx.beginPath();
    ctx.moveTo(sx - 3, 5);
    ctx.lineTo(sx, 14);
    ctx.lineTo(sx + 3, 5);
    ctx.closePath();
    inked(ctx, '#F3E2B3', 1);
  }
  ctx.beginPath(); // head
  ctx.ellipse(6, -16, 17, 15, 0, 0, TAU);
  inked(ctx, '#B68A5C', 2);
  ctx.beginPath(); // ear
  ctx.ellipse(-6, -28, 6, 4, -0.6, 0, TAU);
  inked(ctx, '#6E4F32', 1.4);
  ctx.beginPath(); // muzzle
  ctx.ellipse(18, -10, 10, 8, 0, 0, TAU);
  inked(ctx, '#7A5A3C', 1.6);
  ctx.beginPath(); // nose
  ctx.ellipse(25, -14, 4, 3, 0, 0, TAU);
  inked(ctx, INK, 1);
  ctx.beginPath(); // green eye, frowning brow
  ctx.ellipse(10, -22, 4, 3, 0, 0, TAU);
  inked(ctx, '#C8E86A', 1.2);
  ctx.fillStyle = INK;
  ctx.fillRect(10, -23, 1.8, 2);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(5, -27);
  ctx.lineTo(15, -25);
  ctx.stroke();
  const lick = Math.sin(now / 300) * 2; // pink tongue hanging out
  ctx.beginPath();
  ctx.moveTo(14, -3);
  ctx.quadraticCurveTo(13, 8 + lick, 18, 9 + lick);
  ctx.quadraticCurveTo(23, 8 + lick, 22, -3);
  ctx.closePath();
  inked(ctx, '#E8607A', 1.2);
  ctx.beginPath(); // the bone across the jaws
  ctx.rect(2, -6, 34, 5);
  for (const bx of [2, 36]) {
    ctx.moveTo(bx + 3.5, -7);
    ctx.arc(bx, -7, 3.5, 0, TAU);
    ctx.moveTo(bx + 3.5, 0);
    ctx.arc(bx, 0, 3.5, 0, TAU);
  }
  inked(ctx, '#FFFDF4', 1.4);
  ctx.restore();
}

/**
 * Navy ship (heading right): striped sea-green hull, two masts with red-roofed crow's
 * nests, sails marked "MARINE" and "海軍", bulldog figurehead, sailors on deck.
 * It rolls too.
 */
function navyShip(ctx, x, y, s, now) {
  ctx.save();
  ctx.translate(x, y + Math.sin(now / 760 + 1) * 3);
  ctx.rotate(Math.sin(now / 980 + 1) * 0.04);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  const puff = 8 + Math.sin(now / 650) * 2;
  ctx.beginPath(); // mainmast (aft) and foremast (forward)
  ctx.rect(-33, -178, 6, 172);
  ctx.rect(31, -150, 6, 144);
  inked(ctx, '#7A6A55', 1.6);
  squareSail(ctx, -74, 14, -164, -128, puff * 0.7);
  squareSail(ctx, -80, 20, -122, -52, puff);
  squareSail(ctx, 0, 66, -134, -104, puff * 0.7);
  squareSail(ctx, -4, 72, -98, -46, puff);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1F3A8E';
  ctx.font = '900 15px "Atkinson Hyperlegible", sans-serif';
  ctx.fillText('MARINE', -30 + puff / 2, -80);
  ctx.font = '900 22px serif';
  ctx.fillText('海軍', 34 + puff / 2, -66);
  lookout(ctx, -30, -188, now);
  lookout(ctx, 34, -160, now + 400);
  // Sailors on deck, behind the rail
  for (const [mx, k] of [[-56, 0], [-12, 1], [10, 2], [52, 3]]) marine(ctx, mx, -10, now, k);
  // Sea-green hull, striped with dark bands, red wale, gunports and cannons
  ctx.beginPath();
  ctx.moveTo(-84, -30);
  ctx.lineTo(-66, -30);
  ctx.lineTo(-66, -10);
  ctx.lineTo(66, -10);
  ctx.quadraticCurveTo(80, -14, 88, -24);
  ctx.quadraticCurveTo(86, 14, 50, 28);
  ctx.lineTo(-56, 28);
  ctx.quadraticCurveTo(-80, 16, -84, -30);
  ctx.closePath();
  inked(ctx, '#2FA79A', 2.6);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#17615C';
  for (let k = -100; k < 100; k += 22) {
    ctx.beginPath();
    ctx.moveTo(k, -34);
    ctx.quadraticCurveTo(k + 10, -6, k + 2, 30);
    ctx.lineTo(k + 8, 30);
    ctx.quadraticCurveTo(k + 16, -6, k + 6, -34);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.rect(-66, -15, 132, 5);
  inked(ctx, '#C8202E', 1.2);
  for (const cx of [-44, -18, 8, 34]) {
    ctx.beginPath();
    ctx.arc(cx, 4, 5, 0, TAU);
    inked(ctx, '#F3E2B3', 1.4);
    ctx.beginPath();
    ctx.arc(cx, 4, 2.6, 0, TAU);
    inked(ctx, '#2B2D42', 0.8);
  }
  dogHead(ctx, 88, -50, now);
  ctx.restore();
}

/** Cannon shot: flash and smoke at the muzzle, ball in an arc, water spout on impact. `t`: 0 to 1. */
function cannonShot(ctx, from, to, t) {
  if (t < 0.2) { // flash and smoke
    const k = t / 0.2;
    ctx.beginPath();
    ctx.arc(from[0] + 10, from[1], 10 + k * 16, 0, TAU);
    inked(ctx, k < 0.4 ? '#FFD45A' : '#F2F2F2', 1.4);
  }
  if (t < 0.75) { // ball in an arc
    const k = t / 0.75;
    const x = from[0] + (to[0] - from[0]) * k;
    const y = from[1] + (to[1] - from[1]) * k - Math.sin(k * Math.PI) * 120;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, TAU);
    inked(ctx, '#2B2B2B', 1.4);
  } else { // water spout
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
 * The page: toned sky, sun, clouds, islands, sea in inked layers, ship, gulls;
 * now and then, a sea monster surfacing (speed lines and "ドン!!"), a "ザザーン"
 * of waves, the sailor's hat blown away by the wind and caught with a rubber arm, and a
 * navy ship chasing it and firing its cannons ("ドーン!", "ドボン!").
 */
function grandLine(ctx, s, now, w, h) {
  const horizon = h * 0.6;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#3FA9E6');
  sky.addColorStop(1, '#C9ECFA');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);
  // Screentone at the top of the sky
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
  // Sea monster: it surfaces, speed lines and "ドン!!", then dives back
  if (!s.monster && now > s.nextMonster) s.monster = { x: rand(0.2, 0.8) * w, born: now };
  if (s.monster) {
    const age = (now - s.monster.born) / 7000;
    const base = horizon + h * 0.08;
    const peak = Math.max(0, Math.sin(Math.min(1, age) * Math.PI));
    if (age > 0.12 && age < 0.8) speedLines(ctx, s.monster.x + 20, base - 120 * peak, w, h, peak, now);
    seaMonster(ctx, s.monster.x, base, age, now);
    // At the top, in the sky: in the middle of the canvas, the tree cards would hide it
    if (age > 0.18 && age < 0.85) sfx(ctx, 'ドン!!', s.monster.x < w / 2 ? w * 0.3 : w * 0.62, h * 0.11, 92, -0.15, (age - 0.18) * 8);
    if (age > 1) {
      s.monster = null;
      s.nextMonster = now + rand(16000, 28000);
    }
  }
  // The ship crosses in a loop at the bottom of the canvas, under the tree cards
  const crossing = (w + 400) / 0.035;
  const shipX = ((now % crossing) / crossing) * (w + 400) - 200;
  const shipY = h * 0.9;
  for (let k = 1; k < 6; k++) { // wake
    ctx.beginPath();
    ctx.ellipse(shipX - k * 28, shipY + 20 + Math.sin(now / 300 + k) * 2, 15 - k, 3.5, 0, 0, TAU);
    inked(ctx, '#FFFFFF', 1.2);
  }
  mangaWaves(ctx, horizon + h * 0.17, w, now, 40, 6, '#2B88C8', true);
  const shipScale = Math.min(1.4, h / 540);
  // The navy chases it, a little behind (further away, so smaller); it fires now and then
  const navyX = shipX - w * 0.42;
  const navyY = shipY - h * 0.05;
  navyShip(ctx, navyX, navyY, shipScale * 0.82, now);
  if (!s.shot && now > s.nextShot && navyX > w * 0.08 && shipX < w * 0.95) s.shot = { born: now };
  if (s.shot) {
    const t = (now - s.shot.born) / 2200;
    const from = [navyX + 34 * shipScale * 0.82, navyY];
    const to = [shipX - 140 * shipScale, shipY + 20]; // just behind the stern: a miss!
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
  // "ザザーン": the sound of the waves, now and then, on the water
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
  // Gulls
  release(s.gulls, 4, 0.01, () => ({ ...flyer(w, h, [1, 2], [8, 12]), y: rand(0.08, 0.4) * h }));
  s.gulls = s.gulls.filter((b) => {
    const at = fly(b, now, w);
    if (at) gull(ctx, ...at, b, now);
    return !!at;
  });
}

/* ---------- Faraway galaxy: deep space, starfighters, hyperspace ---------- */

const STAR_TINTS = ['#FFFFFF', '#FFFFFF', '#CFE0FF', '#FFF1C9', '#BFD4FF', '#FFD2D2'];
const NEBULAE = [
  { x: 0.78, y: 0.3, r: 0.38, color: 'rgba(110, 60, 200, .2)', phase: 0 },
  { x: 0.25, y: 0.2, r: 0.3, color: 'rgba(40, 120, 220, .16)', phase: 2 },
  { x: 0.55, y: 0.8, r: 0.32, color: 'rgba(210, 70, 130, .1)', phase: 4 },
];

/** A star at depth `z` (0.15 far, 1 near): the near ones are bigger, brighter and drift faster. */
const spaceStar = (w, h) => ({ x: rand(0, w), y: rand(0, h), z: rand(0.15, 1), phase: rand(0, TAU), color: pick(STAR_TINTS) });

/** Deep space: dark blue to black, and slow nebulae. */
function deepSpace(ctx, now, w, h) {
  const sky = ctx.createRadialGradient(w * 0.6, h * 0.35, 0, w * 0.6, h * 0.35, Math.max(w, h) * 0.9);
  sky.addColorStop(0, '#101A44');
  sky.addColorStop(0.55, '#070B22');
  sky.addColorStop(1, '#02030A');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  for (const n of NEBULAE) {
    const x = n.x * w + Math.sin(now / 40000 + n.phase) * 30;
    const y = n.y * h + Math.cos(now / 50000 + n.phase) * 20;
    const r = n.r * Math.max(w, h);
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, n.color);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
}

/** The stars drift to the left, each at the speed of its depth, and twinkle. */
function starDrift(ctx, s, now, w, h) {
  for (const st of s.stars) {
    st.x -= st.z * 0.12;
    if (st.x < -2) Object.assign(st, { x: w + 2, y: rand(0, h) });
    ctx.globalAlpha = 0.35 + 0.65 * st.z * (0.75 + 0.25 * Math.sin((now / 500) * st.z + st.phase));
    ctx.fillStyle = st.color;
    ctx.beginPath();
    ctx.arc(st.x, st.y, 0.4 + st.z * 1.1, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Glowing disc: a sun, an engine, the tip of a bolt. */
function glow(ctx, x, y, r, core, halo) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
  g.addColorStop(0, halo);
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = core;
  ctx.fill();
}

/** Rings: thin bands of ice and dust with a dark gap; the back half before the globe, the front half after it. */
function rings(ctx, r, a0, a1, front) {
  const tones = ['#E9D6B4', '#D8BE97', '#C6A47C', '#EFE2C8', '#B8946C', '#E3CCA6'];
  for (let k = 1.3, i = 0; k < 1.98; k += 0.024, i++) {
    if (k > 1.6 && k < 1.67) continue; // the dark division between the two main rings
    ctx.beginPath();
    ctx.ellipse(0, 0, r * k, r * k * 0.26, 0, a0, a1);
    ctx.strokeStyle = tones[i % tones.length];
    ctx.globalAlpha = (front ? 0.55 : 0.4) * (k < 1.6 ? 1 : 0.7) * (0.7 + 0.3 * Math.sin(i * 1.7));
    ctx.lineWidth = r * 0.022;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/**
 * Ringed gas giant, half out of the frame, lit from the upper right by the twin suns: banded
 * globe with a storm, shaded night side, highlight, glowing rim, shadow of the rings; its moon goes round it.
 */
function ringedPlanet(ctx, x, y, r, now) {
  const lx = 0.5; // light, towards the upper right
  const ly = -0.5;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.32);
  rings(ctx, r, Math.PI, TAU, false);
  // Atmosphere: a blue haze around the globe
  const haze = ctx.createRadialGradient(0, 0, r * 0.95, 0, 0, r * 1.2);
  haze.addColorStop(0, 'rgba(120, 170, 255, .35)');
  haze.addColorStop(1, 'rgba(120, 170, 255, 0)');
  ctx.fillStyle = haze;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.2, 0, TAU);
  ctx.fill();
  const body = ctx.createRadialGradient(lx * r * 0.6, ly * r * 0.6, 0, 0, 0, r * 1.3);
  body.addColorStop(0, '#F8DDB4');
  body.addColorStop(0.35, '#DDA06A');
  body.addColorStop(0.7, '#A25E3B');
  body.addColorStop(1, '#3A1A22');
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Cloud bands, slightly bent by the curve of the globe, drifting at their own speed
  [[-0.7, 0.1, '#F6DDB6'], [-0.48, 0.16, '#8C4B33'], [-0.22, 0.08, '#F8E6C4'], [-0.05, 0.2, '#B0663F'], [0.24, 0.1, '#ECC49A'], [0.42, 0.18, '#7E3F2C'], [0.68, 0.12, '#E2B485']].forEach(([at, size, color], i) => {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(Math.sin(now / (5000 + i * 700) + i) * r * 0.12, at * r, r * 1.15, size * r * 0.5, 0, 0, TAU);
    ctx.fill();
    // Eddies along the edge of the band
    ctx.globalAlpha = 0.25;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.ellipse(((k * 0.43 + i * 0.29 + now / (14000 + i * 2500)) % 2 - 1) * r, (at + size * 0.25) * r, r * 0.09, r * 0.025, 0, 0, TAU);
      ctx.fill();
    }
  });
  // The great storm turns with the globe: it crosses the face, narrowing near the edge, swirling, lit by lightning
  const lon = ((now / 26000) % 2) - 1;
  const sx = lon * r * Math.sqrt(1 - 0.31 ** 2);
  const narrow = Math.sqrt(Math.max(0, 1 - lon * lon));
  if (narrow > 0.05) {
    ctx.save();
    ctx.translate(sx, r * 0.31);
    ctx.scale(narrow, 1);
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.17, r * 0.075, 0, 0, TAU);
    ctx.fillStyle = '#C8714A';
    ctx.fill();
    ctx.rotate(now / 3000);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.1, r * 0.04, 0, 0, TAU);
    ctx.fillStyle = '#F1C49A';
    ctx.fill();
    ctx.globalAlpha = 1;
    if (Math.sin(now / 170) > 0.93) glow(ctx, rand(-0.08, 0.08) * r, rand(-0.03, 0.03) * r, r * 0.02, '#FFFFFF', 'rgba(190, 220, 255, .8)');
    ctx.restore();
  }
  // Shadow of the rings, a little below them
  ctx.beginPath();
  ctx.ellipse(0, r * 0.14, r * 1.5, r * 0.39, 0, 0, Math.PI);
  ctx.strokeStyle = 'rgba(10, 6, 12, .45)';
  ctx.lineWidth = r * 0.13;
  ctx.stroke();
  // Night side and highlight
  const night = ctx.createRadialGradient(lx * r * 0.5, ly * r * 0.5, r * 0.5, lx * r * 0.2, ly * r * 0.2, r * 1.35);
  night.addColorStop(0, 'rgba(3, 4, 14, 0)');
  night.addColorStop(1, 'rgba(3, 4, 14, .9)');
  ctx.fillStyle = night;
  ctx.fillRect(-r, -r, 2 * r, 2 * r);
  const shine = ctx.createRadialGradient(lx * r * 0.6, ly * r * 0.6, 0, lx * r * 0.6, ly * r * 0.6, r * 0.45);
  shine.addColorStop(0, 'rgba(255, 250, 235, .3)');
  shine.addColorStop(1, 'rgba(255, 250, 235, 0)');
  ctx.fillStyle = shine;
  ctx.fillRect(-r, -r, 2 * r, 2 * r);
  ctx.restore();
  // Glowing rim on the lit side
  ctx.save();
  ctx.shadowColor = 'rgba(160, 205, 255, .9)';
  ctx.shadowBlur = 10;
  ctx.strokeStyle = 'rgba(190, 220, 255, .7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI * 0.95, Math.PI * 0.05);
  ctx.stroke();
  ctx.restore();
  rings(ctx, r, 0, Math.PI, true);
  ctx.restore();
  // The moon: in front of the planet on half of its orbit, hidden behind it on the other half
  const a = now / 14000;
  if (Math.sin(a) > -0.2) {
    const mr = r * 0.075;
    const mx = x + Math.cos(a) * r * 1.9;
    const my = y - r * 0.55 + Math.sin(a) * r * 0.35;
    const moon = ctx.createRadialGradient(mx + mr * 0.4, my - mr * 0.4, 0, mx, my, mr);
    moon.addColorStop(0, '#E4E9F0');
    moon.addColorStop(0.6, '#9AA3B0');
    moon.addColorStop(1, '#2A2F3A');
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, TAU);
    ctx.fillStyle = moon;
    ctx.fill();
    ctx.fillStyle = 'rgba(60, 66, 80, .45)'; // craters
    for (const [cx, cy, cr] of [[-0.3, 0.1, 0.22], [0.25, 0.35, 0.15], [0.1, -0.35, 0.12]]) {
      ctx.beginPath();
      ctx.arc(mx + cx * mr, my + cy * mr, cr * mr, 0, TAU);
      ctx.fill();
    }
  }
}

/** Plating for a capital ship: small light and dark plates on each face, drawn once per ship. */
function hullPlates() {
  return Array.from({ length: 140 }, () => ({
    u: rand(0.12, 0.98), v: rand(0.08, 0.92), w: rand(0.008, 0.03), h: rand(1.2, 3.2),
    up: Math.random() < 0.55, tone: pick(['#C3CAD5', '#B0B8C4', '#7C8595', '#6A7383', '#D5DBE3']),
  }));
}

/** A box seen slightly from above and from the right: front, top and side, so it stands out. */
function box(ctx, x, y, w, h, depth) {
  const front = ctx.createLinearGradient(0, y, 0, y + h);
  front.addColorStop(0, '#AEB6C3');
  front.addColorStop(1, '#717A8A');
  ctx.fillStyle = front;
  ctx.fillRect(x, y, w, h);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w + depth, y - depth * 0.5);
  ctx.lineTo(x + depth, y - depth * 0.5);
  ctx.closePath();
  ctx.fillStyle = '#D3D9E2';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w, y);
  ctx.lineTo(x + w + depth, y - depth * 0.5);
  ctx.lineTo(x + w + depth, y + h - depth * 0.5);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fillStyle = '#5D6575';
  ctx.fill();
  ctx.strokeStyle = 'rgba(30, 34, 44, .7)';
  ctx.lineWidth = 0.6;
  ctx.strokeRect(x, y, w, h);
}

/** Domed sensor: a lit sphere. */
function dome(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x + r * 0.35, y - r * 0.4, 0, x, y, r);
  g.addColorStop(0, '#F1F4F8');
  g.addColorStop(0.6, '#9AA3B0');
  g.addColorStop(1, '#4A5160');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = g;
  ctx.fill();
}

/**
 * Dagger-shaped capital ship, nose at (x, y) pointing left, lit from above: shaded upper and
 * lower faces split by a bright ridge, plating, stepped superstructure in relief with lit windows,
 * bridge tower and its two domes, blazing engines at the stern.
 */
function cruiser(ctx, c, x, y, L, now) {
  const H = L * 0.24;
  const up = (u) => -H * 0.5 * u;   // edge of the upper face, at fraction u of the length
  const down = (u) => H * 0.45 * u; // edge of the lower face
  ctx.save();
  ctx.translate(x, y);
  // Engine haze behind the stern
  const haze = ctx.createRadialGradient(L, 0, 0, L, 0, H * 0.9);
  haze.addColorStop(0, 'rgba(120, 200, 255, .35)');
  haze.addColorStop(1, 'rgba(120, 200, 255, 0)');
  ctx.fillStyle = haze;
  ctx.fillRect(L - H, -H, H * 2, H * 2);
  // Stern, seen at an angle: it gives the hull its thickness
  const stern = H * 0.16;
  ctx.beginPath();
  ctx.moveTo(L, up(1));
  ctx.lineTo(L + stern, up(1) + stern * 0.4);
  ctx.lineTo(L + stern, down(1) - stern * 0.4);
  ctx.lineTo(L, down(1));
  ctx.closePath();
  const back = ctx.createLinearGradient(L, 0, L + stern, 0);
  back.addColorStop(0, '#4A5160');
  back.addColorStop(1, '#2B313C');
  ctx.fillStyle = back;
  ctx.fill();
  // Upper face
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(L, up(1));
  ctx.lineTo(L, 0);
  ctx.closePath();
  const top = ctx.createLinearGradient(0, up(1), 0, 0);
  top.addColorStop(0, '#9AA3B1');
  top.addColorStop(1, '#DCE2EA');
  ctx.fillStyle = top;
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (const p of c.plates) if (p.up) {
    ctx.fillStyle = p.tone;
    ctx.fillRect(L * p.u, up(p.u) * p.v, L * p.w, p.h);
  }
  ctx.strokeStyle = 'rgba(40, 46, 58, .35)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (const k of [0.25, 0.5, 0.75]) { // seams running to the nose
    ctx.moveTo(0, 0);
    ctx.lineTo(L, up(k));
  }
  for (const k of [0.25, 0.4, 0.55, 0.7, 0.85]) {
    ctx.moveTo(L * k, up(k));
    ctx.lineTo(L * k, 0);
  }
  ctx.stroke();
  ctx.restore();
  // Lower face, in the shade
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(L, 0);
  ctx.lineTo(L, down(1));
  ctx.closePath();
  const under = ctx.createLinearGradient(0, 0, 0, down(1));
  under.addColorStop(0, '#6E7787');
  under.addColorStop(1, '#30363F');
  ctx.fillStyle = under;
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (const p of c.plates) if (!p.up) {
    ctx.fillStyle = p.tone;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(L * p.u, down(p.u) * p.v, L * p.w, p.h);
  }
  // Hangar bay under the hull, glowing
  const bay = ctx.createLinearGradient(L * 0.45, 0, L * 0.6, 0);
  bay.addColorStop(0, 'rgba(255, 210, 140, 0)');
  bay.addColorStop(0.5, 'rgba(255, 210, 140, .55)');
  bay.addColorStop(1, 'rgba(255, 210, 140, 0)');
  ctx.fillStyle = bay;
  ctx.fillRect(L * 0.45, down(0.5) * 0.55, L * 0.15, H * 0.05);
  ctx.restore();
  // Outline and the bright ridge between the two faces
  ctx.strokeStyle = '#2B313C';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(L, up(1));
  ctx.lineTo(0, 0);
  ctx.lineTo(L, down(1));
  ctx.stroke();
  ctx.strokeStyle = '#F2F5F9';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(L, 0);
  ctx.stroke();
  // Windows along the ridge, some lit
  for (let k = 0; k < 40; k++) {
    const u = 0.15 + k * 0.021;
    ctx.fillStyle = Math.sin(k * 12.9 + now / 900) > 0.2 ? '#FFE9A8' : 'rgba(255, 233, 168, .25)';
    ctx.fillRect(L * u, 2, 1.3, 1.3);
  }
  // Superstructure: boxes stepping up to the bridge
  const depth = H * 0.12;
  for (let i = 0; i < 4; i++) {
    const u = 0.56 + i * 0.085;
    const tall = H * (0.08 + i * 0.055);
    box(ctx, L * u, up(u) - tall, L * 0.12, tall + 2, depth);
    ctx.fillStyle = '#FFE9A8';
    for (let k = 0; k < 6; k++) if ((k + i) % 3) ctx.fillRect(L * u + 3 + k * L * 0.018, up(u) - tall * 0.5, 1.2, 1.2);
  }
  // Gun turrets along the upper edge; now and then one fires a green bolt
  for (const u of [0.22, 0.32, 0.42, 0.5]) {
    box(ctx, L * u, up(u) - H * 0.035, L * 0.018, H * 0.035, depth * 0.4);
    ctx.strokeStyle = '#2B313C';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(L * u, up(u) - H * 0.025);
    ctx.lineTo(L * u - L * 0.02, up(u) - H * 0.045);
    ctx.stroke();
    if (Math.random() < 0.004) c.shots.push({ x: x + L * u - L * 0.02, y: y + up(u) - H * 0.045, dx: -7, dy: rand(-2.5, 1), color: '#7CFF6B', life: 50 });
  }
  // Antennas on the tower
  ctx.strokeStyle = '#8C95A4';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(L * 0.92, up(1) - H * 0.52);
  ctx.lineTo(L * 0.92, up(1) - H * 0.72);
  ctx.moveTo(L * 0.95, up(1) - H * 0.52);
  ctx.lineTo(L * 0.95, up(1) - H * 0.64);
  ctx.stroke();
  ctx.fillStyle = Math.sin(now / 300) > 0 ? '#FF5C5C' : 'rgba(255, 92, 92, .3)';
  ctx.fillRect(L * 0.92 - 1, up(1) - H * 0.74, 2, 2);
  // Bridge tower: neck, bridge with its window band, two domes
  box(ctx, L * 0.9, up(1) - H * 0.42, L * 0.045, H * 0.4, depth * 0.6);
  box(ctx, L * 0.855, up(1) - H * 0.52, L * 0.13, H * 0.09, depth * 0.8);
  ctx.fillStyle = '#FFE9A8';
  ctx.fillRect(L * 0.86, up(1) - H * 0.48, L * 0.12, 1.2);
  dome(ctx, L * 0.865, up(1) - H * 0.58, H * 0.05);
  dome(ctx, L * 0.975, up(1) - H * 0.58, H * 0.05);
  // Engines: dark nozzles, white-hot cores, flickering blue bloom
  for (const [dy, size] of [[-0.3, 0.1], [-0.05, 0.12], [0.2, 0.1], [-0.42, 0.05], [0.33, 0.05]]) {
    const ey = H * dy;
    const er = H * size;
    ctx.beginPath();
    ctx.arc(L + stern * 0.6, ey, er * 1.2, 0, TAU);
    ctx.fillStyle = '#2B313C';
    ctx.fill();
    glow(ctx, L + stern * 0.6, ey, er * (0.85 + Math.sin(now / 90 + dy * 20) * 0.08), '#F2FBFF', 'rgba(92, 200, 255, .6)');
  }
  ctx.restore();
  c.shots = c.shots.filter((b) => {
    b.x += b.dx;
    b.y += b.dy;
    bolt(ctx, b);
    return --b.life > 0;
  });
}

/**
 * Saucer-shaped light freighter seen from above, nose towards `angle`: two forward prongs,
 * cockpit tube on the right side, gun turret, plating, and the wide blue glow of its engines.
 * `boost` (0 to 1) makes the engines blaze (jump to hyperspace).
 */
function freighter(ctx, x, y, R, angle, now, boost = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Engines: a wide band of blue light along the back of the saucer
  ctx.save();
  ctx.shadowColor = '#5CC8FF';
  ctx.shadowBlur = R * (0.6 + boost * 1.4);
  ctx.strokeStyle = boost > 0.5 ? '#FFFFFF' : '#BDE6FF';
  ctx.lineWidth = R * (0.16 + boost * 0.1) * (0.9 + Math.sin(now / 70) * 0.1);
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.98, Math.PI * 0.72, Math.PI * 1.28);
  ctx.stroke();
  ctx.restore();
  const hull = ctx.createRadialGradient(-R * 0.25, -R * 0.35, R * 0.1, 0, 0, R * 1.1);
  hull.addColorStop(0, '#F4F5F7');
  hull.addColorStop(0.6, '#C9CDD3');
  hull.addColorStop(1, '#868C96');
  ctx.strokeStyle = '#3B4250';
  ctx.lineWidth = R * 0.04;
  // The two prongs, ahead of the saucer, with the loading slot between them
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(R * 0.5, side * R * 0.12);
    ctx.lineTo(R * 1.5, side * R * 0.12);
    ctx.lineTo(R * 1.55, side * R * 0.28);
    ctx.lineTo(R * 1.45, side * R * 0.46);
    ctx.lineTo(R * 0.5, side * R * 0.6);
    ctx.closePath();
    ctx.fillStyle = hull;
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fillStyle = hull;
  ctx.fill();
  ctx.stroke();
  // Plating: an inner ring, spokes, a few dark hatches
  ctx.strokeStyle = 'rgba(59, 66, 80, .5)';
  ctx.lineWidth = R * 0.025;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.62, 0, TAU);
  for (let k = 0; k < 10; k++) {
    const a = (k * TAU) / 10 + 0.3;
    ctx.moveTo(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62);
    ctx.lineTo(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95);
  }
  ctx.stroke();
  ctx.fillStyle = '#5D6575';
  for (const [a, d, s] of [[2.2, 0.78, 0.14], [3.6, 0.8, 0.1], [4.3, 0.42, 0.12], [1.2, 0.4, 0.09], [5.4, 0.76, 0.12]]) {
    ctx.fillRect(Math.cos(a) * R * d - R * s / 2, Math.sin(a) * R * d - R * s / 2, R * s, R * s * 0.7);
  }
  // Radar dish, on the left
  ctx.beginPath();
  ctx.arc(R * 0.1, -R * 0.55, R * 0.13, 0, TAU);
  ctx.fillStyle = '#E4E7EC';
  ctx.fill();
  ctx.stroke();
  // Gun turret in the middle
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.2, 0, TAU);
  ctx.fillStyle = '#9AA1AD';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2B313C';
  ctx.fillRect(R * 0.05, -R * 0.06, R * 0.35, R * 0.04);
  ctx.fillRect(R * 0.05, R * 0.02, R * 0.35, R * 0.04);
  // Cockpit tube on the right side, its round canopy at the front
  ctx.strokeStyle = '#3B4250';
  ctx.lineWidth = R * 0.26;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(R * 0.15, R * 0.78);
  ctx.lineTo(R * 0.85, R * 0.98);
  ctx.stroke();
  ctx.strokeStyle = '#D5D9DF';
  ctx.lineWidth = R * 0.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(R * 0.92, R * 1.0, R * 0.15, 0, TAU);
  ctx.fillStyle = '#C9CDD3';
  ctx.fill();
  ctx.strokeStyle = '#3B4250';
  ctx.lineWidth = R * 0.03;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(R * 0.96, R * 1.0, R * 0.09, 0, TAU);
  ctx.fillStyle = '#1E2A40';
  ctx.fill();
  ctx.restore();
}

/** Explosion: a white flash, a fireball that swells and fades, sparks flying off. */
function explosion(ctx, b, now) {
  const t = (now - b.born) / 900;
  if (t < 0) return true; // not yet: staggered blasts
  if (t > 1) return false;
  const r = b.r * (0.4 + t * 1.6);
  const fire = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
  fire.addColorStop(0, `rgba(255, 255, 230, ${1 - t})`);
  fire.addColorStop(0.35, `rgba(255, 190, 80, ${0.9 * (1 - t)})`);
  fire.addColorStop(1, 'rgba(255, 80, 30, 0)');
  ctx.fillStyle = fire;
  ctx.beginPath();
  ctx.arc(b.x, b.y, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 220, 150, ${1 - t})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const a of b.sparks) {
    ctx.moveTo(b.x + Math.cos(a) * r * 0.8, b.y + Math.sin(a) * r * 0.8);
    ctx.lineTo(b.x + Math.cos(a) * r * 1.5, b.y + Math.sin(a) * r * 1.5);
  }
  ctx.stroke();
  return true;
}

/** Shooting star: a bright head and a fading tail. */
function meteor(ctx, m, now) {
  const t = (now - m.born) / 1100;
  if (t > 1) return false;
  const x = m.x + m.dx * t;
  const y = m.y + m.dy * t;
  const tail = ctx.createLinearGradient(x, y, x - m.dx * 0.25, y - m.dy * 0.25);
  tail.addColorStop(0, `rgba(255, 255, 255, ${1 - t})`);
  tail.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.strokeStyle = tail;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - m.dx * 0.25, y - m.dy * 0.25);
  ctx.stroke();
  return true;
}

/** Starfighter with wings in an X, seen from above, nose towards `dir` (1: right). */
function xFighter(ctx, x, y, s, dir, now) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * s, s);
  for (const side of [-1, 1]) {
    // Wing, laser cannon at its tip, red stripe
    ctx.beginPath();
    ctx.moveTo(-13, side * 2);
    ctx.lineTo(-3, side * 2);
    ctx.lineTo(-5, side * 17);
    ctx.lineTo(-12, side * 17);
    ctx.closePath();
    inked(ctx, '#D7DBE2', 0.8);
    ctx.fillStyle = '#C0392B';
    ctx.fillRect(-10, side > 0 ? 9 : -11, 4, 2);
    ctx.fillStyle = '#9AA1AD';
    ctx.fillRect(-13, side * 17 - 1, 25, 2);
    // Engines: four, two by wing pair
    glow(ctx, -15, side * 5, 1.6 + Math.sin(now / 60 + side) * 0.3, '#FFE2B8', 'rgba(255, 120, 60, .55)');
  }
  ctx.beginPath();
  ctx.moveTo(-16, -3);
  ctx.lineTo(8, -2.5);
  ctx.lineTo(22, 0);
  ctx.lineTo(8, 2.5);
  ctx.lineTo(-16, 3);
  ctx.closePath();
  inked(ctx, '#ECEEF1', 0.8);
  ctx.fillStyle = '#C0392B';
  ctx.fillRect(10, -1.2, 5, 2.4);
  ctx.beginPath();
  ctx.ellipse(1, 0, 4, 1.8, 0, 0, TAU);
  ctx.fillStyle = '#2B3A55';
  ctx.fill();
  ctx.restore();
}

/** Tall hexagonal wing panel, seen at an angle: frame and spokes. */
function hexPanel(ctx, cx, rx, ry) {
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 + Math.PI / 6;
    ctx[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rx, Math.sin(a) * ry);
  }
  ctx.closePath();
  ctx.fillStyle = '#2E333D';
  ctx.fill();
  ctx.strokeStyle = '#9AA1AD';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI) / 3 + Math.PI / 6;
    ctx.moveTo(cx + Math.cos(a) * rx, Math.sin(a) * ry);
    ctx.lineTo(cx - Math.cos(a) * rx, -Math.sin(a) * ry);
  }
  ctx.stroke();
}

/** Twin-panel fighter: round cockpit between two hexagonal wings. */
function hexFighter(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  hexPanel(ctx, -11, 5, 17);
  ctx.fillStyle = '#5D6575';
  ctx.fillRect(-10, -1.5, 20, 3);
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, TAU);
  inked(ctx, '#7B8494', 0.8);
  ctx.beginPath();
  ctx.arc(0, 0, 3.4, 0, TAU);
  ctx.fillStyle = '#111827';
  ctx.fill();
  ctx.strokeStyle = '#4B5563';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 4;
    ctx.moveTo(Math.cos(a) * 3.4, Math.sin(a) * 3.4);
    ctx.lineTo(-Math.cos(a) * 3.4, -Math.sin(a) * 3.4);
  }
  ctx.stroke();
  hexPanel(ctx, 11, 5, 17);
  ctx.restore();
}

/** Laser bolt: a short glowing line. */
function bolt(ctx, b) {
  ctx.save();
  ctx.strokeStyle = b.color;
  ctx.shadowColor = b.color;
  ctx.shadowBlur = 8;
  ctx.lineWidth = b.heavy ? 3.4 : 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - b.dx * 2.2, b.y - b.dy * 2.2);
  ctx.stroke();
  ctx.restore();
}

/**
 * A chase: the freighter or the X-wing fighter leads, two twin-panel fighters follow it and fire
 * green bolts that miss; the leader answers with red ones over its shoulder, and a hit
 * fighter blows up.
 */
function chase(ctx, s, now, w, h) {
  const c = s.chase;
  const scale = Math.min(1.5, h / 420);
  const run = (now - c.born) * c.speed;
  const lead = c.dir > 0 ? run - 120 : w + 120 - run;
  const at = (back, lift) => {
    const x = lead - c.dir * back * scale;
    return [x, c.y + Math.sin((x / w) * TAU * 1.3 + lift) * h * 0.06];
  };
  const hunters = c.hunters.map((k) => ({ k, pos: at(k.back, k.lift) }));
  const alive = hunters.filter((x) => !x.k.down);
  if (alive.length && Math.random() < 0.06) {
    const [x, y] = pick(alive).pos;
    s.bolts.push({ x: x + c.dir * 14, y: y + rand(-4, 4), dx: c.dir * 9, dy: rand(-0.6, 0.6), color: '#7CFF6B', life: 70 });
  }
  const [x0, y0] = at(0, 0);
  if (Math.random() < (c.lead === 'freighter' ? 0.035 : 0.015)) {
    const [tx, ty] = (pick(alive) || hunters[0]).pos;
    const d = Math.hypot(tx - x0, ty - y0) || 1;
    s.bolts.push({ x: x0, y: y0, dx: ((tx - x0) / d) * 8, dy: ((ty - y0) / d) * 8 + rand(-0.8, 0.8), color: '#FF5C5C', life: 45, red: true });
  }
  s.bolts = s.bolts.filter((b) => {
    b.x += b.dx;
    b.y += b.dy;
    bolt(ctx, b);
    // A red bolt that reaches a fighter destroys it
    const hit = b.red && alive.find((x) => Math.hypot(x.pos[0] - b.x, x.pos[1] - b.y) < 13 * scale);
    if (hit) {
      hit.k.down = true;
      s.booms.push({ x: hit.pos[0], y: hit.pos[1], r: 22 * scale, born: now, sparks: Array.from({ length: 9 }, () => rand(0, TAU)) });
      return false;
    }
    return --b.life > 0;
  });
  // The leader banks along its path: nose up when it climbs
  const tilt = Math.atan((y0 - at(4, 0)[1]) / 4);
  if (c.lead === 'freighter') {
    freighter(ctx, x0, y0, 30 * scale, c.dir > 0 ? tilt : Math.PI - tilt, now);
  } else {
    ctx.save();
    ctx.translate(x0, y0);
    ctx.rotate(c.dir * tilt * 0.5);
    xFighter(ctx, 0, 0, scale, c.dir, now);
    ctx.restore();
  }
  for (const x of alive) hexFighter(ctx, x.pos[0], x.pos[1], scale * 0.95);
  const last = hunters[hunters.length - 1].pos[0];
  if ((c.dir > 0 && last > w + 80) || (c.dir < 0 && last < -80)) {
    s.chase = null;
    s.bolts = [];
    s.nextChase = now + rand(6000, 10000);
  }
}

/**
 * Jump to hyperspace: the freighter heads for the centre, engines blazing, the stars stretch
 * into streaks, a white flash, then a new sky.
 */
function hyperspace(ctx, s, now, w, h) {
  const t = (now - s.jump.born) / 2600;
  const cx = w / 2;
  const cy = h * 0.45;
  const k = Math.min(1, t / 0.7) ** 3 * 6;
  ctx.lineCap = 'round';
  for (const st of s.stars) {
    const dx = st.x - cx;
    const dy = st.y - cy;
    ctx.globalAlpha = Math.min(1, 0.4 + st.z);
    ctx.strokeStyle = st.z > 0.7 ? '#FFFFFF' : '#BFE3FF';
    ctx.lineWidth = 0.6 + st.z * 1.4;
    ctx.beginPath();
    ctx.moveTo(cx + dx * (1 + k * 0.12), cy + dy * (1 + k * 0.12));
    ctx.lineTo(cx + dx * (1 + k * (0.12 + st.z * 0.5)), cy + dy * (1 + k * (0.12 + st.z * 0.5)));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (t < 0.74) {
    const p = t / 0.74;
    const size = Math.min(1.5, h / 420) * 46 * (1 - p * 0.9);
    freighter(ctx, cx, h * 0.95 - (h * 0.95 - cy) * p ** 1.5, size, -Math.PI / 2, now, p);
  }
  if (t > 0.66 && t < 0.92) {
    ctx.globalAlpha = Math.max(0, 1 - Math.abs(t - 0.76) / 0.16) * 0.85;
    ctx.fillStyle = '#E6F4FF';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
  // At the flash: a new sky, and a cruiser drops out of hyperspace
  if (t >= 0.76 && !s.jump.arrived) {
    s.jump.arrived = true;
    s.stars = s.stars.map(() => spaceStar(w, h));
    if (!s.cruiser) s.cruiser = { born: now, plates: hullPlates(), shots: [] };
  }
  if (t > 1) {
    s.jump = null;
    s.nextJump = now + rand(30000, 45000);
  }
}

/** The opening words, in blue, at the top of the canvas: they appear, stay, then fade. */
function intro(ctx, s, now, w, h) {
  const age = (now - s.born) / 1000;
  if (age > 7) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, age / 1.2, (7 - age) / 1.5);
  ctx.fillStyle = '#4BD5EE';
  ctx.textAlign = 'center';
  ctx.font = `500 ${Math.round(Math.min(22, w / 32))}px "Atkinson Hyperlegible", sans-serif`;
  t('galaxy.intro').split('\n').forEach((line, i) => ctx.fillText(line, w / 2, h * 0.09 + i * 28));
  ctx.restore();
}

/* ---------- Faraway galaxy: the ice plain, the walker and the snowspeeders ---------- */

/** Ice plain along the bottom: a far ridge, then the snow, lit blue. */
function icePlain(ctx, ground, w, h) {
  ctx.beginPath();
  ctx.moveTo(0, ground);
  for (let x = 0; x <= w; x += 20) ctx.lineTo(x, ground - 14 - Math.sin(x / 90) * 8 - Math.sin(x / 37 + 1) * 4);
  ctx.lineTo(w, ground);
  ctx.closePath();
  ctx.fillStyle = '#7F93B3';
  ctx.fill();
  const snow = ctx.createLinearGradient(0, ground, 0, h);
  snow.addColorStop(0, '#E4EEF8');
  snow.addColorStop(1, '#9FB3CC');
  ctx.fillStyle = snow;
  ctx.fillRect(0, ground, w, h - ground);
  ctx.fillStyle = 'rgba(255, 255, 255, .55)';
  ctx.fillRect(0, ground, w, 1.5);
}

/** Knee of a leg from hip to foot, with two segments of length `len`, bent forward. */
function knee(hx, hy, fx, fy, len) {
  const d = Math.min(Math.hypot(fx - hx, fy - hy), len * 2 - 0.01);
  const mx = (hx + fx) / 2;
  const my = (hy + fy) / 2;
  const up = Math.sqrt(len * len - (d / 2) ** 2);
  const ux = (fy - hy) / d; // perpendicular to hip→foot, towards the front
  const uy = -(fx - hx) / d;
  return [mx + ux * up, my + uy * up];
}

/** Where a foot is: planted (it slides back as the body moves on), or lifted and swung forward. */
function footAt(u, hipX, stride, ground, s) {
  if (u < 0.75) return [hipX + stride * (0.5 - u / 0.75), ground];
  const v = (u - 0.75) / 0.25;
  return [hipX + stride * (-0.5 + v), ground - Math.sin(v * Math.PI) * 16 * s];
}

/** One leg: armoured hip plate, thigh and shin with a hydraulic ram, knee joint, clawed foot pad. */
function walkerLeg(ctx, hip, foot, len, s, far) {
  const [kx, ky] = knee(hip[0], hip[1], foot[0], foot[1], len);
  const dark = far ? '#4E5666' : '#2F3540';
  const light = far ? '#7A8394' : '#A7B0BE';
  ctx.lineCap = 'round';
  for (const [from, to, width] of [[hip, [kx, ky], 10], [[kx, ky], foot, 8]]) {
    ctx.strokeStyle = dark;
    ctx.lineWidth = (width + 2) * s;
    ctx.beginPath();
    ctx.moveTo(...from);
    ctx.lineTo(...to);
    ctx.stroke();
    ctx.strokeStyle = light;
    ctx.lineWidth = width * s;
    ctx.stroke();
    // Armour bands across the segment
    ctx.strokeStyle = dark;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (const k of [0.3, 0.6]) {
      const mx = from[0] + (to[0] - from[0]) * k;
      const my = from[1] + (to[1] - from[1]) * k;
      ctx.moveTo(mx - width * 0.45 * s, my);
      ctx.lineTo(mx + width * 0.45 * s, my);
    }
    ctx.stroke();
  }
  // Hydraulic ram along the shin, behind it
  ctx.strokeStyle = far ? '#9AA1AD' : '#D5DBE3';
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath();
  ctx.moveTo(kx - 6 * s, ky + 4 * s);
  ctx.lineTo(foot[0] - 5 * s, foot[1] - 12 * s);
  ctx.stroke();
  // Hip plate and knee joint
  ctx.fillStyle = far ? '#6A7383' : '#8E97A6';
  ctx.beginPath();
  ctx.arc(hip[0], hip[1], 8 * s, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(kx, ky, 6 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(kx, ky, 2.2 * s, 0, TAU);
  ctx.fill();
  // Foot: a round pad and its claws
  ctx.beginPath();
  ctx.ellipse(foot[0], foot[1] - 3 * s, 12 * s, 5 * s, 0, 0, TAU);
  ctx.fillStyle = far ? '#5D6575' : '#7C8595';
  ctx.fill();
  ctx.fillStyle = dark;
  for (const dx of [-10, -3, 4, 11]) ctx.fillRect(foot[0] + (dx - 1.5) * s, foot[1] - 1.5 * s, 3 * s, 1.5 * s);
}

/**
 * Four-legged armoured walker, walking to the right on the ice: plated body with rivets, hatches
 * and vents, swaying with each step; ringed neck; head with cheek plates, lit viewport, chin guns and
 * side guns; far legs in the shade; snow kicked up by the feet. `flash` lights the guns as they fire.
 */
function walker(ctx, x, ground, s, now, flash = 0) {
  const cycle = (now % 2600) / 2600;
  const len = 52 * s;
  const stride = 34 * s;
  const sway = Math.sin(cycle * TAU * 2) * 1.6 * s;
  const bodyY = ground - 96 * s + sway; // bottom of the body
  const legs = [[-38, 0, true], [24, 0.5, true], [-24, 0.25, false], [38, 0.75, false]];
  const placed = legs.map(([dx, off, far]) => {
    const u = (cycle + off) % 1;
    return { far, u, hip: [x + dx * s, bodyY - 4 * s], foot: footAt(u, x + dx * s, stride, ground, s) };
  });
  for (const l of placed) if (l.far) walkerLeg(ctx, l.hip, l.foot, len, s, true);
  // Body: an armoured box, lighter on top
  const top = bodyY - 40 * s;
  const body = ctx.createLinearGradient(0, top, 0, bodyY);
  body.addColorStop(0, '#D3D9E2');
  body.addColorStop(0.45, '#A3ACBA');
  body.addColorStop(1, '#5D6575');
  ctx.beginPath();
  ctx.moveTo(x - 58 * s, bodyY - 8 * s);
  ctx.lineTo(x - 50 * s, top);
  ctx.lineTo(x + 46 * s, top);
  ctx.lineTo(x + 56 * s, bodyY - 10 * s);
  ctx.lineTo(x + 48 * s, bodyY);
  ctx.lineTo(x - 50 * s, bodyY);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = '#2F3540';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Light on the back
  ctx.fillStyle = 'rgba(255, 255, 255, .35)';
  ctx.fillRect(x - 48 * s, top + 1, 92 * s, 2 * s);
  // Plates, each with its rivets
  ctx.strokeStyle = 'rgba(47, 53, 64, .6)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (const k of [-30, -8, 14, 34]) {
    ctx.moveTo(x + k * s, top + 2 * s);
    ctx.lineTo(x + k * s, bodyY - 2 * s);
  }
  ctx.moveTo(x - 52 * s, top + 14 * s);
  ctx.lineTo(x + 50 * s, top + 14 * s);
  ctx.moveTo(x - 54 * s, bodyY - 9 * s);
  ctx.lineTo(x + 52 * s, bodyY - 9 * s);
  ctx.stroke();
  ctx.fillStyle = '#4E5666';
  for (const k of [-30, -8, 14, 34]) for (const v of [5, 18, 27]) ctx.fillRect(x + (k + 2) * s, top + v * s, 1.2 * s, 1.2 * s);
  // Side hatch, vents and a warning light
  ctx.fillStyle = '#6E7787';
  ctx.fillRect(x - 4 * s, top + 17 * s, 14 * s, 12 * s);
  ctx.strokeStyle = '#2F3540';
  ctx.strokeRect(x - 4 * s, top + 17 * s, 14 * s, 12 * s);
  ctx.fillStyle = '#4E5666';
  for (let k = 0; k < 5; k++) ctx.fillRect(x + (-42 + k * 6) * s, top + 18 * s, 3 * s, 10 * s);
  for (let k = 0; k < 3; k++) ctx.fillRect(x + (20 + k * 6) * s, top + 20 * s, 3 * s, 7 * s);
  ctx.fillStyle = Math.sin(now / 350) > 0 ? '#FF5C5C' : 'rgba(255, 92, 92, .3)';
  ctx.fillRect(x - 46 * s, top + 4 * s, 2 * s, 2 * s);
  // Ringed neck, then the head, nodding a little
  const nod = Math.sin(cycle * TAU * 2 + 1) * 1.2 * s;
  const hx = x + 70 * s;
  const hy = top + 12 * s + nod;
  ctx.fillStyle = '#7C8595';
  ctx.fillRect(x + 50 * s, top + 10 * s, 14 * s, 12 * s);
  ctx.strokeStyle = '#4E5666';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const k of [53, 57, 61]) {
    ctx.moveTo(x + k * s, top + 10 * s);
    ctx.lineTo(x + k * s, top + 22 * s);
  }
  ctx.stroke();
  const head = ctx.createLinearGradient(0, hy - 12 * s, 0, hy + 14 * s);
  head.addColorStop(0, '#D3D9E2');
  head.addColorStop(1, '#6E7787');
  ctx.beginPath();
  ctx.moveTo(hx - 8 * s, hy - 12 * s);
  ctx.lineTo(hx + 18 * s, hy - 10 * s);
  ctx.lineTo(hx + 26 * s, hy + 2 * s);
  ctx.lineTo(hx + 20 * s, hy + 14 * s);
  ctx.lineTo(hx - 8 * s, hy + 14 * s);
  ctx.closePath();
  ctx.fillStyle = head;
  ctx.fill();
  ctx.strokeStyle = '#2F3540';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Cheek plate, seams and rivets
  ctx.beginPath();
  ctx.moveTo(hx - 4 * s, hy + 1 * s);
  ctx.lineTo(hx + 8 * s, hy + 3 * s);
  ctx.lineTo(hx + 6 * s, hy + 12 * s);
  ctx.lineTo(hx - 4 * s, hy + 12 * s);
  ctx.closePath();
  ctx.fillStyle = '#8E97A6';
  ctx.fill();
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.fillStyle = '#4E5666';
  for (const [rx, ry] of [[-6, -9], [4, -9], [14, -8], [-6, 10], [16, 10]]) ctx.fillRect(hx + rx * s, hy + ry * s, 1.2 * s, 1.2 * s);
  ctx.fillStyle = '#FFB547'; // lit viewport
  ctx.fillRect(hx + 10 * s, hy - 4 * s, 12 * s, 2.2 * s);
  // Guns: two under the chin, one on the side of the head
  ctx.strokeStyle = '#2F3540';
  ctx.lineWidth = 2.4 * s;
  ctx.beginPath();
  ctx.moveTo(hx + 16 * s, hy + 10 * s);
  ctx.lineTo(hx + 32 * s, hy + 10 * s);
  ctx.moveTo(hx + 14 * s, hy + 13 * s);
  ctx.lineTo(hx + 28 * s, hy + 13 * s);
  ctx.stroke();
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath();
  ctx.moveTo(hx + 2 * s, hy - 6 * s);
  ctx.lineTo(hx + 22 * s, hy - 7 * s);
  ctx.stroke();
  ctx.fillStyle = '#5D6575';
  ctx.fillRect(hx, hy - 9 * s, 6 * s, 5 * s);
  const guns = [[hx + 32 * s, hy + 10 * s], [hx + 28 * s, hy + 13 * s], [hx + 22 * s, hy - 7 * s]];
  if (flash > 0) for (const [gx, gy] of guns) glow(ctx, gx + 2 * s, gy, 2.5 * s * flash, '#EFFFE8', `rgba(124, 255, 107, ${0.7 * flash})`);
  for (const l of placed) if (!l.far) walkerLeg(ctx, l.hip, l.foot, len, s, false);
  // Snow kicked up when a foot comes down
  for (const l of placed) {
    if (l.u > 0.12) continue;
    ctx.globalAlpha = (1 - l.u / 0.12) * 0.7;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(l.foot[0], ground - 2 * s, (10 + l.u * 120) * s, (3 + l.u * 30) * s, 0, Math.PI, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return { guns, legs: placed.map((l) => knee(l.hip[0], l.hip[1], l.foot[0], l.foot[1], len)) };
}

/** Small two-seat airspeeder seen from the side, nose towards `dir`: wedge hull, canopy, orange stripes, split flaps. */
function snowspeeder(ctx, x, y, s, dir, now) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * s, s);
  glow(ctx, -15, 0, 1.8 + Math.sin(now / 50) * 0.3, '#FFE2B8', 'rgba(255, 140, 60, .5)');
  ctx.beginPath();
  ctx.moveTo(16, 1);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-15, -4);
  ctx.lineTo(-15, 4);
  ctx.lineTo(10, 4);
  ctx.closePath();
  const hull = ctx.createLinearGradient(0, -5, 0, 4);
  hull.addColorStop(0, '#F2F4F7');
  hull.addColorStop(1, '#9AA1AD');
  ctx.fillStyle = hull;
  ctx.fill();
  ctx.strokeStyle = '#3B4250';
  ctx.lineWidth = 0.7;
  ctx.stroke();
  ctx.fillStyle = '#E06A2C';
  ctx.fillRect(-12, -1, 18, 1.4);
  ctx.fillRect(4, 2, 6, 1.2);
  ctx.beginPath(); // canopy
  ctx.moveTo(4, -2.6);
  ctx.lineTo(-4, -5.6);
  ctx.lineTo(-8, -5);
  ctx.lineTo(-6, -2.4);
  ctx.closePath();
  ctx.fillStyle = '#2B3A55';
  ctx.fill();
  ctx.strokeStyle = '#3B4250'; // split rear flaps
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-15, -4);
  ctx.lineTo(-19, -6 - Math.sin(now / 300) * 1.5);
  ctx.moveTo(-15, 4);
  ctx.lineTo(-19, 6 + Math.sin(now / 300) * 1.5);
  ctx.stroke();
  ctx.restore();
}

/**
 * The battle on the ice: the walker crosses the bottom of the canvas; snowspeeders circle it,
 * passing behind then in front, fire red bolts, and one now and then trails a tow cable that wraps
 * around its legs; the walker answers with green bolts from its head.
 */
function iceBattle(ctx, s, now, w, h) {
  const ground = h * 0.92;
  const scale = Math.min(1.25, h / 450);
  const speed = (34 * scale) / (2600 * 0.75); // as fast as its planted feet slide back: they don't skid
  icePlain(ctx, ground, w, h);
  // The walker: walking, tripping over the cable, or gone (wreck burning) until the next one comes
  const fall = s.fall && (now - s.fall.born) / 1000;
  if (fall > 7) {
    s.fall = null;
    s.walkStart = now;
    s.cableBorn = now + rand(14000, 22000);
  }
  let x = s.fall ? s.fall.x : (now - s.walkStart) * speed - 160 * scale;
  if (x > w + 160 * scale) {
    s.walkStart = now;
    x = -160 * scale;
  }
  const orbit = (p) => {
    const a = p.a + now * p.speed;
    const depth = Math.sin(a); // < 0: behind the walker
    return {
      x: x + Math.cos(a) * p.rx * scale, y: ground - 70 * scale + Math.sin(a * 2) * 18 * scale - depth * 16 * scale,
      depth, dir: -Math.sin(a) > 0 ? 1 : -1, size: scale * (0.95 + depth * 0.25),
    };
  };
  for (const p of s.speeders) if (p.down && now - p.down > 9000) p.down = 0; // a new speeder joins
  const ships = s.speeders.filter((p) => !p.down).map((p) => ({ p, o: orbit(p) }));
  for (const { o } of ships) if (o.depth < 0) snowspeeder(ctx, o.x, o.y, o.size, o.dir, now);
  let parts = null;
  // It tips forward over its front feet: `tipped` places a point of the walker as it falls
  const pivot = x + 40 * scale;
  const tilt = s.fall ? Math.min(1, fall / 1.6) ** 2 * 1.25 : 0;
  const tipped = ([px, py]) => [
    pivot + (px - pivot) * Math.cos(tilt) - (py - ground) * Math.sin(tilt),
    ground + (px - pivot) * Math.sin(tilt) + (py - ground) * Math.cos(tilt),
  ];
  if (!s.fall || fall < 1.6) {
    ctx.save();
    if (s.fall) {
      ctx.translate(pivot, ground);
      ctx.rotate(tilt);
      ctx.translate(-pivot, -ground);
    }
    const flash = s.fall ? 0 : Math.max(0, 1 - (now - s.gunFired) / 160);
    parts = walker(ctx, x, ground, scale, s.fall ? s.fall.born : now, flash);
    ctx.restore();
  }
  if (s.fall && fall >= 1.6 && !s.fall.boom) {
    s.fall.boom = true;
    for (let k = 0; k < 5; k++) {
      s.booms.push({ x: x + rand(-50, 70) * scale, y: ground - rand(5, 45) * scale, r: rand(30, 55) * scale, born: now + k * 140, sparks: Array.from({ length: 12 }, () => rand(0, TAU)) });
    }
  }
  if (s.fall && fall >= 1.6) {
    // The wreck smokes on the snow
    ctx.fillStyle = '#3B4250';
    ctx.beginPath();
    ctx.ellipse(x + 50 * scale, ground - 4 * scale, 70 * scale, 12 * scale, 0.05, Math.PI, TAU);
    ctx.fill();
    for (let k = 0; k < 6; k++) {
      const age = ((now / 1000 + k * 0.4) % 2.4) / 2.4;
      ctx.globalAlpha = (1 - age) * 0.35 * Math.min(1, (7 - fall) / 2);
      ctx.fillStyle = '#5D6575';
      ctx.beginPath();
      ctx.arc(x + (30 + k * 8) * scale + age * 20 * scale, ground - 10 * scale - age * 90 * scale, (8 + age * 22) * scale, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // Tow cable: a few loops across the legs at knee height, then a line to the speeder; four loops and
  // it trips. The cable stays wound round the legs, and held by the speeder, until the walker hits the snow.
  const towing = ships[0];
  if (parts && (s.fall || (towing && now > s.cableBorn))) {
    const loops = s.fall ? 4 : Math.min(4, Math.floor((now - s.cableBorn) / 1500));
    if (!s.fall && now - s.cableBorn > 7000) s.fall = { born: now, x };
    ctx.strokeStyle = 'rgba(225, 230, 238, .9)'; // pale: it shows against the snow and the night
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const ks = parts.legs;
    for (let k = 0; k < loops; k++) {
      ctx.moveTo(...tipped([ks[0][0], ks[0][1] + k * 4 * scale]));
      ctx.lineTo(...tipped([ks[3][0], ks[3][1] + k * 4 * scale + 3]));
    }
    if (towing) {
      ctx.moveTo(...tipped(ks[3]));
      ctx.lineTo(towing.o.x, towing.o.y);
    }
    ctx.stroke();
  }
  for (const { o } of ships) if (o.depth >= 0) snowspeeder(ctx, o.x, o.y, o.size, o.dir, now);
  // Bolts: red from the speeders towards the walker's body, green from its head guns
  if (ships.length && parts && Math.random() < 0.03) {
    const { o } = pick(ships);
    const d = Math.hypot(x - o.x, ground - 110 * scale - o.y) || 1;
    s.iceBolts.push({ x: o.x, y: o.y, dx: ((x - o.x) / d) * 8, dy: ((ground - 110 * scale - o.y) / d) * 8, color: '#FF5C5C', life: Math.min(40, d / 8) });
  }
  // The walker fires bursts of three at a speeder, aiming where it is going
  if (ships.length && parts && !s.fall) {
    if (!s.burst && now > s.nextBurst) s.burst = { target: pick(ships).p, left: 3, next: now };
    if (s.burst && now >= s.burst.next) {
      const ship = ships.find((x) => x.p === s.burst.target);
      if (ship) {
        const [gx, gy] = parts.guns[s.burst.left % parts.guns.length];
        const ahead = orbit({ ...ship.p, a: ship.p.a + 120 * ship.p.speed }); // where it will be soon
        const d = Math.hypot(ahead.x - gx, ahead.y - gy) || 1;
        const v = 11;
        s.iceBolts.push({ x: gx, y: gy, dx: ((ahead.x - gx) / d) * v, dy: ((ahead.y - gy) / d) * v, color: '#7CFF6B', life: Math.min(45, d / v + 8), heavy: true });
        s.gunFired = now;
      }
      s.burst.left--;
      s.burst.next = now + 140;
      if (s.burst.left <= 0 || !ship) {
        s.burst = null;
        s.nextBurst = now + rand(1500, 3200);
      }
    }
  }
  s.iceBolts = s.iceBolts.filter((b) => {
    b.x += b.dx;
    b.y += b.dy;
    bolt(ctx, b);
    // A green bolt that reaches a speeder brings it down
    const hit = b.color === '#7CFF6B' && ships.find(({ p, o }) => !p.down && Math.hypot(o.x - b.x, o.y - b.y) < 12 * scale);
    if (hit) {
      hit.p.down = now;
      s.booms.push({ x: hit.o.x, y: hit.o.y, r: 20 * scale, born: now, sparks: Array.from({ length: 9 }, () => rand(0, TAU)) });
      return false;
    }
    return --b.life > 0;
  });
}

function galaxy(ctx, s, now, w, h) {
  deepSpace(ctx, now, w, h);
  // Twin suns, low on the right
  glow(ctx, w * 0.93, h * 0.62, 9, '#FFF4D6', 'rgba(255, 170, 80, .35)');
  glow(ctx, w * 0.965, h * 0.67, 6, '#FFE9B8', 'rgba(255, 120, 60, .3)');
  if (s.jump) hyperspace(ctx, s, now, w, h);
  else starDrift(ctx, s, now, w, h);
  // Shooting stars, now and then
  if (!s.jump && Math.random() < 0.004) s.meteors.push({ x: rand(0.1, 0.9) * w, y: rand(0, 0.4) * h, dx: rand(-1, 1) * w * 0.3, dy: h * rand(0.15, 0.3), born: now });
  s.meteors = s.meteors.filter((m) => meteor(ctx, m, now));
  // The ringed planet rises over the ice horizon
  ringedPlanet(ctx, w * 0.08, h * 0.86, Math.min(w, h) * 0.3, now);
  if (s.cruiser) {
    // It comes out of hyperspace fast, brakes, then drifts slowly across the top and leaves
    const L = Math.min(w * 0.55, 560);
    const age = now - s.cruiser.born;
    const braking = Math.min(1, age / 2500);
    const x = w * 0.6 + (1 - braking) ** 3 * w * 0.9 - Math.max(0, age - 2500) * 0.012;
    cruiser(ctx, s.cruiser, x, h * 0.17, L, now);
    if (x + L < -20) s.cruiser = null;
  }
  iceBattle(ctx, s, now, w, h);
  s.booms = s.booms.filter((b) => explosion(ctx, b, now));
  if (s.jump) return; // in hyperspace, no chase in the sky
  if (!s.chase && now > s.nextChase) {
    s.chase = {
      dir: pick([-1, 1]), y: rand(0.22, 0.5) * h, born: now, speed: rand(0.16, 0.22), lead: s.chases++ % 2 ? 'xwing' : 'freighter',
      hunters: [{ back: 130, lift: 0.5 }, { back: 200, lift: 1 }],
    };
  }
  if (s.chase) chase(ctx, s, now, w, h);
  if (!s.chase && now > s.nextJump) s.jump = { born: now };
  intro(ctx, s, now, w, h);
}

/* ---------- Summer: the beach ---------- */

/** Gull: two wings like a circumflex accent, flapping. */
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

/** Small shark: a fin cutting through the water, its wake of foam, its shape glimpsed beneath. */
function shark(ctx, k, now, horizon, shore) {
  const y = horizon + (shore - horizon) * k.depth + Math.sin(now / 700 + k.phase) * 1.5;
  const x = k.x;
  const z = 0.8 + k.depth * 0.6; // closer, larger
  ctx.save();
  // Shape under the water
  ctx.fillStyle = 'rgba(30, 60, 80, .18)';
  ctx.beginPath();
  ctx.ellipse(x - k.dir * 6 * z, y + 5 * z, 26 * z, 5 * z, 0, 0, TAU);
  ctx.fill();
  // Wake: two trails of foam in a V behind the fin
  ctx.strokeStyle = 'rgba(255, 255, 255, .75)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const side of [-1, 1]) {
    ctx.moveTo(x - k.dir * 4 * z, y);
    ctx.quadraticCurveTo(x - k.dir * 20 * z, y + side * 3 * z, x - k.dir * 38 * z, y + side * 6 * z);
  }
  ctx.stroke();
  // Fin: rounded leading edge, hollow trailing edge
  ctx.fillStyle = '#5F6E7A';
  ctx.beginPath();
  ctx.moveTo(x + k.dir * 7 * z, y);
  ctx.quadraticCurveTo(x + k.dir * 3 * z, y - 10 * z, x - k.dir * 4 * z, y - 15 * z);
  ctx.quadraticCurveTo(x - k.dir * 4 * z, y - 6 * z, x - k.dir * 9 * z, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, .8)'; // foam at the foot of the fin
  ctx.beginPath();
  ctx.ellipse(x, y + 0.5, 9 * z, 1.6 * z, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Blurred swimmer: head and cap above the water, rocked by the waves. */
function swimmer(ctx, p, now, horizon, shore) {
  const k = 0.9 + p.depth * 1.1;
  const x = p.x + Math.sin(now / 5000 + p.phase) * 12;
  const y = horizon + (shore - horizon) * (0.15 + p.depth * 0.6) + Math.sin(now / 900 + p.phase) * 2.2 * k;
  ctx.save();
  ctx.filter = `blur(${(1.8 - p.depth).toFixed(1)}px)`;
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = '#B07A5A';
  ctx.beginPath();
  ctx.ellipse(x, y + 4 * k, 7 * k, 3.5 * k, 0, 0, TAU); // shoulders, at the surface
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y - 2 * k, 4.2 * k, 0, TAU);
  ctx.fill();
  ctx.fillStyle = p.cap;
  ctx.beginPath();
  ctx.arc(x, y - 3 * k, 4.4 * k, Math.PI, 0);
  ctx.fill();
  if (p.wave && Math.sin(now / 700 + p.phase) > 0.4) { // a waving arm
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
  ctx.ellipse(x, y + 4.5 * k, 9 * k, 2 * k, 0, 0, TAU); // ripples around the swimmer
  ctx.stroke();
  ctx.restore();
}

/** The beach: sun, sea and waves to the horizon, foam coming and going on the sand. */
function beach(ctx, s, now, w, h) {
  const horizon = h * 0.62;
  const shore = h * 0.9;
  const wash = Math.sin(now / 2600); // the wave rises and falls back on the sand
  const shoreY = (x) => shore + Math.sin(x / 70 + now / 1400) * 3 + wash * 9;
  // Sun veiled in light
  const sun = ctx.createRadialGradient(w * 0.82, horizon - h * 0.28, 0, w * 0.82, horizon - h * 0.28, 90);
  sun.addColorStop(0, 'rgba(255, 214, 120, .9)');
  sun.addColorStop(0.3, 'rgba(255, 200, 90, .45)');
  sun.addColorStop(1, 'rgba(255, 200, 90, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(w * 0.82 - 90, horizon - h * 0.28 - 90, 180, 180);
  // Sea: from the turquoise of the horizon to the blue of the shore
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
  // Waves: undulating lines of foam, larger near the shore
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
  // Swimmers in the distance, blurred
  for (const p of s.swimmers) swimmer(ctx, p, now, horizon, shore);
  // Now and then, a small shark crosses the sea
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
  // Wet sand and foam on the shore
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
  // Sun reflections on the water, gulls
  release(s.glints, 5, 0.05, () => ({ x: rand(0, w), y: rand(horizon + 4, shore - 10), r: rand(4, 8), born: now }));
  s.glints = s.glints.filter((g) => glint(ctx, g, now));
  release(s.gulls, 3, 0.006, () => ({ ...flyer(w, h, [0.8, 1.6], [7, 11]), y: rand(0.08, 0.45) * h }));
  s.gulls = s.gulls.filter((b) => {
    const at = fly(b, now, w);
    if (at) gull(ctx, ...at, b, now);
    return !!at;
  });
}

/* ---------- Autumn: the trees ---------- */

const AUTUMN = ['#C8642A', '#D9A13B', '#9C4A2A', '#B5651D', '#A83F1E', '#E3B23C', '#7A8A2E'];

/**
 * A tree planted at (x, ground): trunk and branches that branch out at random (lines), and a
 * crown of leaves at the tips of the twigs, each with its own colour.
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

/** Draws a tree: brown branches, then the leaves still attached (they quiver in the wind). */
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

/* ---------- The scenes ---------- */

const WINGS = ['#F06AA0', '#4FA3E8', '#F2B91B', '#9B6BE0', '#FF8A3D', '#3FBF7F'];

/** Releases a flying object into the list now and then, up to `max`. */
function release(list, max, chance, make) {
  if (list.length < max && Math.random() < chance) list.push(make());
}

export const SCENES = {
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
      // Bats pass; now and then, a swarm bursts from one side
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
      // Petals: they fly off the branches and fall spinning
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
      // Mostly on the sides, where the tree cards hide them less
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
  galaxie: {
    make: (w, h) => ({
      born: Date.now(), stars: Array.from({ length: Math.round((w * h) / 2600) }, () => spaceStar(w, h)),
      chase: null, chases: 0, nextChase: Date.now() + 3000, bolts: [], jump: null, nextJump: Date.now() + 14000,
      cruiser: { born: Date.now() - 2500, plates: hullPlates(), shots: [] }, meteors: [], booms: [],
      speeders: [{ a: 0, speed: 0.0011, rx: 150 }, { a: 2.4, speed: 0.0008, rx: 190 }, { a: 4.2, speed: 0.00095, rx: 120 }],
      iceBolts: [], cableBorn: Date.now() + 8000, walkStart: Date.now() - 4000, fall: null,
      burst: null, nextBurst: Date.now() + 1500, gunFired: 0,
    }),
    draw: (ctx, s, now, w, h) => galaxy(ctx, s, now, w, h),
  },
  automne: {
    make: (w, h) => ({
      trees: [tree(w * 0.045, h + 4, h * 0.62), tree(w * 0.955, h + 4, h * 0.55)],
      falling: [], ground: [],
      drift: Array.from({ length: Math.round((w * h) / 70000) }, () => faller(w, h, false, [4, 7], AUTUMN)),
    }),
    draw(ctx, s, now, w, h) {
      // Gusts of wind: the breeze strengthens then dies down
      const wind = Math.max(0, Math.sin(now / 4000)) ** 3 * 2.2;
      for (const t of s.trees) {
        drawTree(ctx, t, now, wind);
        for (const l of t.leaves) {
          // A leaf grows back little by little; another comes off, more often when it's windy
          if (l.on && l.back < 1) l.back += 0.01;
          if (!l.on && now > l.regrow) Object.assign(l, { on: true, back: 0, color: pick(AUTUMN) });
          if (l.on && l.back >= 1 && Math.random() < 0.0009 + wind * 0.002) {
            l.on = false;
            l.regrow = now + rand(15000, 40000);
            s.falling.push({ ...faller(w, h, false, [l.r, l.r], [l.color]), x: l.x, y: l.y, speed: rand(0.6, 1.2) });
          }
        }
      }
      // Fallen leaves drop then settle on the ground, where they fade little by little
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
