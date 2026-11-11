/**
 * Spring: flowering cherry branches, a flowery meadow, petals, butterflies and swallows.
 */

import { TAU, rand, pick, faller, fall, flyer, fly, release } from './shared.js';

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

const WINGS = ['#F06AA0', '#4FA3E8', '#F2B91B', '#9B6BE0', '#FF8A3D', '#3FBF7F'];

export const printemps = {
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
};
