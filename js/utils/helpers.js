/** Generic utilities. */

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Prefixed unique identifier, for example "p_lx3k9a2b4c". */
export const rid = (prefix) =>
  prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Lowercase text without accents, for searching. */
export const norm = (s) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** A first name or a family name with a capital to each word: "marie-lou" → "Marie-Lou", "o'neil" → "O'Neil". */
export const capitalName = (s) =>
  String(s ?? '').trim().replace(/\s+/g, ' ').replace(/(^|[\s\-'’])(\p{Ll})/gu, (m, sep, c) => sep + c.toUpperCase());

/** A family name all in capitals, as the civil registers write it: "de la Tour" → "DE LA TOUR". */
export const upperName = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

/** Runs `worker` on each item, at most `limit` at a time. */
export async function pool(items, limit, worker) {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

/** Marks an error whose message was already shown, so it isn't reported twice. Returns it. */
export function markReported(e) {
  if (e && typeof e === 'object') e.reported = true;
  return e;
}
