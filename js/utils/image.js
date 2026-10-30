/** Préparation des photos : réduction et conversion en image JPEG intégrée (data URL). */
import { t } from '../i18n.js';

const MAX_SIDE = 320;   // plus grand côté de la photo enregistrée, en pixels
const QUALITY = 0.82;   // qualité JPEG

export const DOCUMENT_SIDE = 1400; // document (acte) : assez grand pour rester lisible

/**
 * Lit un fichier image, le réduit et renvoie une data URL JPEG
 * (quelques dizaines de Ko, pour tenir dans le stockage du navigateur ou la base).
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
    // Fond blanc : les zones transparentes (PNG) ne deviennent pas noires en JPEG
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
