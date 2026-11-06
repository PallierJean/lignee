/**
 * Thème « Matrix » : une pluie de signes verts défile sur la toile, sous l'arbre. Chaque colonne
 * tombe à sa vitesse ; la tête de la goutte est presque blanche, la traînée s'éteint peu à peu
 * (on efface un peu de l'image à chaque image, la toile reste transparente). Les signes sont des
 * katakana et des chiffres, retournés comme dans le film. Arrêtée hors de ce thème ou si le système
 * demande moins d'animations (une pluie figée reste dans le fond), en pause quand l'onglet est caché.
 */
import { reduced } from '../config.js';

const SIZE = 16;     // px : largeur d'une colonne, hauteur d'un signe
const FRAME = 55;    // ms entre deux images
const GLYPHS = 'ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ0123456789Z:=*+-<>¦';
const FONT = `${SIZE - 2}px "IBM Plex Mono", "MS Gothic", "Hiragino Kaku Gothic Pro", "Noto Sans CJK JP", monospace`;

let layer = null;
let timer = null;
let drops = [];      // par colonne : { y (en signes), speed }

const pick = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

/** Une colonne repart d'en haut, à une hauteur et une vitesse au hasard. */
const drop = (h) => ({ y: -Math.random() * (h / SIZE), speed: 0.45 + Math.random() * 0.8 });

/** Une image : la traînée s'éteint un peu, chaque colonne avance et dessine son signe. */
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
  // La traînée s'éteint : on retire un peu de chaque pixel
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
    // Le signe d'avant redevient vert, la tête est presque blanche ; signes retournés
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

/** Lance (`on`) ou arrête la pluie. */
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
