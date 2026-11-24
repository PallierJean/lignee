/**
 * Recognising faces on this computer: the local server (server.js) compares the faces of a photo
 * of the tree with those already identified (faces.js) and suggests who they may be. Only with the
 * local server and OpenCV installed; elsewhere, the gallery suggests no one.
 */
import { S } from '../state.js';
import { isPhotoFile } from '../model/people.js';

let status = null; // promise of readiness
let ready = false;

/** Asks the server once whether it can recognise faces; resolves to true or false. */
export function checkFaces() {
  if (S.mode !== 'file') return Promise.resolve(false);
  status = status || fetch('api/faces', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : { ready: false }))
    .catch(() => ({ ready: false }))
    .then((o) => (ready = Boolean(o && o.ready)));
  return status;
}

/** True if faces can be looked for on image `ref` here (known after checkFaces). */
export const canFindFaces = (ref) => ready && S.mode === 'file' && isPhotoFile(ref);

/** Who may be on image `ref` ("photos/…") of the open tree: [{ x, y, id, score }]. */
export async function findFaces(ref) {
  const url = `api/trees/${encodeURIComponent(S.tree)}/photos/${encodeURIComponent(String(ref).slice(7))}/faces`;
  const r = await fetch(url, { method: 'POST' });
  if (!r.ok) throw new Error((await r.text().catch(() => '')) || r.statusText);
  const o = await r.json();
  return Array.isArray(o && o.faces) ? o.faces : [];
}

/** True if the local server recognises faces (known after checkFaces). */
export const facesReady = () => ready && S.mode === 'file';

/**
 * The whole gallery of the open tree: { groups: [{ faces: [{ photo, x, y, w, box }] }], portraits:
 * [{ id, photo, x, y, w, box }] } (unknown faces seen on several photos, faces for missing portraits).
 */
export async function faceOverview() {
  const r = await fetch(`api/trees/${encodeURIComponent(S.tree)}/faces`, { cache: 'no-store' });
  if (!r.ok) throw new Error((await r.text().catch(() => '')) || r.statusText);
  const o = await r.json();
  return { groups: Array.isArray(o && o.groups) ? o.groups : [], portraits: Array.isArray(o && o.portraits) ? o.portraits : [] };
}
