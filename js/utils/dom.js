/** Utilitaires DOM. */

export const $ = (selector) => document.querySelector(selector);

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Échappe une valeur avant de l'insérer dans du HTML. */
export function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

/**
 * Remplace le contenu de `el` par `html`. Les styles calculés (positions, tailles) s'y écrivent
 * data-style="…" : la politique de sécurité interdit l'attribut style dans le HTML, pas en JavaScript.
 */
export function setHTML(el, html) {
  el.innerHTML = html;
  for (const x of el.querySelectorAll('[data-style]')) x.style.cssText = x.dataset.style;
}
