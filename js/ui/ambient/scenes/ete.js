/**
 * Summer: the beach, with waves, foam, blurred swimmers, a small shark and gulls.
 */

import { TAU, rand, pick, flyer, fly, gull, release } from './shared.js';

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

export const ete = {
  make: (w) => ({
    // Mostly on the sides, where the tree cards hide them less
    swimmers: [0.05, 0.13, 0.22, 0.5, 0.79, 0.88, 0.95].map((at, i) => ({
      x: (at + rand(-0.02, 0.02)) * w, depth: rand(0, 1), phase: rand(0, TAU),
      cap: pick(['#E0483E', '#F2C94C', '#3A7BD5', '#FFFFFF', '#E58CB0']), wave: i === 1 || i === 5,
    })),
    glints: [], gulls: [], shark: null, nextShark: Date.now() + 1500,
  }),
  draw: (ctx, s, now, w, h) => beach(ctx, s, now, w, h),
};
