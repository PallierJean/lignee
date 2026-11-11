/**
 * Christmas: snowflakes and crystals, and a garland all around the canvas.
 */

import { TAU, faller, fall } from './shared.js';

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

export const noel = {
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
};
