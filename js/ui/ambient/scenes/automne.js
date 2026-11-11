/**
 * Autumn: trees losing their coloured leaves in gusts of wind; the leaves settle then fade.
 */

import { TAU, rand, pick, faller, fall } from './shared.js';

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

export const automne = {
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
};
