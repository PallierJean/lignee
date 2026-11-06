/** DOM utilities. */

export const $ = (selector) => document.querySelector(selector);

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes a value before inserting it into HTML. */
export function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

/**
 * Replaces the content of `el` with `html`. Computed styles (positions, sizes) are written as
 * data-style="…": the security policy forbids the style attribute in HTML, not in JavaScript.
 */
export function setHTML(el, html) {
  el.innerHTML = html;
  for (const x of el.querySelectorAll('[data-style]')) x.style.cssText = x.dataset.style;
}
