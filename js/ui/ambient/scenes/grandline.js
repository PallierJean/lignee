/**
 * Grand Line: a manga page (ink lines, screentone, sound effects) where a pirate ship sails,
 * chased by the navy firing its cannons, whose rubber-armed sailor catches his straw hat;
 * islands, gulls and a sea monster.
 */

import { TAU, rand, flyer, fly, INK, inked, gull, release } from './shared.js';

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

export const grandline = {
  make: () => ({
    clouds: [{ x: 0, y: 0.12, s: 1.1, speed: 70 }, { x: 420, y: 0.24, s: 0.8, speed: 95 }, { x: 900, y: 0.08, s: 0.9, speed: 80 }, { x: 1300, y: 0.3, s: 0.7, speed: 110 }],
    gulls: [], monster: null, nextMonster: Date.now() + 5000,
    wash: null, nextWash: Date.now() + 2500, hat: { mode: 'head' }, nextBlow: Date.now() + 4000, tone: null,
    shot: null, nextShot: Date.now() + 3000,
  }),
  draw: (ctx, s, now, w, h) => grandLine(ctx, s, now, w, h),
};
