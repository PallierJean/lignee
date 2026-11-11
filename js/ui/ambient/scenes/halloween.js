/**
 * Halloween: moon and clouds, flickering pumpkins, mist, a spider, bats in swarms and ghosts.
 */

import { TAU, rand, flyer, fly, release } from './shared.js';

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

export const halloween = {
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
};
