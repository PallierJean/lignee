/**
 * Face suggestions: who may be on a new image, from the faces already identified in the tree.
 *
 * The faces come from the local server (faces.js, scripts/faces-worker.py): for each image,
 * [{ box: [x, y, w, h] in fractions of the image, vec: [numbers] }]. Two faces are the same person
 * when their vectors point the same way (cosine). The people's known faces are those under a marker
 * of the gallery and archives (tags with x and y, in percent), and their portraits.
 * Unknown faces seen on several images are grouped (unknownGroups): named once, they are all
 * identified. A person without a portrait can take their clearest face (portraitFaces).
 * Pure functions: the server and the tests share them.
 */

/** Cosine above which two faces are the same person (SFace's threshold, OpenCV). */
export const SAME = 0.363;
/** Faces kept per person to compare with: their portrait first, then the latest markers. */
export const PER_PERSON = 12;
/**
 * Cosine above which two unknown faces are grouped: stricter than SAME, since a group is named
 * at once and a wrong face in it would be tagged with the others.
 */
export const GROUP = 0.5;

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
/** Where a face is, for the page: its centre and width in percent of the image, its box in fractions. */
const where = (f) => {
  const [x, y] = center(f);
  return { x: round1(x), y: round1(y), w: round1(f.box[2] * 100), box: f.box };
};

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

/** The images of a saved tree's gallery (not the archives): [{ photo, tags }]. */
export const galleryImages = (tree) => listOf(tree && tree.media).filter((m) => isFile(m.photo)).map((m) => ({ photo: m.photo, tags: placedTags(m) }));

/** The people of a saved tree without a portrait: Set of ids. */
export const withoutPortrait = (tree) => new Set(listOf(tree && tree.people).filter((p) => typeof p.id === 'string' && !p.photo).map((p) => p.id));

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
 * The faces of an image without a marker, from left to right: [{ x, y, w, box, id?, score? }], with
 * (x, y) the face's centre and w its width in percent; `id` is the person suggested, if a known face
 * looks like it. A face already under a marker (`tags` of the image) is left out, and the people
 * already placed on it are not suggested; a person is suggested on one face at most, the closest
 * pairs first.
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
  const who = new Map(); // face -> { id, score }
  for (const { f, id, score } of pairs) {
    if (who.has(f) || done.has(id)) continue;
    who.set(f, { id, score: Math.round(score * 1000) / 1000 });
    done.add(id);
  }
  return open.map((f) => ({ ...where(f), ...who.get(f) })).sort((a, b) => a.x - b.x);
}

/** Best likeness of face `f` among the known faces (person id -> [vec]): its cosine, or 0. */
const bestLikeness = (f, known) => Math.max(0, ...[...known.values()].flat().map((v) => cosine(f.vec, v)));

/**
 * Unknown faces seen on several images: [{ faces: [{ photo, x, y, w, box }] }], the largest groups
 * first. `images` are [{ photo, faces, tags }]; a face is unknown if it has no marker and looks like
 * no known face. Two faces join when they look alike (GROUP), never two faces of the same image:
 * the same person is not twice on a photo.
 */
export function unknownGroups(images, known, same = GROUP) {
  const items = []; // { photo, f }
  for (const img of images || []) {
    const placed = placedTags(img);
    const taken = new Set(placed.map((x) => faceAt(img.faces, x.x, x.y)).filter(Boolean));
    for (const f of img.faces || []) {
      if (!taken.has(f) && Array.isArray(f.vec) && bestLikeness(f, known) < SAME) items.push({ photo: img.photo, f });
    }
  }
  const pairs = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].photo === items[j].photo) continue;
      const score = cosine(items[i].f.vec, items[j].f.vec);
      if (score >= same) pairs.push([score, i, j]);
    }
  }
  pairs.sort((a, b) => b[0] - a[0]);
  // Groups, closest pairs first; a group holds the images of its faces, to keep one face per image
  const group = items.map((_, i) => i);
  const photos = items.map((x) => new Set([x.photo]));
  const root = (i) => (group[i] === i ? i : (group[i] = root(group[i])));
  for (const [, i, j] of pairs) {
    const a = root(i);
    const b = root(j);
    if (a === b || [...photos[b]].some((p) => photos[a].has(p))) continue;
    group[b] = a;
    for (const p of photos[b]) photos[a].add(p);
  }
  const out = new Map();
  items.forEach((x, i) => {
    const r = root(i);
    out.set(r, [...(out.get(r) || []), { photo: x.photo, ...where(x.f) }]);
  });
  return [...out.values()].filter((faces) => faces.length > 1).sort((a, b) => b.length - a.length).map((faces) => ({ faces }));
}

/**
 * For the people without a portrait (`ids`), their clearest face under a marker: [{ id, photo, x, y,
 * w, box }], the face with the most pixels. `refs` are [{ id, photo, faces, size: [w, h], x, y }].
 */
export function portraitFaces(refs, ids) {
  const best = new Map(); // id -> { ref, f, area }
  for (const r of refs || []) {
    if (!ids.has(r.id) || typeof r.x !== 'number' || typeof r.y !== 'number') continue;
    const f = faceAt(r.faces, r.x, r.y);
    if (!f) continue;
    const [W, H] = Array.isArray(r.size) ? r.size : [1, 1];
    const area = f.box[2] * W * f.box[3] * H;
    if (!best.has(r.id) || area > best.get(r.id).area) best.set(r.id, { ref: r, f, area });
  }
  return [...best.values()].map(({ ref, f }) => ({ id: ref.id, photo: ref.photo, ...where(f) }));
}
