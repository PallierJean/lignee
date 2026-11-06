/**
 * Cropping a record photo when choosing it: the photo shows behind a portrait frame
 * (4:5, the card format); you drag it and zoom (slider or wheel) to
 * place the face. The frame always stays filled. On confirmation, only the framed part is
 * kept, as a 256 × 320 pixel JPEG.
 */
import { $ } from '../utils/dom.js';
import { t } from '../i18n.js';

export const FRAME = { w: 288, h: 360 };   // displayed frame, in pixels (4:5)
const OUT = { w: 256, h: 320 };            // stored photo
const QUALITY = 0.85;
const MAX_ZOOM = 4;                         // at most 4 times the zoom that just fills the frame

let crop = null; // { img, url, x, y, scale, min, resolve, drag }

/** Zoom that just fills the frame, with no empty band. */
export const coverScale = (w, h, frame = FRAME) => Math.max(frame.w / w, frame.h / h);

/** Keeps the image over the whole frame: position (x, y) of the image corner, clamped. */
export function clampView({ x, y, scale }, w, h, frame = FRAME) {
  return {
    scale,
    x: Math.min(0, Math.max(frame.w - w * scale, x)),
    y: Math.min(0, Math.max(frame.h - h * scale, y)),
  };
}

/** Part of the image (in image pixels) inside the frame. */
export function cropRect({ x, y, scale }, frame = FRAME) {
  return { sx: -x / scale, sy: -y / scale, sw: frame.w / scale, sh: frame.h / scale };
}

/** Zooms keeping the frame point (px, py) fixed (the centre by default). */
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
 * Opens the crop tool for image file `file`. Returns the cropped photo (JPEG data URL),
 * or null if cancelled.
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
  // At first: the whole frame filled, image centred
  crop = { img, url, scale: min, min, x: (FRAME.w - img.naturalWidth * min) / 2, y: (FRAME.h - img.naturalHeight * min) / 2 };
  $('#cropImg').src = url;
  show();
  $('#cropDlg').hidden = false;
  $('#cropZoom').focus();
  return new Promise((resolve) => {
    crop.resolve = resolve;
  });
}

/** Closes the crop tool: `keep` keeps the framed part, otherwise it cancels. */
export function closeCrop(keep) {
  if (!crop) return;
  let photo = null;
  if (keep) {
    const canvas = document.createElement('canvas');
    canvas.width = OUT.w;
    canvas.height = OUT.h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // transparent areas (PNG) don't turn black in JPEG
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

/** Zoom slider. */
export function cropZoomInput(value) {
  if (crop) zoomTo(crop.min * Number(value));
}

/** Wheel on the photo: zoom around the mouse. */
export function cropWheel(ev) {
  if (!crop || !ev.target.closest || !ev.target.closest('#cropStage')) return;
  ev.preventDefault();
  const r = $('#cropStage').getBoundingClientRect();
  zoomTo(crop.scale * (ev.deltaY < 0 ? 1.1 : 1 / 1.1), ev.clientX - r.left, ev.clientY - r.top);
}

/** Dragging the photo in the frame. */
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

/** True if the crop tool is open (Escape cancels it). */
export const cropOpen = () => !!crop;
