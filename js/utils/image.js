/** Photo preparation: downscaling and conversion to an embedded JPEG image (data URL). */
import { t } from '../i18n.js';

const MAX_SIDE = 320;   // longest side of the stored photo, in pixels
const QUALITY = 0.82;   // JPEG quality

export const DOCUMENT_SIDE = 1400; // document (certificate): large enough to stay readable

/**
 * Reads an image file, downscales it and returns a JPEG data URL
 * (a few dozen KB, to fit in browser storage or the database).
 */
export async function photoFromFile(file, maxSide = MAX_SIDE) {
  if (!file || !/^image\//.test(file.type)) throw new Error(t('img.notImage'));
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    // White background: transparent areas (PNG) don't turn black in JPEG
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', QUALITY);
  } catch (e) {
    throw new Error(t('img.unreadable'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
