/**
 * "Matrix" theme: a rain of green glyphs scrolls on the canvas, under the tree. Each column
 * falls at its own speed; the head of the drop is almost white, the trail fades little by little
 * (a bit of the image is erased each frame, the canvas stays transparent). The glyphs are
 * katakana and digits, mirrored as in the film. Stopped outside this theme or if the system
 * asks for reduced motion (a still rain stays in the background), paused when the tab is hidden.
 */
import { reduced } from '../config.js';

const SIZE = 16;     // px: column width, glyph height
const FRAME = 55;    // ms entre deux images
const GLYPHS = 'ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ0123456789Z:=*+-<>¦';
const FONT = `${SIZE - 2}px "IBM Plex Mono", "MS Gothic", "Hiragino Kaku Gothic Pro", "Noto Sans CJK JP", monospace`;

let layer = null;
let timer = null;
let drops = [];      // per column: { y (in glyphs), speed }

const pick = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

/** A column restarts from the top, at a random height and speed. */
const drop = (h) => ({ y: -Math.random() * (h / SIZE), speed: 0.45 + Math.random() * 0.8 });

/** One frame: the trail fades a little, each column advances and draws its glyph. */
function frame() {
  if (document.hidden) return;
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
    drops = Array.from({ length: Math.ceil(w / SIZE) }, () => drop(h));
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  // The trail fades: a little is taken off each pixel
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0, 0, 0, .11)';
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.font = FONT;
  ctx.textBaseline = 'top';
  drops.forEach((d, i) => {
    const before = Math.floor(d.y);
    d.y += d.speed;
    const row = Math.floor(d.y);
    if (row === before || row < 0) return;
    const x = i * SIZE;
    const y = row * SIZE;
    // The previous glyph turns green again, the head is almost white; mirrored glyphs
    ctx.clearRect(x, y - SIZE, SIZE, SIZE);
    ctx.save();
    ctx.translate(x + SIZE, 0);
    ctx.scale(-1, 1);
    ctx.fillStyle = 'rgba(0, 255, 65, .9)';
    ctx.fillText(pick(), 1, y - SIZE);
    ctx.fillStyle = '#E4FFEA';
    ctx.fillText(pick(), 1, y);
    ctx.restore();
    if (y > h && Math.random() > 0.96) drops[i] = drop(h);
  });
}

/** Starts (`on`) or stops the rain. */
export function setRain(on) {
  const box = document.getElementById('canvas');
  const can = on && !reduced && box && typeof document.createElement('canvas').getContext === 'function';
  if (!can) {
    clearInterval(timer);
    timer = null;
    if (layer) layer.remove();
    layer = null;
    return;
  }
  if (layer) return;
  layer = document.createElement('div');
  layer.className = 'rain';
  layer.setAttribute('aria-hidden', 'true');
  layer.append(document.createElement('canvas'));
  box.prepend(layer);
  drops = [];
  frame();
  timer = setInterval(frame, FRAME);
}
