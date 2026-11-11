/**
 * Free cropping of a gallery image: a frame with handles over the whole image, moved and resized
 * at will (a photo stays wide, the white border of a scanned album page goes). On confirmation,
 * only the framed part is kept, at the image's own resolution (at most DOCUMENT_SIDE).
 * Unlike the record photo (ui/crop.js), the shape is free.
 */
import { $ } from '../utils/dom.js';
import { t } from '../i18n.js';
import { DOCUMENT_SIDE } from '../utils/image.js';

const QUALITY = 0.9;
const MIN = 0.05; // the frame keeps at least 5 % of the image on each side

let state = null; // { img, url, rect: { x, y, w, h } (fractions of the image), drag, resolve }

/** Keeps a frame inside the image, at least MIN wide and high. */
export function clampRect({ x, y, w, h }) {
  const cw = Math.min(1, Math.max(MIN, w));
  const ch = Math.min(1, Math.max(MIN, h));
  return { x: Math.min(1 - cw, Math.max(0, x)), y: Math.min(1 - ch, Math.max(0, y)), w: cw, h: ch };
}

/**
 * Frame after dragging `part` ('move', or a corner: 'nw', 'ne', 'sw', 'se') by (dx, dy), in
 * fractions of the image, from frame `from`.
 */
export function dragRect(from, part, dx, dy) {
  if (part === 'move') return clampRect({ ...from, x: from.x + dx, y: from.y + dy });
  let { x, y, w, h } = from;
  const right = x + w;
  const bottom = y + h;
  if (part.includes('w')) x = Math.min(right - MIN, Math.max(0, x + dx));
  if (part.includes('n')) y = Math.min(bottom - MIN, Math.max(0, y + dy));
  const r = part.includes('e') ? Math.max(x + MIN, Math.min(1, right + dx)) : right;
  const b = part.includes('s') ? Math.max(y + MIN, Math.min(1, bottom + dy)) : bottom;
  return { x, y, w: r - x, h: b - y };
}

/**
 * Markers of the people identified (x, y in percentages of the image) once the image is cropped
 * to `rect`: moved into the new image; those left outside go.
 */
export function cropTags(tags, rect) {
  return (Array.isArray(tags) ? tags : []).map((tag) => ({
    ...tag,
    x: Math.round((((tag.x / 100) - rect.x) / rect.w) * 1000) / 10,
    y: Math.round((((tag.y / 100) - rect.y) / rect.h) * 1000) / 10,
  })).filter((tag) => tag.x >= 0 && tag.x <= 100 && tag.y >= 0 && tag.y <= 100);
}

function show() {
  const { x, y, w, h } = state.rect;
  const box = $('#freeCropBox');
  box.style.left = `${x * 100}%`;
  box.style.top = `${y * 100}%`;
  box.style.width = `${w * 100}%`;
  box.style.height = `${h * 100}%`;
  // What is cut off, darkened: four bands around the frame
  const band = (id, l, tp, wd, ht) => Object.assign($(id).style, { left: `${l * 100}%`, top: `${tp * 100}%`, width: `${wd * 100}%`, height: `${ht * 100}%` });
  band('#shadeTop', 0, 0, 1, y);
  band('#shadeBottom', 0, y + h, 1, 1 - y - h);
  band('#shadeLeft', 0, y, x, h);
  band('#shadeRight', x + w, y, 1 - x - w, h);
}

/**
 * Opens the free crop on image `src` (a data URL or an image address). Returns
 * { photo, rect } (the cropped JPEG and the frame kept, in fractions), or null if cancelled.
 */
export async function cropFree(src) {
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
  } catch (e) {
    throw new Error(t('img.unreadable'));
  }
  state = { img, rect: { x: 0, y: 0, w: 1, h: 1 }, drag: null };
  $('#freeCropImg').src = src;
  show();
  $('#freeCropDlg').hidden = false;
  return new Promise((resolve) => {
    state.resolve = resolve;
  });
}

/** Closes the free crop: `keep` keeps the framed part, otherwise it cancels. */
export function closeCropFree(keep) {
  if (!state) return;
  let out = null;
  if (keep) {
    const { img, rect } = state;
    const sw = img.naturalWidth * rect.w;
    const sh = img.naturalHeight * rect.h;
    const k = Math.min(1, DOCUMENT_SIDE / Math.max(sw, sh));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * k));
    canvas.height = Math.max(1, Math.round(sh * k));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // transparent areas (PNG) don't turn black in JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, img.naturalWidth * rect.x, img.naturalHeight * rect.y, sw, sh, 0, 0, canvas.width, canvas.height);
    out = { photo: canvas.toDataURL('image/jpeg', QUALITY), rect: { ...rect } };
  }
  $('#freeCropDlg').hidden = true;
  const { resolve } = state;
  state = null;
  resolve(out);
}

/** The whole image again. */
export function resetCropFree() {
  if (!state) return;
  state.rect = { x: 0, y: 0, w: 1, h: 1 };
  show();
}

/** Dragging the frame or one of its corners. */
export function cropFreeDrag(ev) {
  if (!state) return;
  if (ev.type === 'pointerdown') {
    const handle = ev.target.closest && ev.target.closest('[data-crop]');
    if (!handle) return;
    ev.preventDefault();
    const r = $('#freeCropStage').getBoundingClientRect();
    state.drag = { part: handle.dataset.crop, x: ev.clientX, y: ev.clientY, w: r.width || 1, h: r.height || 1, from: { ...state.rect } };
    return;
  }
  if (!state.drag) return;
  if (ev.type === 'pointermove') {
    const d = state.drag;
    state.rect = dragRect(d.from, d.part, (ev.clientX - d.x) / d.w, (ev.clientY - d.y) / d.h);
    show();
    return;
  }
  state.drag = null;
}

/** True if the free crop is open (Escape cancels it). */
export const cropFreeOpen = () => !!state;
