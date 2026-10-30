/** Utilitaires DOM. */

export const $ = (selector) => document.querySelector(selector);

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Échappe une valeur avant de l'insérer dans du HTML. */
export function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ENTITIES[c]);
}
