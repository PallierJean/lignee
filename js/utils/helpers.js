/** Utilitaires génériques. */

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Identifiant unique préfixé, par exemple « p_lx3k9a2b4c ». */
export const rid = (prefix) =>
  prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Texte en minuscules sans accents, pour la recherche. */
export const norm = (s) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Exécute `worker` sur chaque élément, `limit` à la fois au maximum. */
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
