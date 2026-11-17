/**
 * Small line icons (inline SVG, in the colour of the text), for buttons whose meaning a picture says
 * faster than a word: they always come with a label or a title.
 */
const svg = (body) => `<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

/** Back to the gallery: an arrow going back, over a picture. */
export const ICON_TO_GALLERY = svg('<path d="M6 3.5 2.5 7 6 10.5"/><path d="M2.5 7h7a4 4 0 0 1 0 8H8"/>');

/** Delete: a bin. */
export const ICON_TRASH = svg('<path d="M2.5 4.5h11M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5"/><path d="M4 4.5l.7 8.6a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.7-8.6M6.7 7v4.5M9.3 7v4.5"/>');
