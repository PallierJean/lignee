/**
 * "Constellations" theme: the real sky over Bordeaux, drawn under the tree. The constellation
 * stars (model/sky.js) are placed as seen when looking up: zenith in the centre,
 * north at the top, east on the left (stereographic projection), enlarged enough for the figures
 * to spread out. The sky starts from the current time and turns fast (one hour every 30 s)
 * for a minute, then fades back to the real time: you see it turn, always accurate. The stars twinkle, the brightest have
 * spikes, a random star flares for a moment, a shooting star passes from time to
 * time. If the system asks for reduced motion, the sky is redrawn without these effects.
 */
import { layerSize } from '../utils/dom.js';
import { reduced } from '../config.js';
import { t, getLang } from '../i18n.js';
import { skyAt } from '../model/sky.js';

const FRAME = 100;     // ms entre deux images
const SHOOT = 7000;    // a shooting star every … ms, on average
const ZOOM = 1.25;     // horizon radius, in canvas heights: the constellations spread out
const SPEED = 120;     // sped up: one hour of sky every 30 s
const CYCLE = 60000;   // ms of fast motion before returning to the real time
const FADE = 1200;     // ms of fade on return

let layer = null;
let timer = null;
let start = 0;         // start of the fast-motion cycle
let shooting = null;   // current shooting star: { x, y, angle, born }
let nextShoot = 0;
let flash = null;      // star flaring for a moment: { id, born }
let nextFlash = 0;
const FLASH = 1500;    // a star flares every … ms, on average
const FLASH_LIFE = 1100;

/** Projection: altitude and azimuth -> canvas point (zenith in the centre, horizon at `radius`). */
function projector(w, h) {
  const radius = h * ZOOM;
  const cx = w / 2;
  const cy = h / 2;
  return ({ alt, az }) => {
    const r = Math.tan(((90 - alt) * Math.PI) / 360) * radius;
    const a = (az * Math.PI) / 180;
    return [cx - r * Math.sin(a), cy - r * Math.cos(a)];
  };
}

/** One frame of the sky. */
function frame() {
  if (document.hidden && !reduced) return;
  const canvas = layer.firstChild;
  const box = layer.parentElement;
  const [w, h] = layerSize(box);
  const ratio = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
  const now = Date.now();
  // Sky time: the real time, plus the lead gained since the start of the cycle
  const elapsed = reduced ? 0 : (now - start) % CYCLE;
  const when = new Date(now + elapsed * SPEED);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.globalAlpha = reduced ? 1 : Math.min(1, elapsed / FADE, (CYCLE - elapsed) / FADE); // fade on return
  const at = projector(w, h);
  const lang = getLang();
  // A random star flares for a moment
  if (!reduced && now > nextFlash) {
    const visible = skyAt(when).flatMap((c, ci) => Object.entries(c.stars).filter(([, s]) => s.alt > 5).map(([key]) => `${ci}:${key}`));
    flash = visible.length ? { id: visible[Math.floor(Math.random() * visible.length)], born: now } : null;
    nextFlash = now + FLASH * (0.5 + Math.random());
  }

  for (const [ci, c] of skyAt(when).entries()) {
    const up = Object.values(c.stars).filter((s) => s.alt > 0);
    if (!up.length) continue;
    // Figure lines: only between two stars above the horizon
    ctx.strokeStyle = 'rgba(176, 196, 255, .5)';
    ctx.lineWidth = 1.6;
    ctx.shadowColor = 'rgba(159, 180, 255, .8)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (const line of c.lines) {
      line.forEach((key, i) => {
        const a = c.stars[line[i - 1]];
        const b = c.stars[key];
        if (i === 0 || a.alt <= 0 || b.alt <= 0) return;
        ctx.moveTo(...at(a));
        ctx.lineTo(...at(b));
      });
    }
    ctx.stroke();
    // Stars: they twinkle, each at its own pace; the brightest are bigger
    for (const [key, s] of Object.entries(c.stars)) {
      if (s.alt <= 0) continue;
      const [x, y] = at(s);
      const seed = ci * 31 + key.charCodeAt(0) * 7 + key.length;
      const glow = reduced ? 1 : 0.75 + 0.25 * Math.sin(now / (500 + (seed % 7) * 130) + seed);
      ctx.shadowColor = '#A9BDFF';
      ctx.shadowBlur = s.bright ? 18 : 10;
      ctx.fillStyle = `rgba(255, 255, 255, ${(0.7 + 0.3 * glow).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(x, y, (s.bright ? 4.2 : 2.7) * (0.85 + 0.15 * glow), 0, 2 * Math.PI);
      ctx.fill();
      // Spikes of bright stars; larger for the one flaring
      const age = flash && flash.id === `${ci}:${key}` ? (now - flash.born) / FLASH_LIFE : 1;
      const burst = age < 1 ? Math.sin(age * Math.PI) : 0;
      if (s.bright || burst > 0) sparkle(ctx, x, y, (s.bright ? 8 + 7 * glow : 0) + 22 * burst, 0.35 + 0.4 * glow * (s.bright ? 1 : 0) + 0.6 * burst);
      if (s.name) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(214, 224, 255, .75)';
        ctx.font = '13px "Atkinson Hyperlegible", sans-serif';
        ctx.fillText(s.name, x + 9, y - 7);
      }
    }
    // Constellation name, in the middle of its visible stars
    if (up.length >= 2) {
      const pts = up.map(at);
      const mx = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
      const my = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(176, 196, 255, .6)';
      ctx.font = 'italic 16px "Gloock", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(lang === 'en' ? c.en : c.fr, mx, my + 20);
      ctx.textAlign = 'start';
    }
  }
  ctx.globalAlpha = 1;
  if (!reduced) shootingStar(ctx, now, w, h);

  // Caption: the place, date and time of the sky shown
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(214, 224, 255, .6)';
  ctx.font = '11.5px "Atkinson Hyperlegible", sans-serif';
  const date = when.toLocaleDateString(t('locale'), { day: 'numeric', month: 'long' });
  const time = when.toLocaleTimeString(t('locale'), { hour: '2-digit', minute: '2-digit' });
  ctx.fillText(t('sky.caption', date, time) + (reduced ? '' : t('sky.fast')), 12, h - 12);
}

/** Spikes: a thin cross of light around a star, plus a shorter diagonal cross. */
function sparkle(ctx, x, y, len, alpha) {
  if (len <= 0) return;
  ctx.save();
  ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, alpha).toFixed(2)})`;
  ctx.shadowColor = '#DCE4FF';
  ctx.shadowBlur = 6;
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(x - len, y);
  ctx.lineTo(x + len, y);
  ctx.moveTo(x, y - len);
  ctx.lineTo(x, y + len);
  ctx.stroke();
  ctx.lineWidth = 0.6;
  const d = len * 0.4;
  ctx.beginPath();
  ctx.moveTo(x - d, y - d);
  ctx.lineTo(x + d, y + d);
  ctx.moveTo(x - d, y + d);
  ctx.lineTo(x + d, y - d);
  ctx.stroke();
  ctx.restore();
}

/** Shooting star: a trail that streaks diagonally, then fades. */
function shootingStar(ctx, now, w, h) {
  if (!shooting && now > nextShoot) {
    shooting = { x: (0.15 + Math.random() * 0.7) * w, y: (0.1 + Math.random() * 0.5) * h, angle: (Math.random() < 0.5 ? 20 : 160) + Math.random() * 25, born: now };
    nextShoot = now + SHOOT * (0.5 + Math.random());
  }
  if (!shooting) return;
  const age = (now - shooting.born) / 1200;
  if (age > 1) {
    shooting = null;
    return;
  }
  const a = (shooting.angle * Math.PI) / 180;
  const head = [shooting.x + Math.cos(a) * 260 * age, shooting.y + Math.sin(a) * 260 * age];
  const tail = [head[0] - Math.cos(a) * 90, head[1] - Math.sin(a) * 90];
  const grad = ctx.createLinearGradient(...tail, ...head);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  grad.addColorStop(1, `rgba(255, 255, 255, ${(1 - age).toFixed(2)})`);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1.6;
  ctx.shadowBlur = 6;
  ctx.shadowColor = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(...tail);
  ctx.lineTo(...head);
  ctx.stroke();
}

/** Starts (`on`) or stops the sky. */
export function setSky(on) {
  const box = document.getElementById('canvas');
  const can = on && box && typeof document.createElement('canvas').getContext === 'function';
  if (!can) {
    clearInterval(timer);
    timer = null;
    if (layer) layer.remove();
    layer = null;
    return;
  }
  if (layer) return;
  layer = document.createElement('div');
  layer.className = 'sky';
  layer.setAttribute('aria-hidden', 'true');
  layer.append(document.createElement('canvas'));
  box.prepend(layer);
  start = Date.now();
  nextShoot = Date.now() + 3000;
  nextFlash = Date.now() + 800;
  frame();
  // Reduced motion: no twinkling or shooting stars, redrawn every 30 s to follow the sky
  timer = setInterval(frame, reduced ? 30000 : FRAME);
}
