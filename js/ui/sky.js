/**
 * Thème « Constellations » : le vrai ciel de Bordeaux, dessiné sous l'arbre. Les étoiles des
 * constellations (model/sky.js) sont placées comme on les voit en levant la tête : zénith au centre,
 * nord en haut, est à gauche (projection stéréographique), assez agrandies pour que les figures
 * s'écartent. Le ciel part de l'heure qu'il est et tourne en accéléré (une heure toutes les 30 s)
 * pendant une minute, puis revient en fondu à l'heure réelle : on le voit tourner, toujours juste. Les étoiles scintillent, les plus brillantes portent
 * des aigrettes, une étoile au hasard s'embrase un instant, une étoile filante passe de temps en
 * temps. Si le système demande moins d'animations, le ciel est redessiné sans ces effets.
 */
import { reduced } from '../config.js';
import { t, getLang } from '../i18n.js';
import { skyAt } from '../model/sky.js';

const FRAME = 100;     // ms entre deux images
const SHOOT = 7000;    // une étoile filante toutes les … ms, en moyenne
const ZOOM = 1.25;     // rayon de l'horizon, en hauteurs de toile : les constellations s'écartent
const SPEED = 120;     // en accéléré : une heure du ciel toutes les 30 s
const CYCLE = 60000;   // ms d'accéléré avant de revenir à l'heure réelle
const FADE = 1200;     // ms de fondu au retour

let layer = null;
let timer = null;
let start = 0;         // début du cycle d'accéléré
let shooting = null;   // étoile filante en cours : { x, y, angle, born }
let nextShoot = 0;
let flash = null;      // étoile qui s'embrase un instant : { id, born }
let nextFlash = 0;
const FLASH = 1500;    // une étoile s'embrase toutes les … ms, en moyenne
const FLASH_LIFE = 1100;

/** Projection : hauteur et azimut -> point de la toile (zénith au centre, horizon à `radius`). */
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
  // Heure du ciel : l'heure réelle, plus l'avance prise depuis le début du cycle
  const elapsed = reduced ? 0 : (now - start) % CYCLE;
  const when = new Date(now + elapsed * SPEED);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.globalAlpha = reduced ? 1 : Math.min(1, elapsed / FADE, (CYCLE - elapsed) / FADE); // fondu au retour
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
    // Étoiles : elles scintillent, chacune à son rythme ; les plus brillantes plus grosses
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
      // Aigrettes des étoiles brillantes ; plus grandes pour celle qui s'embrase
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
    // Nom de la constellation, au milieu de ses étoiles visibles
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

  // Légende : le lieu, la date et l'heure du ciel montré
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(214, 224, 255, .6)';
  ctx.font = '11.5px "Atkinson Hyperlegible", sans-serif';
  const date = when.toLocaleDateString(t('locale'), { day: 'numeric', month: 'long' });
  const time = when.toLocaleTimeString(t('locale'), { hour: '2-digit', minute: '2-digit' });
  ctx.fillText(t('sky.caption', date, time) + (reduced ? '' : t('sky.fast')), 12, h - 12);
}

/** Aigrettes : une croix de lumière fine autour d'une étoile, plus une croix plus courte en biais. */
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
  nextShoot = Date.now() + 3000;
  nextFlash = Date.now() + 800;
  frame();
  // Moins d'animations : sans scintillement ni filantes, redessiné toutes les 30 s pour suivre le ciel
  timer = setInterval(frame, reduced ? 30000 : FRAME);
}
