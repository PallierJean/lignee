/**
 * Drawing helpers shared by several scenes: random draws, what falls (snowflakes, petals, leaves)
 * and what flies across the canvas, the moon, gulls, glows and the ink of the manga pages.
 */

export const TAU = 2 * Math.PI;

export const rand = (a, b) => a + Math.random() * (b - a);

export const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** A falling object, at the top (`top`) or anywhere in height `h`. */
export function faller(w, h, top, size, colors) {
  const r = rand(...size);
  return {
    x: rand(0, w), y: top ? rand(-30, -5) : rand(0, h), r,
    speed: 0.25 + r * 0.12, sway: rand(0.4, 1.4), phase: rand(0, TAU),
    spin: rand(0, TAU), spinSpeed: rand(-0.04, 0.04), color: pick(colors), crystal: Math.random() < 0.35,
  };
}

/** Makes the objects fall; those leaving at the bottom restart from the top. `wind` pushes them sideways. */
export function fall(list, w, h, now, wind, make) {
  list.forEach((f, i) => {
    f.y += f.speed;
    f.x += Math.sin((now / 900) * f.sway + f.phase) * 0.45 + wind * (0.6 + f.r * 0.08);
    f.spin += f.spinSpeed;
    if (f.y > h + 20 || f.x < -40 || f.x > w + 40) list[i] = make(true);
  });
}

/** An object crossing the canvas from one edge to the other, undulating. */
export function flyer(w, h, speed, size) {
  const right = Math.random() < 0.5;
  return {
    x: right ? -30 : w + 30, y: rand(0.08, 0.9) * h, dir: right ? 1 : -1,
    speed: rand(...speed), wave: rand(10, 40), period: rand(1200, 2600), phase: rand(0, TAU),
    r: rand(...size), born: Date.now(),
  };
}

/** Moves a flying object; returns its current position, or null if it has left. */
export function fly(b, now, w) {
  b.x += b.dir * b.speed;
  if (b.x < -60 || b.x > w + 60) return null;
  return [b.x, b.y + Math.sin(now / b.period * TAU + b.phase) * b.wave];
}

export const INK = '#141414';           // line ink

/** Fills then inks the outline of the current path. */
export function inked(ctx, fill, width = 2) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Gull: two wings like a circumflex accent, flapping. */
export function gull(ctx, x, y, b, now) {
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

/** Releases a flying object into the list now and then, up to `max`. */
export function release(list, max, chance, make) {
  if (list.length < max && Math.random() < chance) list.push(make());
}
