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

/**
 * Size, in CSS pixels, for a layer drawn over the visible area of `box` (theme animations).
 * At some browser zooms (90 %, 110 %…) clientWidth rounds the real width up by a fraction of a
 * pixel: a layer that size overflows, a scrollbar appears, the box shrinks, the layer follows,
 * the scrollbar goes away… and the screen flickers. One pixel less never overflows.
 */
export const layerSize = (box) => [Math.max(0, box.clientWidth - 1), Math.max(0, box.clientHeight - 1)];
