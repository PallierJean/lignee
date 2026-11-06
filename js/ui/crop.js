/**
 * Recadrage d'une photo de fiche, au moment de la choisir : la photo s'affiche derrière un cadre
 * portrait (4:5, le format des fiches) ; on la fait glisser et on zoome (curseur ou molette) pour
 * placer le visage. Le cadre reste toujours rempli. À la validation, seule la partie cadrée est
 * gardée, en JPEG de 256 × 320 pixels.
 */
import { $ } from '../utils/dom.js';
import { t } from '../i18n.js';

export const FRAME = { w: 288, h: 360 };   // cadre affiché, en pixels (4:5)
const OUT = { w: 256, h: 320 };            // photo enregistrée
const QUALITY = 0.85;
const MAX_ZOOM = 4;                         // au plus 4 fois le zoom qui remplit juste le cadre

let crop = null; // { img, url, x, y, scale, min, resolve, drag }

/** Zoom qui remplit juste le cadre, sans bande vide. */
export const coverScale = (w, h, frame = FRAME) => Math.max(frame.w / w, frame.h / h);

/** Garde l'image sur tout le cadre : position (x, y) du coin de l'image, bornée. */
export function clampView({ x, y, scale }, w, h, frame = FRAME) {
  return {
    scale,
    x: Math.min(0, Math.max(frame.w - w * scale, x)),
    y: Math.min(0, Math.max(frame.h - h * scale, y)),
  };
}

/** Partie de l'image (en pixels de l'image) qui se trouve dans le cadre. */
export function cropRect({ x, y, scale }, frame = FRAME) {
  return { sx: -x / scale, sy: -y / scale, sw: frame.w / scale, sh: frame.h / scale };
}

/** Zoome en gardant fixe le point (px, py) du cadre (le centre par défaut). */
function zoomTo(scale, px = FRAME.w / 2, py = FRAME.h / 2) {
  const s = Math.min(crop.min * MAX_ZOOM, Math.max(crop.min, scale));
  const k = s / crop.scale;
  Object.assign(crop, clampView({ scale: s, x: px - (px - crop.x) * k, y: py - (py - crop.y) * k }, crop.img.naturalWidth, crop.img.naturalHeight));
  show();
}

function show() {
  const img = $('#cropImg');
  img.style.width = `${crop.img.naturalWidth * crop.scale}px`;
  img.style.height = `${crop.img.naturalHeight * crop.scale}px`;
  img.style.transform = `translate(${crop.x}px, ${crop.y}px)`;
  $('#cropZoom').value = String(crop.scale / crop.min);
}

/**
 * Ouvre le recadrage pour le fichier image `file`. Renvoie la photo recadrée (data URL JPEG),
 * ou null si l'on annule.
 */
export async function cropPhoto(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error(t('img.notImage'));
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (e) {
    URL.revokeObjectURL(url);
    throw new Error(t('img.unreadable'));
  }
  const min = coverScale(img.naturalWidth, img.naturalHeight);
  // Au départ : tout le cadre rempli, image centrée
  crop = { img, url, scale: min, min, x: (FRAME.w - img.naturalWidth * min) / 2, y: (FRAME.h - img.naturalHeight * min) / 2 };
  $('#cropImg').src = url;
  show();
  $('#cropDlg').hidden = false;
  $('#cropZoom').focus();
  return new Promise((resolve) => {
    crop.resolve = resolve;
  });
}

/** Ferme le recadrage : `keep` garde la partie cadrée, sinon on annule. */
export function closeCrop(keep) {
  if (!crop) return;
  let photo = null;
  if (keep) {
    const canvas = document.createElement('canvas');
    canvas.width = OUT.w;
    canvas.height = OUT.h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // les zones transparentes (PNG) ne deviennent pas noires en JPEG
    ctx.fillRect(0, 0, OUT.w, OUT.h);
    const { sx, sy, sw, sh } = cropRect(crop);
    ctx.drawImage(crop.img, sx, sy, sw, sh, 0, 0, OUT.w, OUT.h);
    photo = canvas.toDataURL('image/jpeg', QUALITY);
  }
  $('#cropDlg').hidden = true;
  URL.revokeObjectURL(crop.url);
  const { resolve } = crop;
  crop = null;
  resolve(photo);
}

/** Curseur de zoom. */
export function cropZoomInput(value) {
  if (crop) zoomTo(crop.min * Number(value));
}

/** Molette sur la photo : zoom autour de la souris. */
export function cropWheel(ev) {
  if (!crop || !ev.target.closest || !ev.target.closest('#cropStage')) return;
  ev.preventDefault();
  const r = $('#cropStage').getBoundingClientRect();
  zoomTo(crop.scale * (ev.deltaY < 0 ? 1.1 : 1 / 1.1), ev.clientX - r.left, ev.clientY - r.top);
}

/** Faire glisser la photo dans le cadre. */
export function cropDrag(ev) {
  if (!crop) return;
  if (ev.type === 'pointerdown') {
    if (!ev.target.closest || !ev.target.closest('#cropStage')) return;
    crop.drag = { x: ev.clientX, y: ev.clientY, from: { x: crop.x, y: crop.y } };
    return;
  }
  if (!crop.drag) return;
  if (ev.type === 'pointermove') {
    const { from } = crop.drag;
    Object.assign(crop, clampView({ scale: crop.scale, x: from.x + ev.clientX - crop.drag.x, y: from.y + ev.clientY - crop.drag.y }, crop.img.naturalWidth, crop.img.naturalHeight));
    show();
    return;
  }
  crop.drag = null;
}

/** Vrai si le recadrage est ouvert (Échap l'annule). */
export const cropOpen = () => !!crop;
