/**
 * Printing the whole tree or the fan chart, on one sheet or
 * split over several sheets to assemble, and the family booklet.
 *
 * The tree is redrawn as SVG (vector lines and text, fixed light colours),
 * scaled to the page, then printed by the browser. "Save as PDF"
 * in the print dialog gives a PDF of the right size, thanks to the @page rule.
 */
import { CW, CH, RINGS_PATH, pageRule } from '../config.js';
import { S } from '../state.js';
import { $, esc, setHTML } from '../utils/dom.js';
import { longDate } from '../utils/dates.js';
import { P, given, surname, cardNames, cardDates, fullName, parentsName, currentSituation } from '../model/people.js';
import { buildFullLayout } from '../tree/full-layout.js';
import { fanSVG, fanSize } from '../tree/fan.js';
import { bestGrid, autoGrid, sheetCode, neighbours, OVERLAP, FOOT } from '../tree/tiles.js';
import { bookletHTML, familyBookHTML, fullBookHTML } from './booklet.js';
import { familyBookName } from '../model/family-book.js';
import { toast } from './toast.js';
import { t } from '../i18n.js';

const MM = 96 / 25.4;                          // CSS pixels per millimetre
const PAPER = { A4: [210, 297], A3: [297, 420], A2: [420, 594], A1: [594, 841], A0: [841, 1189] };
const FORMATS = Object.keys(PAPER);            // smallest to largest
const TILE_CHOICES = [1, 2, 3, 4, 5, 6, 8, 10];  // sheet widths offered

// Automatic tiling: millimetres per drawing unit aimed for to stay readable
const READABLE = { tree: 2.5 / 14, fan: 2 / 8 };  // first names 2.5 mm, smallest fan chart text 2 mm
const MARGIN = 10;                             // sheet margin, in mm
const HEAD = 16;                               // title and legend, in mm
const MAX_SCALE = 1.6;                         // maximum enlargement of a small tree
const SMALL_SCALE = 0.45;                      // below this, the text is too small on a sheet

// Fixed colours: the sheet is always light, whatever the screen theme
const C = {
  ink: '#16211E', muted: '#56645F', line: '#9AA8A2', edge: '#6F7D78',
  card: '#FFFFFF', focus: '#E6F1EE', accent: '#1D5B54', halo: '#2FA35A',
  M: '#4F86C6', F: '#E9A8BD',
};
const FONT = {
  body: '"Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace',
};

let customTitle = '';
let shownTitle = '';   // computed title shown in the field: it follows the chosen content
let layout = null;

/* ---------- Measurements ---------- */

/** Chosen sheet: orientation, dimensions (mm) and tree scale. */
function pageFor(format, orient, L) {
  const [short, long] = PAPER[format];
  const fit = (w, h) => Math.min(
    ((w - 2 * MARGIN) * MM) / L.W,
    ((h - 2 * MARGIN - HEAD) * MM) / L.H,
    MAX_SCALE,
  );
  const landscape = { orient: 'landscape', w: long, h: short, scale: fit(long, short) };
  const portrait = { orient: 'portrait', w: short, h: long, scale: fit(short, long) };
  if (orient === 'landscape') return landscape;
  if (orient === 'portrait') return portrait;
  return landscape.scale >= portrait.scale ? landscape : portrait;
}

/** Smallest larger size where the drawing stays readable on one sheet, or undefined. */
const betterFormat = (format, orient, L) =>
  FORMATS.slice(FORMATS.indexOf(format) + 1).find((f) => pageFor(f, orient, L).scale >= SMALL_SCALE);

const ctx = document.createElement('canvas').getContext('2d');

/** Truncates the text with "…" if it exceeds `max` pixels. */
function fit(text, font, max, spacing = 0) {
  ctx.font = font;
  const width = (t) => ctx.measureText(t).width + spacing * t.length;
  if (width(text) <= max) return text;
  let t = text;
  while (t.length > 1 && width(t + '…') > max) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}

/** Most frequent surname, or empty. */
function topSurname() {
  const count = new Map();
  for (const p of S.people.values()) {
    const s = surname(p);
    if (s) count.set(s, (count.get(s) || 0) + 1);
  }
  const top = [...count].sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : '';
}

/** Computed title: the focus person's father and mother, failing that the most frequent surname. */
function defaultTitle() {
  const family = parentsName(S.focus) || topSurname();
  if (!family) return t('pr.defaultTitle');
  return t(isBook(printContent()) ? 'pr.bookFamily' : 'pr.familyTitle', family);
}

const today = () => {
  const d = new Date();
  return longDate(`${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`);
};

/* ---------- Drawing ---------- */

function sexMark(sex) {
  if (sex === 'F') return `<circle cx="15" cy="20" r="4" fill="${C.ink}" fill-opacity=".6"/>`;
  if (sex === 'M') return `<rect x="11" y="16" width="8" height="8" fill="${C.ink}" fill-opacity=".6"/>`;
  return `<rect x="12" y="17" width="6" height="6" fill="${C.ink}" fill-opacity=".6" transform="rotate(45 15 20)"/>`;
}

/** Tree card, `w` wide (narrower in the compact layout). */
function cardSVG(n, w) {
  const p = P(n.id);
  const sosa = n.sosa ? String(n.sosa) : '';
  const inLine = S.line && n.sosa && !n.focus;
  const sosaW = sosa ? sosa.length * 6.4 + 8 : 0;
  const name = fit(given(p) || '—', `700 14px ${FONT.body}`, w - 26 - 11 - (sosa ? sosaW + 6 : 0));
  const names = cardNames(p);
  const sur = fit((names.name || t('card.noSurname')).toUpperCase(), `400 11.5px ${FONT.body}`, w - 22, 1.04);
  // Maiden name on its own line under the name; the dates at the bottom of the card
  const maidenLine = names.maiden ? fit(names.maiden, `400 11px ${FONT.body}`, w - 22, 0.6) : '';
  const datesY = CH - 12;
  // Rings before the dates, if there is room: on a narrow card, the union reads from the "×" between spouses
  const married = w >= CW && ['married', 'remarried'].includes(currentSituation(n.id));
  const dx = married ? 24 : 0;
  const dates = fit(cardDates(p) || t('card.noDates'), `400 11.5px ${FONT.mono}`, w - 22 - dx);
  return `<g transform="translate(${n.x},${n.y})">`
    + `<rect x=".5" y=".5" width="${w - 1}" height="${CH - 1}" rx="6" fill="${n.focus ? C.focus : C.card}"`
    + ` stroke="${n.focus ? C.accent : inLine ? C.halo : C[p.sex] || C.line}" stroke-width="${n.focus ? 2 : inLine ? 3 : 1.2}"/>`
    + sexMark(p.sex)
    + `<text x="26" y="25" font-family='${FONT.body}' font-size="14" font-weight="700" fill="${C.ink}">${esc(name)}</text>`
    + (sosa
      ? `<rect x="${w - 11 - sosaW}" y="12" width="${sosaW}" height="16" rx="3" fill="${C.card}" stroke="${C.line}"/>`
        + `<text x="${w - 11 - sosaW / 2}" y="24" text-anchor="middle" font-family='${FONT.mono}' font-size="10.5" fill="${C.muted}">${sosa}</text>`
      : '')
    + `<text x="11" y="44" font-family='${FONT.body}' font-size="11.5" letter-spacing="1.04" fill="${C.ink}">${esc(sur)}</text>`
    + (maidenLine ? `<text x="11" y="59" font-family='${FONT.body}' font-size="11" letter-spacing="0.6" fill="${C.muted}">${esc(maidenLine)}</text>` : '')
    + (married ? `<path d="${RINGS_PATH}" transform="translate(11,${datesY - 10})" fill="none" stroke="${C.muted}" stroke-width="1.5"/>` : '')
    + `<text x="${11 + dx}" y="${datesY}" font-family='${FONT.mono}' font-size="11.5" fill="${C.muted}">${esc(dates)}</text>`
    + '</g>';
}

const FAN_COLORS = {
  text: C.ink, muted: C.muted, line: C.line, empty: '#F4F6F5',
  M: '#FFFFFF', F: '#FFFFFF', U: '#FFFFFF', stroke: { M: C.M, F: C.F, U: C.line },
};

function treeSVG(L, scale) {
  const edges = L.edges.map((e) => `<path d="${e.d}"${e.dash ? ' stroke-dasharray="4 4"' : ''}/>`).join('');
  const marks = L.marks.map((m) => `<circle cx="${m.x}" cy="${m.y}" r="9" fill="${C.card}" stroke="${C.edge}"`
    + `${m.dash ? ' stroke-dasharray="3 3"' : ''}/>`
    + `<text x="${m.x}" y="${m.y}" dy="0.36em" text-anchor="middle" font-family='${FONT.mono}' font-size="12" fill="${C.muted}">×</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.W} ${L.H}" width="${L.W * scale}" height="${L.H * scale}">`
    + `<g fill="none" stroke="${C.edge}" stroke-width="1.3">${edges}</g>${marks}`
    + L.nodes.map((n) => cardSVG(n, L.cw)).join('')
    + '</svg>';
}

/* ---------- Dialog ---------- */

const generationCount = (L) => L.gens;

/** Chosen content: 'tree', 'fan', 'book' (booklet) or 'fullbook' (full book by branch). */
const printContent = () => $('#prContent').value;
const isBook = (content) => content === 'book' || content === 'fullbook';

/** Whole tree, in the chosen layout: redone only when it changes. */
function treeLayout() {
  const compact = $('#prLayout').value === 'compact';
  if (!layout || layout.compact !== compact) layout = { ...buildFullLayout({ compact }), compact };
  return layout;
}

/** Fills the tiling list in the chosen language, keeping the choice. */
function fillTiles() {
  const select = $('#prTiles');
  const value = select.value || 'auto';
  select.innerHTML = `<option value="auto">${esc(t('pr.autoSheets'))}</option>`
    + TILE_CHOICES.map((n) => `<option value="${n}">${esc(n === 1 ? t('pr.oneSheet') : t('pr.sheetsWide', n))}</option>`).join('');
  select.value = value;
}

/** Sheet grid chosen for a W × H drawing, or null for a single sheet. */
function gridFor({ W, H }) {
  const paper = PAPER[$('#prFormat').value];
  const orient = $('#prOrient').value;
  if ($('#prTiles').value === 'auto') return autoGrid(W, H, paper, MARGIN, orient, READABLE[printContent()]);
  const cols = +$('#prTiles').value;
  return cols > 1 ? bestGrid(W, H, paper, MARGIN, cols, orient) : null;
}

/** Information text about a grid. */
const gridInfo = (grid) => t('pr.tileInfo', grid.cols, grid.rows, $('#prFormat').value, grid.orient === 'landscape',
  t('decimal', (14 * grid.mm).toFixed(1)), OVERLAP);

/**
 * The sheet's @page rule. Firefox would lay out at this size without shrinking if its paper
 * is different, and would cut the right side: here, the drawing follows the paper chosen in its dialog.
 */
const sheetRule = (w, h) => (navigator.userAgent.includes('Firefox/') ? `@page { margin: ${MARGIN}mm; }` : pageRule(w, h, MARGIN));

/** Height on the planned sheet, without exceeding the real paper: the browser may impose another. */
const fitHeight = (mm) => `min(${mm}mm, calc(100vh - 1mm))`;

/** Mini-map of the assembly in the sheet footer: the current sheet is filled. */
function locator(grid, tile) {
  const cell = Math.min(3.2, (FOOT - 1.5) / grid.rows);
  const rects = grid.tiles.map((x) => `<rect x="${x.col * cell}" y="${x.row * cell}" width="${cell}" height="${cell}"`
    + ` fill="${x === tile ? C.accent : '#fff'}" stroke="${C.muted}" stroke-width=".15"/>`).join('');
  return `<svg class="tile-map" width="${grid.cols * cell}mm" height="${grid.rows * cell}mm" viewBox="-.1 -.1 ${grid.cols * cell + 0.2} ${grid.rows * cell + 0.2}">${rects}</svg>`;
}

/** One sheet of the grid: a window onto the drawing, with its assembly marks. */
function tileHTML(grid, tile, drawing, title) {
  const { w, h, mm } = grid;
  const vw = w / mm;
  const vh = h / mm;
  const band = OVERLAP / mm;
  const next = neighbours(grid, tile);
  const x = tile.x + vw - band;   // edge where the right-hand sheet goes
  const y = tile.y + vh - band;   // edge where the sheet below goes
  const stroke = `stroke="${C.muted}" stroke-width="${0.2 / mm}" stroke-dasharray="${2 / mm} ${1.5 / mm}"`;
  const label = (lx, ly, text, angle) => `<text x="${lx}" y="${ly}" transform="rotate(${angle} ${lx} ${ly})" text-anchor="middle" dominant-baseline="middle"`
    + ` font-family='${FONT.body}' font-size="${3 / mm}" font-weight="700" fill="${C.muted}" stroke="#fff" stroke-width="${0.8 / mm}" paint-order="stroke">${esc(text)}</text>`;
  // Overlap area: greyed, with the code of the sheet to place on it
  const marks = (next.right ? `<rect x="${x}" y="${tile.y}" width="${band}" height="${vh}" fill="${C.muted}" fill-opacity=".1"/>`
      + `<path d="M${x},${tile.y}V${tile.y + vh}" fill="none" ${stroke}/>`
      + label(x + band / 2, tile.y + vh / 2, t('pr.tileGlue', next.right), 90) : '')
    + (next.down ? `<rect x="${tile.x}" y="${y}" width="${vw}" height="${band}" fill="${C.muted}" fill-opacity=".1"/>`
      + `<path d="M${tile.x},${y}H${tile.x + vw}" fill="none" ${stroke}/>`
      + label(tile.x + vw / 2, y + band / 2, t('pr.tileGlue', next.down), 0) : '');
  const arrows = [['←', next.left], ['↑', next.up], ['↓', next.down], ['→', next.right]]
    .filter(([, code]) => code).map(([sym, code]) => `${sym} ${code}`).join('   ');
  return `<section class="tile" data-style="height:${fitHeight(h + FOOT - 1)}">`
    + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${tile.x} ${tile.y} ${vw} ${vh}" width="${w}mm" height="${h}mm">${drawing}${marks}</svg>`
    + `<div class="tile-foot" data-style="height:${FOOT - 1}mm"><b>${sheetCode(tile.row, tile.col)}</b>${locator(grid, tile)}`
    + `<span class="tile-next">${esc(arrows)}</span><span class="tile-title">${esc(title)}</span></div></section>`;
}

/** First page: the whole drawing, gridded by sheet, and the instructions. */
function planHTML(grid, drawing, { W, H }, title, legend) {
  const { w, h, mm } = grid;
  const fit = Math.min(w / W, (h - 45) / H);   // millimetres per unit on the plan
  const size = 8 / fit;
  const cells = grid.tiles.map((tile) => {
    const x = Math.min(tile.x, W);
    const y = Math.min(tile.y, H);
    const cw = Math.min(w / mm, W - x);
    const ch = Math.min(h / mm, H - y);
    return `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" fill="none" stroke="${C.accent}" stroke-width="${0.35 / fit}"/>`
      + `<text x="${x + cw / 2}" y="${y + ch / 2}" text-anchor="middle" dominant-baseline="middle" font-family='${FONT.body}' font-weight="700"`
      + ` font-size="${size}" fill="${C.accent}" stroke="#fff" stroke-width="${1.2 / fit}" paint-order="stroke">${sheetCode(tile.row, tile.col)}</text>`;
  }).join('');
  const last = sheetCode(grid.rows - 1, grid.cols - 1);
  return `<section class="tile tile-plan" data-style="height:${fitHeight(h + FOOT - 1)}"><h1>${esc(t('pr.planTitle'))}</h1><p class="plan-sub">${esc(title)}</p>`
    + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * fit}mm" height="${H * fit}mm">${drawing}${cells}</svg>`
    + `<ol><li>${esc(t('pr.planStep1', last))}</li><li>${esc(t('pr.planStep2'))}</li><li>${esc(t('pr.planStep3'))}</li></ol>`
    + `<p class="plan-sub">${esc(legend)}</p></section>`;
}

export function updatePrintInfo() {
  const info = $('#printInfo');
  const field = $('#prTitleText');
  if (field.value === shownTitle) field.value = defaultTitle();
  shownTitle = defaultTitle();
  if (layout) treeLayout();
  if (!layout) {
    info.textContent = t('pr.empty');
    return;
  }
  const content = printContent();
  fillTiles();
  $('#prPaper').hidden = isBook(content);
  $('#prTilesRow').hidden = isBook(content);
  $('#prLayoutRow').hidden = content !== 'tree';
  $('#prPaperHint').hidden = isBook(content);
  if (isBook(content)) {
    info.textContent = content === 'book' ? t('pr.bookInfo', S.people.size) : t('bb.info');
    return;
  }
  if (content === 'fan') {
    const fan = fanSize();
    const grid = gridFor(fan);
    const page = pageFor($('#prFormat').value, $('#prOrient').value, fan);
    info.textContent = grid ? gridInfo(grid) : t('pr.fanInfo', fan.gens, page.orient === 'landscape');
    return;
  }
  const treeGrid = gridFor(layout);
  if (treeGrid) {
    info.textContent = gridInfo(treeGrid);
    return;
  }
  const format = $('#prFormat').value;
  const page = pageFor(format, $('#prOrient').value, layout);
  const pct = Math.round(page.scale * 100);
  const textMm = t('decimal', (14 * page.scale / MM).toFixed(1));
  const n = S.people.size;
  let text = t('pr.info', n, generationCount(layout), page.orient === 'landscape', pct, textMm);
  if (page.scale < SMALL_SCALE) {
    const better = betterFormat(format, $('#prOrient').value, layout);
    text += better ? t('pr.smallFormat', better) : t('pr.small');
  }
  info.textContent = text;
}

export function openPrint() {
  layout = null;
  if (S.people.size) treeLayout();
  $('#printDlg').hidden = false;
  fillTiles();
  shownTitle = defaultTitle();
  $('#prTitleText').value = customTitle || shownTitle;
  updatePrintInfo();
  setTimeout(() => {
    const close = $('#printDlg .icon-btn');
    if (close) close.focus();
  }, 20);
}

export function closePrint() {
  $('#printDlg').hidden = true;
}

/** Prepares the sheet (page, title, tree) then opens the browser's print dialog. */
export async function printTree() {
  if (!layout) return;
  treeLayout();
  const title = $('#prTitleText').value.trim();
  customTitle = title === defaultTitle() ? '' : title;
  const content = printContent();
  const fan = content === 'fan' ? fanSize() : null;
  const page = pageFor($('#prFormat').value, $('#prOrient').value, fan || layout);
  const grid = isBook(content) ? null : gridFor(fan || layout);

  let style = $('#printPageStyle');
  if (!style) {
    style = document.createElement('style');
    style.id = 'printPageStyle';
    document.head.appendChild(style);
  }
  style.textContent = isBook(content)
    ? pageRule(210, 297, 0) // the margins are in the booklet pages
    : grid ? sheetRule(grid.pageW, grid.pageH) : sheetRule(page.w, page.h);

  const focus = P(S.focus);
  const legend = [
    t('pr.people', S.people.size),
    t('pr.gens', generationCount(layout)),
    t('pr.legend'),
    focus ? t('pr.sosaFrom', fullName(focus)) : '',
    t('pr.printed', today()),
  ].filter(Boolean).join('  ·  ');

  const area = $('#printArea');
  area.classList.toggle('book', isBook(content));
  area.classList.toggle('tiles', !!grid);
  if (grid) {
    area.style.width = `min(${grid.w}mm, 100%)`;
    area.style.height = '';
    const { W, H } = fan || layout;
    const drawing = `<svg x="0" y="0" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
      + (fan ? fanSVG(FAN_COLORS, 1) : treeSVG(layout, 1)) + '</svg>';
    setHTML(area, planHTML(grid, drawing, fan || layout, title, legend)
      + grid.tiles.map((tile) => tileHTML(grid, tile, drawing, title)).join(''));
  } else if (isBook(content)) {
    area.style.width = '';
    area.style.height = '';
    area.innerHTML = await (content === 'book' ? bookletHTML(title) : fullBookHTML(title));
  } else {
    area.style.width = `min(${page.w - 2 * MARGIN - 1}mm, 100%)`;
    area.style.height = fitHeight(page.h - 2 * MARGIN - 1);
    setHTML(area, `<header data-style="height:${HEAD}mm"><h1>${esc(title)}</h1><p>${esc(legend)}</p></header>`
      + `<div class="print-tree">${fan ? fanSVG(FAN_COLORS, page.scale) : treeSVG(layout, page.scale)}</div>`);
  }

  closePrint();
  launchPrint(title);
}

/** Opens printing on the prepared sheet, and clears it afterwards. `name` gives the suggested PDF name. */
function launchPrint(name) {
  const area = $('#printArea');
  const before = document.title;
  document.title = name;
  window.addEventListener('afterprint', () => {
    area.innerHTML = '';
    document.title = before;
  }, { once: true });
  try {
    window.print();
  } catch (e) {
    area.innerHTML = '';
    document.title = before;
    toast(t('pr.unavailable'), true);
  }
}

/** A person's family booklet: their unions and direct children, on A4 pages. */
export async function printFamilyBook(id) {
  if (!P(id)) return;
  let style = $('#printPageStyle');
  if (!style) {
    style = document.createElement('style');
    style.id = 'printPageStyle';
    document.head.appendChild(style);
  }
  style.textContent = pageRule(210, 297, 0);
  const area = $('#printArea');
  area.classList.add('book');
  area.classList.remove('tiles');
  area.style.width = '';
  area.style.height = '';
  area.innerHTML = await familyBookHTML(id);
  const family = familyBookName(id);
  launchPrint(t('pr.bookKicker') + ' ' + (family || fullName(P(id))));
}
