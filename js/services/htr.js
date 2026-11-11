/**
 * Reading handwriting on this computer: the local server (server.js) runs Kraken (htr.js) on a
 * photo of the tree and returns the lines it read. Only with the local server and Kraken
 * installed; elsewhere, the application shows the text read earlier, without reading.
 */
import { S } from '../state.js';
import { t } from '../i18n.js';
import { isPhotoFile } from '../model/people.js';

let status = null; // promise of { ready, model }
let ready = false;

/** Asks the server once whether it can read; resolves to { ready, model }. */
export function checkHtr() {
  if (S.mode !== 'file') return Promise.resolve({ ready: false, model: '' });
  status = status || fetch('api/htr', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : { ready: false }))
    .catch(() => ({ ready: false }))
    .then((o) => {
      ready = Boolean(o && o.ready);
      return { ready, model: (o && o.model) || '' };
    });
  return status;
}

/** True if image `ref` can be read here (known after checkHtr). */
export const canRead = (ref) => ready && S.mode === 'file' && isPhotoFile(ref);

/** Reads image `ref` ("photos/…") of the open tree: { model, lines }. */
export async function readPhoto(ref) {
  const url = `api/trees/${encodeURIComponent(S.tree)}/photos/${encodeURIComponent(String(ref).slice(7))}/read`;
  let r;
  try {
    r = await fetch(url, { method: 'POST' });
  } catch (e) {
    throw new Error(t('htr.noServer'));
  }
  if (!r.ok) throw new Error((await r.text().catch(() => '')) || t('htr.failed'));
  return r.json();
}
