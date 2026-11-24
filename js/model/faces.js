/**
 * Face suggestions: who may be on a new image, from the faces already identified in the tree.
 *
 * The faces come from the local server (faces.js, scripts/faces-worker.py): for each image,
 * [{ box: [x, y, w, h] in fractions of the image, vec: [numbers] }]. Two faces are the same person
 * when their vectors point the same way (cosine). The people's known faces are those under a marker
 * of the gallery and archives (tags with x and y, in percent), and their portraits.
 * Pure functions: the server and the tests share them.
 */

/** Cosine above which two faces are the same person (SFace's threshold, OpenCV). */
export const SAME = 0.363;
/** Faces kept per person to compare with: their portrait first, then the latest markers. */
export const PER_PERSON = 12;

export function cosine(a, b) {
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    ab += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}

const center = (f) => [(f.box[0] + f.box[2] / 2) * 100, (f.box[1] + f.box[3] / 2) * 100];
const round1 = (v) => Math.round(v * 10) / 10;

/**
 * The face under a marker at (x, y), in percent of the image: the one whose box holds it, else the
 * nearest one, if the marker is within a face's size of it (clicked on the hair, the chin); or null.
 */
export function faceAt(faces, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const f of faces || []) {
    const [bx, by, bw, bh] = f.box.map((v) => v * 100);
    if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) return f;
    const [cx, cy] = center(f);
    const d = Math.hypot((x - cx) / bw, (y - cy) / bh); // in face sizes
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return bestD <= 1.2 ? best : null;
}

/** The largest face of an image (a portrait: the person it shows), or null. */
export const largestFace = (faces) => (faces || []).reduce((a, f) => (!a || f.box[2] * f.box[3] > a.box[2] * a.box[3] ? f : a), null);

/**
 * Known faces: person id -> [vec]. `refs` are [{ id, faces, x?, y? }], in order of preference: a
 * marker (x, y) takes the face under it, a portrait (no x, y) its largest face.
 */
export function knownFaces(refs, perPerson = PER_PERSON) {
  const known = new Map();
  for (const r of refs || []) {
    if (!r || !r.id || !Array.isArray(r.faces)) continue;
    const list = known.get(r.id) || [];
    if (list.length >= perPerson) continue;
    const f = typeof r.x === 'number' && typeof r.y === 'number' ? faceAt(r.faces, r.x, r.y) : largestFace(r.faces);
    if (f && Array.isArray(f.vec)) known.set(r.id, [...list, f.vec]);
  }
  return known;
}

const listOf = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);
const isFile = (s) => typeof s === 'string' && s.startsWith('photos/');
const placedTags = (o) => listOf(o.tags).filter((x) => typeof x.id === 'string' && typeof x.x === 'number' && typeof x.y === 'number');

/**
 * What a saved tree (backup format: people, sources, media as lists) knows of the faces, for image
 * `photo`: { tags: its markers, refs: [{ id, photo, x?, y? }] } with the people's portraits first,
 * then the markers of the gallery (latest first) and of the archives (sources with markers).
 */
export function faceRefs(tree, photo) {
  const o = tree && typeof tree === 'object' ? tree : {};
  const refs = listOf(o.people).filter((p) => typeof p.id === 'string' && isFile(p.photo)).map((p) => ({ id: p.id, photo: p.photo }));
  const images = [...listOf(o.media)].sort((a, b) => (+b.createdAt || 0) - (+a.createdAt || 0)).concat(listOf(o.sources));
  let tags = [];
  for (const m of images) {
    if (!isFile(m.photo)) continue;
    if (m.photo === photo) tags = tags.concat(placedTags(m));
    else for (const x of placedTags(m)) refs.push({ id: x.id, photo: m.photo, x: x.x, y: x.y });
  }
  return { tags, refs };
}

/**
 * Suggestions for the faces of an image: [{ x, y, id, score }], (x, y) the face's centre in percent.
 * A face already under a marker (`tags` of the image) is left out, as are the people already placed
 * on it; a person is suggested on one face at most, the closest pairs first.
 */
export function suggestFaces(faces, known, tags = []) {
  const placed = (tags || []).filter((x) => x && typeof x.x === 'number' && typeof x.y === 'number');
  const taken = new Set(placed.map((x) => faceAt(faces, x.x, x.y)).filter(Boolean));
  const done = new Set(placed.map((x) => x.id));
  const open = (faces || []).filter((f) => !taken.has(f) && Array.isArray(f.vec));
  const pairs = [];
  for (const f of open) {
    for (const [id, vecs] of known) {
      if (done.has(id)) continue;
      const score = Math.max(...vecs.map((v) => cosine(f.vec, v)));
      if (score >= SAME) pairs.push({ f, id, score });
    }
  }
  pairs.sort((a, b) => b.score - a.score);
  const out = [];
  const used = new Set();
  for (const { f, id, score } of pairs) {
    if (used.has(f) || done.has(id)) continue;
    used.add(f);
    done.add(id);
    const [x, y] = center(f);
    out.push({ x: round1(x), y: round1(y), id, score: Math.round(score * 1000) / 1000 });
  }
  return out.sort((a, b) => a.x - b.x);
}
