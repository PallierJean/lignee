/**
 * Fan chart: a half-disc, the focus person in the middle, each ring
 * a generation. Father on the left and mother on the right of each sector, in Sosa order.
 * The same drawing is used on screen and in print: only the colours change.
 */
import { S } from '../state.js';
import { esc } from '../utils/dom.js';
import { P, given, surname, maiden, lifeYears } from '../model/people.js';

export const MAX_FAN_GENS = 10;

const CENTER = 74;                 // radius of the central disc
const RING = [0, 96, 92, 92, 112, 120, 130, 140, 150, 170, 190]; // thickness of each ring
const FONT = [0, 13, 12, 11, 10.5, 9.5, 8.5, 8, 7, 6, 5];           // text size, at most

/**
 * Colours of a fan chart element: `kind` text | muted | empty | sector | center.
 * On screen (no `c`), classes (analysis.css): the security policy forbids the style attribute.
 * In print, the `c` colours as SVG attributes.
 */
function paint(c, kind, sex) {
  if (!c) return `class="fan-${kind}${sex ? ' sx-' + sex : ''}"`;
  if (kind === 'text' || kind === 'muted') return `fill="${c[kind]}"`;
  if (kind === 'empty') return `fill="${c.empty}" stroke="${c.line}" stroke-width=".8"`;
  return `fill="${c[sex]}" stroke="${c.stroke[sex]}" stroke-width="${kind === 'center' ? 2 : 1.3}"`;
}

/** Ancestors at their Sosa slots, generation by generation: [[id|null, ...], ...]. */
function fanLevels(focus, maxGens) {
  const levels = [[focus]];
  for (let g = 1; g <= maxGens; g++) {
    const row = [];
    for (const id of levels[g - 1]) {
      const p = id ? P(id) : null;
      row.push(p && S.people.has(p.fatherId) ? p.fatherId : null, p && S.people.has(p.motherId) ? p.motherId : null);
    }
    if (!row.some(Boolean)) break;
    levels.push(row);
  }
  return levels;
}

const point = (cx, cy, r, a) => [(cx + r * Math.cos(a)).toFixed(2), (cy - r * Math.sin(a)).toFixed(2)];

function sector(cx, cy, r0, r1, a0, a1) {
  const [x0, y0] = point(cx, cy, r1, a0);
  const [x1, y1] = point(cx, cy, r1, a1);
  const [x2, y2] = point(cx, cy, r0, a1);
  const [x3, y3] = point(cx, cy, r0, a0);
  return `M${x0},${y0}A${r1},${r1} 0 0 1 ${x1},${y1}L${x2},${y2}A${r0},${r0} 0 0 0 ${x3},${y3}Z`;
}

const cut = (text, max) => (text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text);

/** A sector's text: tangential on the first rings, along the radius after that. */
function sectorText(id, cx, cy, r0, r1, mid, g, c) {
  const p = P(id);
  const thick = r1 - r0;
  const radial = g >= 3;
  const arc = (r0 + thick / 2) * (Math.PI / 2 ** g); // width of the sector at its middle
  // Narrowest rings: the text takes the sector's width, on a single line
  const size = Math.min(FONT[g], arc / 1.25);
  const room = radial ? thick - 10 : arc - 8;
  const chars = Math.max(3, Math.floor(room / (size * 0.56)));
  const name = surname(p) || maiden(p);
  const lines = arc < size * 2.4
    ? [[cut([given(p) || '—', name].filter(Boolean).join(' '), chars), 700, size]]
    : [[cut(given(p) || '—', chars), 700, size], [cut(name, chars), 400, size]];
  // Enough room for the years: every ring except the narrowest
  if (g <= 5) lines.push([cut(lifeYears(p), chars), 400, size - 1.5]);
  const [x, y] = point(cx, cy, r0 + thick / 2, mid);
  const deg = (mid * 180) / Math.PI;
  const angle = radial ? (mid > Math.PI / 2 ? 180 - deg : -deg) : 90 - deg;
  const step = size * 1.2;
  const top = -((lines.length - 1) * step) / 2;
  const spans = lines.filter(([x0]) => x0).map(([text, weight, s], i) => `<tspan x="0" y="${(top + i * step).toFixed(1)}" font-size="${s}" font-weight="${weight}">${esc(text)}</tspan>`).join('');
  return `<text transform="translate(${x},${y}) rotate(${angle.toFixed(1)})" text-anchor="middle" dominant-baseline="middle" ${paint(c, 'text')}>${spans}</text>`;
}

/** Drawn sector: an ancestor, or the empty slot just above a known ancestor (where to search next). */
const drawn = (levels, g, i) => !!(levels[g][i] || levels[g - 1][i >> 1]);

/**
 * Drawing dimensions for `gens` generations, cropped to the drawn sectors (a single line
 * going far back doesn't reserve the whole half-disc); (cx, cy): centre of the fan.
 */
export function fanSize(focus = S.focus, maxGens = MAX_FAN_GENS) {
  const levels = fanLevels(focus, maxGens);
  let [left, right, top] = [-CENTER, CENTER, -CENTER];
  let r0 = CENTER;
  for (let g = 1; g < levels.length; g++) {
    const r1 = r0 + RING[g];
    const n = 2 ** g;
    levels[g].forEach((id, i) => {
      if (!drawn(levels, g, i)) return;
      const a0 = Math.PI - (i * Math.PI) / n;
      const a1 = a0 - Math.PI / n;
      // Edges of the outer arc, and its top if it passes vertically above the centre
      for (const a of a1 <= Math.PI / 2 && Math.PI / 2 <= a0 ? [a0, a1, Math.PI / 2] : [a0, a1]) {
        left = Math.min(left, r1 * Math.cos(a));
        right = Math.max(right, r1 * Math.cos(a));
        top = Math.min(top, -r1 * Math.sin(a));
      }
    });
    r0 = r1;
  }
  return { gens: levels.length - 1, W: right - left + 20, H: CENTER - top + 30, cx: 10 - left, cy: 10 - top };
}

/** The fan chart as SVG; `c`: colours (without them, the theme's, see paint), `scale`: display scale. */
export function fanSVG(c = null, scale = 1, focus = S.focus, maxGens = MAX_FAN_GENS) {
  const levels = fanLevels(focus, maxGens);
  const { W, H, cx, cy } = fanSize(focus, maxGens);
  let out = '';
  let r0 = CENTER;
  for (let g = 1; g < levels.length; g++) {
    const r1 = r0 + RING[g];
    const n = 2 ** g;
    levels[g].forEach((id, i) => {
      const a0 = Math.PI - (i * Math.PI) / n;
      const a1 = a0 - Math.PI / n;
      const d = sector(cx, cy, r0 + 1, r1, a0, a1);
      if (!id) {
        if (drawn(levels, g, i)) out += `<path d="${d}" ${paint(c, 'empty')}/>`;
        return;
      }
      const sex = P(id).sex === 'M' || P(id).sex === 'F' ? P(id).sex : 'U';
      out += `<g class="fan-s" role="button" tabindex="0" data-act="person-open" data-id="${esc(id)}" data-sosa="${n + i}"><path d="${d}" ${paint(c, 'sector', sex)}/>`
        + sectorText(id, cx, cy, r0, r1, (a0 + a1) / 2, g, c) + '</g>';
    });
    r0 = r1;
  }
  const p = P(focus);
  const sex = p.sex === 'M' || p.sex === 'F' ? p.sex : 'U';
  out += `<g class="fan-s" role="button" tabindex="0" data-act="person-open" data-id="${esc(focus)}" data-sosa="1"><circle cx="${cx}" cy="${cy}" r="${CENTER}" ${paint(c, 'center', sex)}/>`
    + `<text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="14" font-weight="700" ${paint(c, 'text')}>${esc(cut(given(p) || '—', 16))}</text>`
    + `<text x="${cx}" y="${cy + 10}" text-anchor="middle" font-size="12" ${paint(c, 'text')}>${esc(cut(surname(p) || maiden(p), 18))}</text>`
    + `<text x="${cx}" y="${cy + 27}" text-anchor="middle" font-size="11" ${paint(c, 'muted')}>${esc(lifeYears(p))}</text></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * scale}" height="${H * scale}" font-family="Atkinson Hyperlegible, Segoe UI, system-ui, sans-serif">${out}</svg>`;
}
