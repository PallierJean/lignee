/**
 * Commune map: dots and migrations, drawn in SVG with no external base map.
 * It can be explored: zoom (buttons, wheel), mouse drag, framing a department;
 * a click on a commune lists its people and highlights its migrations.
 */
import { S } from '../state.js';
import { $, esc } from '../utils/dom.js';
import { t } from '../i18n.js';
import { P, fullName, lifeYears } from '../model/people.js';
import { cityUses, migrations, parsePlace } from '../model/places.js';
import { departmentCode, departmentName } from '../model/departments.js';
import { knownPlaces, locatePlaces } from '../services/geocode.js';
import { toast } from './toast.js';

const W = 340;
const H = 360;
const PAD = 26;
const MIN_SPAN = 0.4;  // degrees: a single commune isn't enlarged infinitely
const ZOOM = 1.6;      // factor of one zoom step
const K_MAX = 4000;    // pixels per degree at most

// Very simplified outline of France, the only background landmark: [longitude, latitude]
const FRANCE = [[2.5, 51.1], [4.2, 50], [5.9, 49.5], [8.2, 49], [7.6, 47.6], [6.1, 46.2], [7, 45.9], [6.7, 45], [7.6, 44.1],
  [7.5, 43.8], [6, 43.1], [5.3, 43.3], [4.5, 43.4], [3.7, 43.4], [3, 42.5], [1.5, 42.5], [-1.7, 43.3], [-1.2, 44.6], [-1.2, 46.1],
  [-2.2, 47.2], [-3.1, 47.6], [-4.8, 48.4], [-2, 48.65], [-1.9, 49.7], [-1.3, 49.7], [-1.1, 49.3], [0.1, 49.5], [1.6, 50.4], [1.8, 50.9]];

let busy = null;     // { done, total } while locating
let view = null;     // { lon, lat, k }: centre and pixels per degree; null: show everything
let selected = '';   // chosen commune
let drag = null;     // { x, y, lon, lat, k, moved } during a drag

/** Located communes: [{ name, n, ids, lat, lon }]. */
function located() {
  const known = knownPlaces();
  return cityUses().filter((u) => known.get(u.name)).map((u) => ({ ...u, ...known.get(u.name) }));
}

/** View that shows all these communes. */
function fit(points) {
  const lons = points.map((x) => x.lon);
  const lats = points.map((x) => x.lat);
  const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const lon = (Math.min(...lons) + Math.max(...lons)) / 2;
  const squeeze = Math.cos((lat * Math.PI) / 180);
  const spanX = Math.max((Math.max(...lons) - Math.min(...lons)) * squeeze, MIN_SPAN);
  const spanY = Math.max(Math.max(...lats) - Math.min(...lats), MIN_SPAN);
  return { lon, lat, k: Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY) };
}

/** Conversion from coordinates to the map (xy) and back (lonLat), for view `v`. */
function projector(v) {
  const squeeze = Math.cos((v.lat * Math.PI) / 180);
  return {
    xy: (lon, lat) => [W / 2 + (lon - v.lon) * squeeze * v.k, H / 2 - (lat - v.lat) * v.k],
    lonLat: (x, y) => [v.lon + (x - W / 2) / (squeeze * v.k), v.lat - (y - H / 2) / v.k],
  };
}

function mapSVG(points, moves, v) {
  const { xy } = projector(v);
  const at = new Map(points.map((p) => [p.name, xy(p.lon, p.lat)]));
  const inside = ([x, y]) => x > -20 && x < W + 20 && y > -20 && y < H + 20;
  const outline = FRANCE.map(([lon, lat]) => xy(lon, lat).map((n) => n.toFixed(1)).join(',')).join(' ');
  const maxN = Math.max(...points.map((p) => p.n));
  const lines = moves.filter((m) => at.has(m.from) && at.has(m.to)).map((m) => {
    const [ax, ay] = at.get(m.from);
    const [bx, by] = at.get(m.to);
    const cx = (ax + bx) / 2 + (by - ay) * 0.14;
    const cy = (ay + by) / 2 - (bx - ax) * 0.14;
    const on = selected && (m.from === selected || m.to === selected) ? ' on' : '';
    return `<path class="mv${on}" d="M${ax.toFixed(1)},${ay.toFixed(1)}Q${cx.toFixed(1)},${cy.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}" stroke-width="${Math.min(4, 1 + m.n * 0.5)}" marker-end="url(#mvEnd)"><title>${esc(m.from)} → ${esc(m.to)} (${m.n})</title></path>`;
  }).join('');
  const shown = points.filter((p) => inside(at.get(p.name)));
  const dots = shown.map((p) => {
    const [x, y] = at.get(p.name);
    return `<circle class="pt${p.name === selected ? ' sel' : ''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(3 + 6 * Math.sqrt(p.n / maxN)).toFixed(1)}"`
      + ` data-act="map-point" data-name="${esc(p.name)}"><title>${esc(p.name)} (${p.n})</title></circle>`;
  }).join('');
  // Most cited communes first (the chosen one above all); a label that would overlap another is left out
  const placed = [];
  const labels = [...shown].sort((a, b) => (b.name === selected) - (a.name === selected) || b.n - a.n).map((p) => {
    const [x, y] = at.get(p.name);
    const w = 6 + p.name.length * 5.2;
    const right = x < W * 0.7;
    const x0 = right ? x + 9 : x - 9 - w;
    if (placed.some(([px, py, pw]) => x0 < px + pw && px < x0 + w && Math.abs(py - y) < 12)) return '';
    placed.push([x0, y, w]);
    return `<text class="pl-t" x="${(x + (right ? 9 : -9)).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${right ? 'start' : 'end'}">${esc(p.name)}</text>`;
  }).join('');
  return `<svg class="map${selected ? ' picking' : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${t('map.label')}">`
    + '<defs><marker id="mvEnd" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0L8,4L0,8Z" class="mv-end"/></marker></defs>'
    + `<polygon class="fr" points="${outline}"/>${lines}${dots}${labels}</svg>`;
}

/** Departments (or countries) of the located communes, most cited first: [{ key, label, n, points }]. */
function regions(points) {
  const groups = new Map();
  for (const p of points) {
    const pl = parsePlace(p.name);
    const code = pl.country ? '' : departmentCode(pl.dept);
    const key = pl.country || code;
    if (!key) continue;
    const label = pl.country || departmentName(code);
    const g = groups.get(key) || groups.set(key, { key, label, n: 0, points: [] }).get(key);
    g.n += p.n;
    g.points.push(p);
  }
  return [...groups.values()].sort((a, b) => b.n - a.n);
}

/** People of the chosen commune, with a link to their record. */
function placeHTML(points) {
  const p = points.find((x) => x.name === selected);
  if (!p) return '';
  const ids = [...p.ids].filter((id) => P(id)).sort((a, b) => fullName(P(a)).localeCompare(fullName(P(b))));
  return `<section class="rel map-place"><h3>${esc(p.name)} <span class="n">${esc(t('map.mentions', p.n))}</span></h3><ul class="map-people">`
    + ids.map((id) => `<li><button class="link" type="button" data-act="person-open" data-id="${esc(id)}">${esc(fullName(P(id)))}</button> <small>${esc(lifeYears(P(id)))}</small></li>`).join('')
    + '</ul></section>';
}

export function mapView() {
  const uses = cityUses();
  if (!uses.length) return `<p class="nofocus">${t('map.empty')}</p>`;
  const known = knownPlaces();
  const points = located();
  const missing = uses.filter((u) => !known.has(u.name));
  const notFound = uses.filter((u) => known.get(u.name) === null);
  const moves = migrations();

  let html = '';
  if (points.length) {
    const chips = regions(points).slice(0, 8)
      .map((g) => `<button class="btn small" type="button" data-act="map-region" data-key="${esc(g.key)}">${esc(g.label)} · ${g.n}</button>`).join('');
    html += `<div class="row-btns map-tools"><button class="btn small" type="button" data-act="map-zoom" data-d="1" aria-label="${t('ctl.zoomIn')}">+</button>`
      + `<button class="btn small" type="button" data-act="map-zoom" data-d="-1" aria-label="${t('ctl.zoomOut')}">−</button>`
      + `<button class="btn small" type="button" data-act="map-region">${t('map.fit')}</button>${chips}</div>`
      + `<div class="map-box" id="mapBox">${mapSVG(points, moves, view || fit(points))}</div>`
      + `<p class="hint an-hint">${t('map.help')}</p><div id="mapPlace">${placeHTML(points)}</div>`;
  } else {
    html += `<p class="nofocus">${t('map.none')}</p>`;
  }
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

/** Redraws the map and the chosen commune, without the rest of the view (drag, wheel). */
function redraw() {
  const box = $('#mapBox');
  const points = located();
  if (!box || !points.length) return;
  box.innerHTML = mapSVG(points, migrations(), view || fit(points));
  $('#mapPlace').innerHTML = placeHTML(points);
}

/** Zooms one step (`d` = 1 in, -1 out) around map point (x, y), the centre by default. */
export function mapZoom(d, x = W / 2, y = H / 2) {
  const points = located();
  if (!points.length) return;
  const v = view || fit(points);
  const [lon, lat] = projector(v).lonLat(x, y);
  const k = Math.min(K_MAX, Math.max(5, v.k * ZOOM ** d));
  // The target point stays under the mouse
  const squeeze = Math.cos((v.lat * Math.PI) / 180);
  view = { k, lon: lon - (x - W / 2) / (squeeze * k), lat: lat + (y - H / 2) / k };
  redraw();
}

/** Frames a department or a country (`key`), or all communes (empty `key`). */
export function mapFit(key) {
  const g = key && regions(located()).find((x) => x.key === key);
  view = g ? fit(g.points) : null;
  redraw();
}

/** Click on a commune: its people; a second click leaves it. */
export function mapPick(name) {
  if (drag && drag.moved) return; // end of a drag, not a click
  selected = selected === name ? '' : name;
  redraw();
}

/** Map point (SVG coordinates) under the mouse. */
function mapPoint(ev) {
  const r = $('#mapBox svg').getBoundingClientRect();
  return [((ev.clientX - r.left) * W) / r.width, ((ev.clientY - r.top) * H) / r.height];
}

/** Wheel on the map: zoom around the mouse. */
export function mapWheel(ev) {
  if (!ev.target.closest || !ev.target.closest('#mapBox')) return;
  ev.preventDefault();
  mapZoom(ev.deltaY < 0 ? 1 : -1, ...mapPoint(ev));
}

/** Dragging the map: press, move, release. */
export function mapDrag(ev) {
  if (ev.type === 'pointerdown') {
    if (!ev.target.closest || !ev.target.closest('#mapBox') || ev.button !== 0) return;
    const points = located();
    if (!points.length) return;
    const v = view || fit(points);
    drag = { x: ev.clientX, y: ev.clientY, lon: v.lon, lat: v.lat, k: v.k, moved: false };
    return;
  }
  if (!drag) return;
  if (ev.type === 'pointermove') {
    const r = $('#mapBox svg').getBoundingClientRect();
    const dx = ((ev.clientX - drag.x) * W) / r.width;
    const dy = ((ev.clientY - drag.y) * H) / r.height;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    const squeeze = Math.cos((drag.lat * Math.PI) / 180);
    view = { k: drag.k, lon: drag.lon - dx / (squeeze * drag.k), lat: drag.lat + dy / drag.k };
    redraw();
    return;
  }
  // Released: the next click still sees the drag (mapPick ignores it), then it is forgotten
  const done = drag;
  setTimeout(() => {
    if (drag === done) drag = null;
  }, 0);
}

/** Locates the places still unknown, then redraws the map. */
export async function locateMissing(refresh) {
  if (busy) return;
  const known = knownPlaces();
  const names = cityUses().map((u) => u.name).filter((n) => !known.has(n));
  busy = { done: 0, total: names.length };
  refresh();
  try {
    await locatePlaces(names, (done, total) => {
      busy = { done, total };
      if (S.tab === 'analysis' && S.analysis === 'map') refresh();
    });
  } catch (e) {
    toast(t('map.failed'), true);
  }
  busy = null;
  refresh();
}
