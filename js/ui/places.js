/** Carte des lieux : points et migrations, dessinés en SVG sans fond de carte externe. */
import { S } from '../state.js';
import { esc } from '../utils/dom.js';
import { t } from '../i18n.js';
import { placeUses, migrations } from '../model/places.js';
import { knownPlaces, locatePlaces } from '../services/geocode.js';
import { toast } from './toast.js';

const W = 340;
const H = 340;
const PAD = 22;
const LABELS = 8;

// Contour très simplifié de la France, seul repère du fond : [longitude, latitude]
const FRANCE = [[2.5, 51.1], [4.2, 50], [5.9, 49.5], [8.2, 49], [7.6, 47.6], [6.1, 46.2], [7, 45.9], [6.7, 45], [7.6, 44.1],
  [7.5, 43.8], [6, 43.1], [5.3, 43.3], [4.5, 43.4], [3.7, 43.4], [3, 42.5], [1.5, 42.5], [-1.7, 43.3], [-1.2, 44.6], [-1.2, 46.1],
  [-2.2, 47.2], [-3.1, 47.6], [-4.8, 48.4], [-2, 48.65], [-1.9, 49.7], [-1.3, 49.7], [-1.1, 49.3], [0.1, 49.5], [1.6, 50.4], [1.8, 50.9]];

let busy = null;     // { done, total } pendant la localisation

function mapSVG(points, moves) {
  const lons = points.map((x) => x.lon);
  const lats = points.map((x) => x.lat);
  const mid = (Math.min(...lats) + Math.max(...lats)) / 2;
  const squeeze = Math.cos((mid * Math.PI) / 180);
  const spanX = Math.max((Math.max(...lons) - Math.min(...lons)) * squeeze, 0.5);
  const spanY = Math.max(Math.max(...lats) - Math.min(...lats), 0.5);
  const k = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY);
  const x0 = (Math.min(...lons) + Math.max(...lons)) / 2;
  const y0 = mid;
  const xy = (lon, lat) => [W / 2 + (lon - x0) * squeeze * k, H / 2 - (lat - y0) * k];
  const at = new Map(points.map((p) => [p.name, xy(p.lon, p.lat)]));

  const outline = FRANCE.map(([lon, lat]) => xy(lon, lat).map((v) => v.toFixed(1)).join(',')).join(' ');
  const maxN = Math.max(...points.map((p) => p.n));
  const lines = moves.filter((m) => at.has(m.from) && at.has(m.to)).map((m) => {
    const [ax, ay] = at.get(m.from);
    const [bx, by] = at.get(m.to);
    const cx = (ax + bx) / 2 + (by - ay) * 0.14;
    const cy = (ay + by) / 2 - (bx - ax) * 0.14;
    return `<path class="mv" d="M${ax.toFixed(1)},${ay.toFixed(1)}Q${cx.toFixed(1)},${cy.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}" stroke-width="${Math.min(4, 1 + m.n * 0.5)}" marker-end="url(#mvEnd)"><title>${esc(m.from)} → ${esc(m.to)} (${m.n})</title></path>`;
  }).join('');
  const dots = points.map((p) => {
    const [x, y] = at.get(p.name);
    return `<circle class="pt" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(3 + 6 * Math.sqrt(p.n / maxN)).toFixed(1)}"><title>${esc(p.name)} (${p.n})</title></circle>`;
  }).join('');
  // Les lieux les plus cités d'abord ; une étiquette qui en recouvrirait une autre est omise
  const placed = [];
  const labels = points.slice(0, LABELS).map((p) => {
    const [x, y] = at.get(p.name);
    if (placed.some(([px, py]) => Math.abs(px - x) < 70 && Math.abs(py - y) < 13)) return '';
    placed.push([x, y]);
    const right = x < W * 0.7;
    return `<text class="pl-t" x="${(x + (right ? 11 : -11)).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${right ? 'start' : 'end'}">${esc(p.name)}</text>`;
  }).join('');
  return `<svg class="map" viewBox="0 0 ${W} ${H}" role="img" aria-label="${t('map.label')}">`
    + '<defs><marker id="mvEnd" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0L8,4L0,8Z" class="mv-end"/></marker></defs>'
    + `<polygon class="fr" points="${outline}"/>${lines}${dots}${labels}</svg>`;
}

export function mapView() {
  const uses = placeUses();
  if (!uses.length) return `<p class="nofocus">${t('map.empty')}</p>`;
  const known = knownPlaces();
  const points = uses.filter((u) => known.get(u.name)).map((u) => ({ ...u, ...known.get(u.name) }));
  const missing = uses.filter((u) => !known.has(u.name));
  const notFound = uses.filter((u) => known.get(u.name) === null);
  const moves = migrations();

  let html = points.length ? mapSVG(points, moves) : `<p class="nofocus">${t('map.none')}</p>`;
  html += `<p class="hint an-hint">${t('map.legend')}</p>`;
  if (busy) html += `<p class="hint an-hint">${t('map.progress', busy.done, busy.total)}</p>`;
  else if (missing.length) {
    html += `<div class="row-btns reg-tools"><button class="btn small" type="button" data-act="map-locate">${t('map.locate', missing.length)}</button></div>`
      + `<p class="hint an-hint">${t('map.privacy')}</p>`;
  }
  if (notFound.length) html += `<p class="hint an-hint">${t('map.notFound', esc(notFound.map((x) => x.name).join(', ')))}</p>`;
  if (moves.length) {
    const top = moves.slice().sort((a, b) => b.n - a.n).slice(0, 8);
    html += `<section class="rel"><h3>${t('map.moves')}</h3><div class="bars">`
      + top.map((m) => `<div class="mv-row"><span>${esc(m.from)} → ${esc(m.to)}</span><span class="bv">${m.n}</span></div>`).join('') + '</div></section>';
  }
  return html;
}

/** Localise les lieux encore inconnus, puis redessine la carte. */
export async function locateMissing(refresh) {
  if (busy) return;
  const known = knownPlaces();
  const names = placeUses().map((u) => u.name).filter((n) => !known.has(n));
  busy = { done: 0, total: names.length };
  refresh();
  try {
    await locatePlaces(names, (done, total) => {
      busy = { done, total };
      if (S.tab === 'analyse' && S.analyse === 'map') refresh();
    });
  } catch (e) {
    toast(t('map.failed'), true);
  }
  busy = null;
  refresh();
}
