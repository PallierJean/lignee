/**
 * Thème « Constellations » : le vrai ciel de Bordeaux ce soir, dessiné sous l'arbre. Les étoiles
 * des constellations (model/sky.js) sont placées comme on les voit en levant la tête : zénith au
 * centre, nord en haut, est à gauche (projection stéréographique). Le ciel tourne d'une heure par
 * minute, de 21 h à 5 h, puis recommence ; les étoiles scintillent, les plus brillantes portent des
 * aigrettes, une étoile au hasard s'embrase un instant, une étoile filante passe de temps en temps.
 * Si le système demande moins d'animations, le ciel de ce soir reste immobile.
 */
import { reduced } from '../config.js';
import { t, getLang } from '../i18n.js';
import { skyAt, tonight } from '../model/sky.js';

const FRAME = 100;     // ms entre deux images
const SPEED = 60;      // le ciel tourne 60 fois plus vite que l'heure : une heure par minute
const SHOOT = 7000;    // une étoile filante toutes les … ms, en moyenne

let layer = null;
let timer = null;
let start = 0;         // instant réel du lancement
let sky0 = null;       // instant du ciel au lancement
let shooting = null;   // étoile filante en cours : { x, y, angle, born }
let nextShoot = 0;
let flash = null;      // étoile qui s'embrase un instant : { id, born }
let nextFlash = 0;
const FLASH = 1500;    // une étoile s'embrase toutes les … ms, en moyenne
const FLASH_LIFE = 1100;

/** Instant du ciel montré : il avance d'une heure par minute, de 21 h à 5 h, puis repart de 21 h. */
function skyTime(now) {
  if (reduced) return sky0;
  const d = new Date(sky0.getTime() + (now - start) * SPEED);
  const h = d.getHours();
  if (h >= 5 && h < 21) {
    start = now;
    sky0 = new Date(d);
    sky0.setHours(21, 0, 0, 0);
    return sky0;
  }
  return d;
}

/** Projection : hauteur et azimut -> point de la toile (zénith au centre, horizon à `radius`). */
function projector(w, h) {
  const radius = h * 0.8;
  const cx = w / 2;
  const cy = h / 2;
  return ({ alt, az }) => {
    const r = Math.tan(((90 - alt) * Math.PI) / 360) * radius;
    const a = (az * Math.PI) / 180;
    return [cx - r * Math.sin(a), cy - r * Math.cos(a)];
  };
}

/** Une image du ciel. */
function frame() {
  if (document.hidden && !reduced) return;
  const canvas = layer.firstChild;
  const box = layer.parentElement;
  const w = box.clientWidth;
  const h = box.clientHeight;
  const ratio = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
  const now = Date.now();
  const when = skyTime(now);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const at = projector(w, h);
  const lang = getLang();
  // Une étoile au hasard s'embrase un instant
  if (!reduced && now > nextFlash) {
    const visible = skyAt(when).flatMap((c, ci) => Object.entries(c.stars).filter(([, s]) => s.alt > 5).map(([key]) => `${ci}:${key}`));
    flash = visible.length ? { id: visible[Math.floor(Math.random() * visible.length)], born: now } : null;
    nextFlash = now + FLASH * (0.5 + Math.random());
  }

  for (const [ci, c] of skyAt(when).entries()) {
    const up = Object.values(c.stars).filter((s) => s.alt > 0);
    if (!up.length) continue;
    // Traits de la figure : seulement entre deux étoiles au-dessus de l'horizon
    ctx.strokeStyle = 'rgba(176, 196, 255, .42)';
    ctx.lineWidth = 1;
    ctx.shadowColor = 'rgba(159, 180, 255, .8)';
    ctx.shadowBlur = 4;
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
    // Étoiles : elles scintillent, chacune à son rythme ; les plus brillantes plus grosses
    for (const [key, s] of Object.entries(c.stars)) {
      if (s.alt <= 0) continue;
      const [x, y] = at(s);
      const seed = ci * 31 + key.charCodeAt(0) * 7 + key.length;
      const glow = reduced ? 1 : 0.75 + 0.25 * Math.sin(now / (500 + (seed % 7) * 130) + seed);
      ctx.shadowColor = '#A9BDFF';
      ctx.shadowBlur = s.bright ? 12 : 7;
      ctx.fillStyle = `rgba(255, 255, 255, ${(0.7 + 0.3 * glow).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(x, y, (s.bright ? 2.8 : 1.8) * (0.85 + 0.15 * glow), 0, 2 * Math.PI);
      ctx.fill();
      // Aigrettes des étoiles brillantes ; plus grandes pour celle qui s'embrase
      const age = flash && flash.id === `${ci}:${key}` ? (now - flash.born) / FLASH_LIFE : 1;
      const burst = age < 1 ? Math.sin(age * Math.PI) : 0;
      if (s.bright || burst > 0) sparkle(ctx, x, y, (s.bright ? 5 + 5 * glow : 0) + 16 * burst, 0.35 + 0.4 * glow * (s.bright ? 1 : 0) + 0.6 * burst);
      if (s.name) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(214, 224, 255, .7)';
        ctx.font = '10.5px "Atkinson Hyperlegible", sans-serif';
        ctx.fillText(s.name, x + 6, y - 5);
      }
    }
    // Nom de la constellation, au milieu de ses étoiles visibles
    if (up.length >= 2) {
      const pts = up.map(at);
      const mx = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
      const my = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(176, 196, 255, .55)';
      ctx.font = 'italic 11.5px "Gloock", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(lang === 'en' ? c.en : c.fr, mx, my + 16);
      ctx.textAlign = 'start';
    }
  }
  if (!reduced) shootingStar(ctx, now, w, h);

  // Légende : le lieu, la date et l'heure du ciel montré
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(214, 224, 255, .6)';
  ctx.font = '11.5px "Atkinson Hyperlegible", sans-serif';
  const date = when.toLocaleDateString(t('locale'), { day: 'numeric', month: 'long' });
  const time = when.toLocaleTimeString(t('locale'), { hour: '2-digit', minute: '2-digit' });
  ctx.fillText(t('sky.caption', date, time), 12, h - 12);
}

/** Aigrettes : une croix de lumière fine autour d'une étoile, plus une croix plus courte en biais. */
function sparkle(ctx, x, y, len, alpha) {
  if (len <= 0) return;
  ctx.save();
  ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, alpha).toFixed(2)})`;
  ctx.shadowColor = '#DCE4FF';
  ctx.shadowBlur = 6;
  ctx.lineCap = 'round';
  ctx.lineWidth = 1;
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

/** Étoile filante : une traînée qui file en biais, puis s'éteint. */
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

/** Lance (`on`) ou arrête le ciel. */
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
  sky0 = tonight();
  nextShoot = start + 3000;
  nextFlash = start + 800;
  frame();
  // Ciel immobile si le système demande moins d'animations : redessiné seulement si la taille change
  timer = setInterval(frame, reduced ? 2000 : FRAME);
}
