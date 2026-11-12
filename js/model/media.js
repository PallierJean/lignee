/**
 * The gallery: images of the tree (photos, letters, postcards), kept apart from the records,
 * as the unions are. Each image lists the people identified on it, its only link to them:
 *
 *   S.media: id -> { photo, back?, title, date, note, tags: [{ id, x?, y? }], createdAt? }
 *
 * A tag with `x` and `y` (percentages of the image) marks a face; without them, the person is on
 * the image without a marker yet. A person's gallery is the images where they are identified;
 * an image identifying no one stays in the tree's gallery.
 *
 * Up to format 2, each image belonged to one record (`media` of a person): `galleryFromPeople`
 * moves them out, the record's person becoming identified on it if they weren't.
 */
import { S } from '../state.js';
import { rid } from '../utils/helpers.js';

const listOf = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);
const placed = (x) => x.x != null && x.y != null && x.x !== '' && x.y !== '';
const percent = (v) => Math.min(100, Math.max(0, +v || 0));

/**
 * People identified on image `m`: [{ id, x?, y? }]. A marker's position is a number from 0 to 100
 * (an unreadable one, from an imported file, becomes 0); without a position, no marker.
 */
export function tagsOf(m) {
  return listOf(m && m.tags).filter((x) => typeof x.id === 'string' && x.id)
    .map((x) => (placed(x) ? { id: x.id, x: percent(x.x), y: percent(x.y) } : { id: x.id }));
}

/** True if a tag marks a face (it has a position). */
export const hasPlace = (tag) => 'x' in tag && 'y' in tag;

/** True if person `pid` is identified on image `m`. */
export const shows = (m, pid) => tagsOf(m).some((x) => x.id === pid);

/** Images of the tree: [{ id, m }], in the order they were added. */
export const allMedia = (media = S.media) => [...media].map(([id, m]) => ({ id, m }));

/** Images where person `pid` is identified: [{ id, m }]. */
export const mediaOf = (pid, media = S.media) => allMedia(media).filter(({ m }) => shows(m, pid));

/**
 * Format 2 → 3: the images kept in the records (`media` of each person) move to the gallery.
 * `people`: [{ id, data }] (changed: their `media` goes); `media`: [{ id, data }] already there.
 * Returns the gallery, [{ id, data }]. An image already in the gallery (same id) isn't doubled; one
 * without an id gets one.
 */
export function galleryFromPeople(people, media = []) {
  const out = [...media];
  const known = new Set(out.map((x) => x.id));
  for (const p of people) {
    const list = listOf(p.data && p.data.media);
    if (p.data && 'media' in p.data) delete p.data.media;
    for (const { id: given, ...m } of list) {
      if (known.has(given)) continue;
      // An image without an id (a file edited by hand) gets one: it isn't lost
      const id = typeof given === 'string' && given ? given : rid('m');
      known.add(id);
      const tags = listOf(m.tags);
      // The record that kept the image: its person stays linked to it
      if (!tags.some((x) => x.id === p.id)) tags.unshift({ id: p.id });
      out.push({ id, data: { ...m, tags } });
    }
  }
  return out;
}
