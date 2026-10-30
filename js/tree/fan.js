/**
 * Roue d'ascendance : un demi-disque, la personne centrale au milieu, chaque anneau
 * une génération. Père à gauche et mère à droite de chaque secteur, dans l'ordre Sosa.
 * Le même dessin sert à l'écran et à l'impression : seules les couleurs changent.
 */
import { S } from '../state.js';
import { esc } from '../utils/dom.js';
import { P, given, surname, maiden, lifeYears } from '../model/people.js';

export const MAX_FAN_GENS = 7;

const CENTER = 74;                 // rayon du disque central
const RING = [0, 96, 92, 92, 112, 120, 130, 140]; // épaisseur de chaque anneau
const FONT = [0, 13, 12, 11, 10.5, 9.5, 8.5, 8];  // taille du texte

const SCREEN = {
  text: 'var(--ink)', muted: 'var(--muted)', line: 'var(--line)', empty: 'var(--paper)',
  M: 'var(--surface)', F: 'var(--surface)', U: 'var(--surface)', stroke: { M: 'var(--male)', F: 'var(--female)', U: 'var(--line)' },
};

/** Ancêtres aux places Sosa, génération par génération : [[id|null, ...], ...]. */
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

/** Texte d'un secteur : tangent aux premiers anneaux, le long du rayon ensuite. */
function sectorText(id, cx, cy, r0, r1, mid, g, c) {
  const p = P(id);
  const size = FONT[g];
  const thick = r1 - r0;
  const radial = g >= 3;
  const room = radial ? thick - 10 : (r0 + thick / 2) * (Math.PI / 2 ** g) - 8;
  const chars = Math.max(3, Math.floor(room / (size * 0.56)));
  const lines = [
    [cut(given(p) || '—', chars), 700, size],
    [cut(surname(p) || maiden(p), chars), 400, size],
  ];
  // Assez de place pour les années : tous les anneaux sauf les plus serrés
  if (g <= 5) lines.push([cut(lifeYears(p), chars), 400, size - 1.5]);
  const [x, y] = point(cx, cy, r0 + thick / 2, mid);
  const deg = (mid * 180) / Math.PI;
  const angle = radial ? (mid > Math.PI / 2 ? 180 - deg : -deg) : 90 - deg;
  const step = size * 1.2;
  const top = -((lines.length - 1) * step) / 2;
  const spans = lines.filter(([x0]) => x0).map(([text, weight, s], i) => `<tspan x="0" y="${(top + i * step).toFixed(1)}" font-size="${s}" font-weight="${weight}">${esc(text)}</tspan>`).join('');
  return `<text transform="translate(${x},${y}) rotate(${angle.toFixed(1)})" text-anchor="middle" dominant-baseline="middle" style="fill:${c.text}">${spans}</text>`;
}

/** Dimensions du dessin pour `gens` générations. */
export function fanSize(focus = S.focus, maxGens = MAX_FAN_GENS) {
  const gens = fanLevels(focus, maxGens).length - 1;
  const R = CENTER + RING.slice(1, gens + 1).reduce((s, x) => s + x, 0);
  return { gens, W: 2 * R + 20, H: R + CENTER + 30, R };
}

/** La roue en SVG ; `c` : couleurs (celles du thème à l'écran), `scale` : échelle d'affichage. */
export function fanSVG(c = SCREEN, scale = 1, focus = S.focus, maxGens = MAX_FAN_GENS) {
  const levels = fanLevels(focus, maxGens);
  const { W, H, R } = fanSize(focus, maxGens);
  const cx = W / 2;
  const cy = R + 10;
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
        out += `<path d="${d}" style="fill:${c.empty};stroke:${c.line};stroke-width:.8"/>`;
        return;
      }
      const sex = P(id).sex === 'M' || P(id).sex === 'F' ? P(id).sex : 'U';
      out += `<g class="fan-s" role="button" tabindex="0" data-act="person-open" data-id="${esc(id)}"><path d="${d}" style="fill:${c[sex]};stroke:${c.stroke[sex]};stroke-width:1.3"/>`
        + sectorText(id, cx, cy, r0, r1, (a0 + a1) / 2, g, c) + '</g>';
    });
    r0 = r1;
  }
  const p = P(focus);
  const sex = p.sex === 'M' || p.sex === 'F' ? p.sex : 'U';
  out += `<g class="fan-s" role="button" tabindex="0" data-act="person-open" data-id="${esc(focus)}"><circle cx="${cx}" cy="${cy}" r="${CENTER}" style="fill:${c[sex]};stroke:${c.stroke[sex]};stroke-width:2"/>`
    + `<text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="14" font-weight="700" style="fill:${c.text}">${esc(cut(given(p) || '—', 16))}</text>`
    + `<text x="${cx}" y="${cy + 10}" text-anchor="middle" font-size="12" style="fill:${c.text}">${esc(cut(surname(p) || maiden(p), 18))}</text>`
    + `<text x="${cx}" y="${cy + 27}" text-anchor="middle" font-size="11" style="fill:${c.muted}">${esc(lifeYears(p))}</text></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * scale}" height="${H * scale}" font-family="Atkinson Hyperlegible, Segoe UI, system-ui, sans-serif">${out}</svg>`;
}
