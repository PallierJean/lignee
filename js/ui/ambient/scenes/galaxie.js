/**
 * Faraway galaxy: drifting stars and nebulae, a ringed planet and twin suns, starfighter and
 * freighter chases with laser bolts and explosions, jumps to hyperspace, a dagger-shaped cruiser,
 * and on the ice a walker brought down by the tow cables of airspeeders.
 */

import { t } from '../../../i18n.js';
import { TAU, rand, pick, inked } from './shared.js';

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

/** Snow thrown up by a blast: a flash, then a plume of snow falling back, and smoke. */
function snowBlast(ctx, b, now, scale) {
  const t = (now - b.born) / 1600;
  if (t > 1) return false;
  if (t < 0.15) glow(ctx, b.x, b.y, (4 + t * 40) * scale, '#FFF6D8', `rgba(255, 170, 70, ${0.8 - t * 4})`);
  for (const p of b.bits) {
    const age = t * 1.6;
    const x = b.x + p.dx * age * 40 * scale;
    const y = b.y - (p.up * age - age * age * 0.9) * 60 * scale;
    if (y > b.y + 2) continue;
    ctx.globalAlpha = Math.max(0, 1 - t) * 0.9;
    ctx.fillStyle = '#F4F8FC';
    ctx.beginPath();
    ctx.arc(x, y, p.r * scale, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = Math.max(0, 0.4 - t * 0.4);
  ctx.fillStyle = '#4A5160';
  ctx.beginPath();
  ctx.arc(b.x + t * 10 * scale, b.y - t * 70 * scale, (6 + t * 22) * scale, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  return true;
}

/** Defence turret on its base: the barrel turns towards `aim` (an angle); `flash` when it fires. */
function turret(ctx, x, y, s, aim, flash) {
  ctx.fillStyle = '#6E7787';
  ctx.beginPath();
  ctx.moveTo(x - 9 * s, y);
  ctx.lineTo(x - 6 * s, y - 7 * s);
  ctx.lineTo(x + 6 * s, y - 7 * s);
  ctx.lineTo(x + 9 * s, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2F3540';
  ctx.lineWidth = 1;
  ctx.stroke();
  const mx = x + Math.cos(aim) * 16 * s;
  const my = y - 9 * s + Math.sin(aim) * 16 * s;
  ctx.strokeStyle = '#3B4250';
  ctx.lineWidth = 3 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - 9 * s);
  ctx.lineTo(mx, my);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y - 9 * s, 4.5 * s, 0, TAU);
  ctx.fillStyle = '#9AA1AD';
  ctx.fill();
  ctx.stroke();
  if (flash > 0) glow(ctx, mx, my, 3 * s * flash, '#FFF1D6', `rgba(255, 150, 60, ${0.8 * flash})`);
  return [mx, my];
}

/**
 * A soldier in the trench: helmet, pale coat, rifle held at the shoulder and pointed along `aim`
 * (an angle: towards the walkers); `run` (-1, 0, 1) makes it run along the trench, rifle down.
 * Returns the muzzle.
 */
function soldier(ctx, x, y, s, now, phase, run, aim = Math.PI) {
  const bob = run ? Math.abs(Math.sin(now / 90 + phase)) * 1.5 * s : Math.sin(now / 700 + phase) * 0.5 * s;
  ctx.fillStyle = '#C9CFD8';
  ctx.fillRect(x - 1.6 * s, y - 8 * s - bob, 3.2 * s, 6 * s);
  ctx.beginPath();
  ctx.arc(x, y - 9.5 * s - bob, 1.9 * s, 0, TAU);
  ctx.fillStyle = '#E8ECF1';
  ctx.fill();
  const shoulder = [x - 1 * s, y - 7 * s - bob];
  const angle = run ? Math.PI * 0.75 : aim; // running: rifle carried across the chest
  const muzzle = [shoulder[0] + Math.cos(angle) * 6 * s, shoulder[1] + Math.sin(angle) * 6 * s];
  ctx.strokeStyle = '#2F3540';
  ctx.lineWidth = 0.9 * s;
  ctx.beginPath();
  ctx.moveTo(shoulder[0] - Math.cos(angle) * 1.5 * s, shoulder[1] - Math.sin(angle) * 1.5 * s);
  ctx.lineTo(...muzzle);
  ctx.stroke();
  return muzzle;
}

/**
 * The front line: far walkers advancing on the ridge in the haze, a trench on the right with its
 * snow bank, turrets turning to fire at the walkers, soldiers holding the line, blasts of snow.
 * `main` is the big walker in the foreground (its x, or null when it is down), a target too.
 */
function iceFront(ctx, s, now, w, h, ground, scale, main) {
  const f = s.front;
  const ridge = ground - 12 * scale;
  // Far walkers, small and pale in the haze; they fire at the trench now and then
  const far = f.walkers.map((m) => {
    const sc = scale * m.size;
    const speed = (34 * sc) / (2600 * 0.75);
    const span = w + 300 * sc;
    const x = (((now - m.start) * speed) % span) - 150 * sc;
    ctx.save();
    ctx.globalAlpha = 0.7;
    const parts = walker(ctx, x, ridge, sc, now + m.start);
    ctx.restore();
    return { x, y: ridge - 110 * sc, gun: parts.guns[0] };
  });
  // Haze over the far walkers
  const haze = ctx.createLinearGradient(0, ridge - 140 * scale, 0, ridge);
  haze.addColorStop(0, 'rgba(160, 185, 215, 0)');
  haze.addColorStop(1, 'rgba(160, 185, 215, .28)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, ridge - 140 * scale, w, 140 * scale);
  // The trench, from 62 % of the width to the edge: dug ground, snow bank in front
  const left = w * 0.62;
  const trenchY = ground - 4 * scale;
  ctx.fillStyle = '#5D6E88';
  ctx.fillRect(left, trenchY - 2 * scale, w - left, 7 * scale);
  ctx.beginPath();
  ctx.moveTo(left - 10 * scale, trenchY + 5 * scale);
  for (let x = left - 10 * scale; x <= w; x += 14 * scale) ctx.lineTo(x, trenchY - 3 * scale - Math.sin(x / 23) * 2 * scale);
  ctx.lineTo(w, trenchY + 5 * scale);
  ctx.closePath();
  ctx.fillStyle = '#EEF4FA';
  ctx.fill();
  // Walkers on screen, in front of the trench: what the line fires at
  const targets = [...far, ...(main === null ? [] : [{ x: main, y: ground - 120 * scale }])].filter((t) => t.x > -40 && t.x < left);
  const nearest = (tx) => targets.slice().sort((a, b) => Math.abs(a.x - tx) - Math.abs(b.x - tx))[0];
  // Soldiers: they aim at the nearest walker and fire now and then; one runs along the trench now and then
  for (const p of f.soldiers) {
    let x = p.at * w;
    if (p.run) {
      const t = (now - p.run.born) / 3000;
      if (t > 1) {
        p.at = Math.min(0.98, Math.max(0.64, p.at + p.run.dir * 0.12));
        p.run = null;
      } else x = (p.at + p.run.dir * 0.12 * t) * w;
    } else if (Math.random() < 0.0015) p.run = { born: now, dir: pick([-1, 1]) };
    const target = nearest(x);
    const aim = target ? Math.atan2(target.y - (trenchY - 9 * scale), target.x - x) : Math.PI;
    const muzzle = soldier(ctx, x, trenchY, scale * 1.35, now, p.phase, p.run ? p.run.dir : 0, aim);
    if (target && !p.run && now > p.next) {
      const d = Math.hypot(target.x - muzzle[0], target.y - muzzle[1]);
      s.iceBolts.push({ x: muzzle[0], y: muzzle[1], dx: ((target.x - muzzle[0]) / d) * 9, dy: ((target.y - muzzle[1]) / d) * 9, color: '#FF7A45', life: d / 9, impact: true });
      p.next = now + rand(1200, 4000);
    }
  }
  // Turrets: each aims at the nearest walker on screen and fires a short burst of orange bolts;
  // with no walker in sight, the barrel comes back level
  f.turrets.forEach((tu) => {
    const tx = tu.at * w;
    const target = nearest(tx);
    const aim = target ? Math.atan2(target.y - (trenchY - 9 * scale), target.x - tx) : Math.PI;
    tu.aim += (aim - tu.aim) * 0.08;
    const flash = Math.max(0, 1 - (now - tu.fired) / 150);
    const [mx, my] = turret(ctx, tx, trenchY - 3 * scale, scale, tu.aim, flash);
    if (target && now > tu.next) {
      const d = Math.hypot(target.x - mx, target.y - my) || 1;
      s.iceBolts.push({ x: mx, y: my, dx: ((target.x - mx) / d) * 10, dy: ((target.y - my) / d) * 10, color: '#FF9A3D', life: d / 10, impact: true });
      tu.fired = now;
      tu.shots = (tu.shots || 0) + 1;
      tu.next = now + (tu.shots % 3 ? 180 : rand(1600, 3000));
    }
  });
  // The far walkers shell the line: a bolt, then a blast of snow where it lands
  if (Math.random() < 0.012 && far.length) {
    const { gun } = pick(far);
    const x = rand(left - 60 * scale, w * 0.98);
    const d = Math.hypot(x - gun[0], trenchY - gun[1]) || 1;
    s.iceBolts.push({ x: gun[0], y: gun[1], dx: ((x - gun[0]) / d) * 9, dy: ((trenchY - gun[1]) / d) * 9, color: '#7CFF6B', life: d / 9, blast: true });
  }
  if (Math.random() < 0.006) f.blasts.push({ x: rand(0.05, 0.6) * w, y: ground + rand(4, 20) * scale, born: now, bits: Array.from({ length: 10 }, () => ({ dx: rand(-1, 1), up: rand(1, 2.2), r: rand(1, 2.4) })) });
  f.blasts = f.blasts.filter((b) => snowBlast(ctx, b, now, scale));
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
    s.nextTow = now + rand(14000, 22000);
  }
  let x = s.fall ? s.fall.x : (now - s.walkStart) * speed - 160 * scale;
  if (x > w + 160 * scale) {
    // Gone on the right: a new walker on the left, without the cable of the old one
    s.walkStart = now;
    s.tow = null;
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
  iceFront(ctx, s, now, w, h, ground, scale, s.fall && fall >= 1.6 ? null : x);
  for (const p of s.speeders) if (p.down && now - p.down > 9000) p.down = 0; // a new speeder joins
  const ships = s.speeders.filter((p) => !p.down).map((p) => ({ p, o: orbit(p) }));
  // Tow cable: one speeder throws it when the walker is well in sight, then holds it until the fall
  if (!s.tow && !s.fall && now > s.nextTow && x > w * 0.1 && x < w * 0.6 && ships.length) s.tow = { p: pick(ships).p, born: now };
  const towing = s.tow && ships.find((x) => x.p === s.tow.p);
  if (s.tow && !towing) s.tow = null; // safety: its speeder is gone
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
    if (s.tow) {
      // Loops round the four legs at knee height, one more every 1.5 s; they tip with the walker
      const loops = s.fall ? 4 : Math.min(4, Math.floor((now - s.tow.born) / 1500));
      const xs = parts.legs.map((k) => k[0]);
      const ky = parts.legs.reduce((sum, k) => sum + k[1], 0) / 4;
      ctx.strokeStyle = 'rgba(225, 230, 238, .9)'; // pale: it shows against the snow and the night
      ctx.lineWidth = 1.4;
      for (let k = 0; k < loops; k++) {
        ctx.beginPath();
        ctx.ellipse((Math.min(...xs) + Math.max(...xs)) / 2, ky + k * 5 * scale, (Math.max(...xs) - Math.min(...xs)) / 2 + 8 * scale, 4 * scale, 0, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  if (s.fall && fall >= 1.6 && !s.fall.boom) {
    s.fall.boom = true;
    s.tow = null; // the cable goes with the wreck
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
  // The cable runs from the front knee to the speeder holding it; after four loops, the walker trips
  if (parts && towing) {
    if (!s.fall && now - s.tow.born > 7000) s.fall = { born: now, x };
    ctx.strokeStyle = 'rgba(225, 230, 238, .9)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(...tipped(parts.legs[3]));
    ctx.lineTo(towing.o.x, towing.o.y);
    ctx.stroke();
  }
  for (const { o } of ships) if (o.depth >= 0) snowspeeder(ctx, o.x, o.y, o.size, o.dir, now);
  // Bolts: red from the speeders towards the walker's body, green from its head guns
  if (ships.length && parts && Math.random() < 0.03) {
    const { o } = pick(ships);
    const d = Math.hypot(x - o.x, ground - 110 * scale - o.y) || 1;
    s.iceBolts.push({ x: o.x, y: o.y, dx: ((x - o.x) / d) * 8, dy: ((ground - 110 * scale - o.y) / d) * 8, color: '#FF5C5C', life: d / 8, impact: true });
  }
  // The walker fires bursts of three at a speeder, aiming where it is going
  if (ships.length && parts && !s.fall) {
    const targets = ships.filter((x) => !s.tow || x.p !== s.tow.p); // the one holding the cable is too low to aim at
    if (!s.burst && now > s.nextBurst && targets.length) s.burst = { target: pick(targets).p, left: 3, next: now };
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
    if (b.impact && b.life <= 1) {
      // It hits the walker's hull: a spark and a few sparks flying off
      s.booms.push({ x: b.x, y: b.y, r: 5 * scale, born: now, sparks: Array.from({ length: 6 }, () => rand(0, TAU)) });
      return false;
    }
    if (b.blast && b.life <= 1) {
      s.front.blasts.push({ x: b.x, y: b.y, born: now, bits: Array.from({ length: 12 }, () => ({ dx: rand(-1, 1), up: rand(1, 2.4), r: rand(1, 2.6) })) });
      return false;
    }
    // A green bolt that reaches a speeder brings it down
    const hit = b.color === '#7CFF6B' && ships.find(({ p, o }) => !p.down && (!s.tow || p !== s.tow.p) && Math.hypot(o.x - b.x, o.y - b.y) < 12 * scale);
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

export const galaxie = {
  make: (w, h) => ({
    born: Date.now(), stars: Array.from({ length: Math.round((w * h) / 2600) }, () => spaceStar(w, h)),
    chase: null, chases: 0, nextChase: Date.now() + 3000, bolts: [], jump: null, nextJump: Date.now() + 14000,
    cruiser: { born: Date.now() - 2500, plates: hullPlates(), shots: [] }, meteors: [], booms: [],
    speeders: [{ a: 0, speed: 0.0011, rx: 150 }, { a: 2.4, speed: 0.0008, rx: 190 }, { a: 4.2, speed: 0.00095, rx: 120 }],
    iceBolts: [], tow: null, nextTow: Date.now() + 8000, walkStart: Date.now() - 4000, fall: null,
    burst: null, nextBurst: Date.now() + 1500, gunFired: 0,
    front: {
      walkers: [{ start: Date.now() - 9000, size: 0.42 }, { start: Date.now() - 30000, size: 0.34 }],
      turrets: [0.7, 0.82, 0.94].map((at) => ({ at, aim: Math.PI, next: Date.now() + rand(500, 2500), fired: 0 })),
      soldiers: [0.66, 0.68, 0.74, 0.77, 0.79, 0.86, 0.88, 0.91, 0.97].map((at) => ({ at, phase: rand(0, TAU), run: null, next: Date.now() + rand(800, 4000) })),
      blasts: [],
    },
  }),
  draw: (ctx, s, now, w, h) => galaxy(ctx, s, now, w, h),
};
