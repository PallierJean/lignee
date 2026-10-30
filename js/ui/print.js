/**
 * Impression de l'arbre complet ou de la roue d'ascendance, sur une feuille ou
 * découpés sur plusieurs feuilles à assembler, et du livret de famille.
 *
 * L'arbre est redessiné en SVG (traits et texte vectoriels, couleurs claires fixes),
 * mis à l'échelle de la page, puis imprimé par le navigateur. « Enregistrer au format PDF »
 * dans la fenêtre d'impression donne un PDF au bon format, grâce à la règle @page.
 */
import { CW, CH, RINGS_PATH, pageRule } from '../config.js';
import { S } from '../state.js';
import { $, esc } from '../utils/dom.js';
import { longDate } from '../utils/dates.js';
import { P, given, surname, surnameLine, cardDates, fullName, parentsName, currentSituation } from '../model/people.js';
import { buildFullLayout } from '../tree/full-layout.js';
import { fanSVG, fanSize } from '../tree/fan.js';
import { bestGrid, autoGrid, sheetCode, neighbours, OVERLAP, FOOT } from '../tree/tiles.js';
import { bookletHTML, familyBookHTML } from './booklet.js';
import { familyBookName } from '../model/family-book.js';
import { toast } from './toast.js';
import { t } from '../i18n.js';

const MM = 96 / 25.4;                          // pixels CSS par millimètre
const PAPER = { A4: [210, 297], A3: [297, 420], A2: [420, 594] };
const TILE_CHOICES = [1, 2, 3, 4, 5, 6, 8, 10];  // feuilles de large proposées

// Découpage automatique : millimètres par unité du dessin visés pour rester lisible
const READABLE = { tree: 2.5 / 14, fan: 2 / 8 };  // prénoms de 2,5 mm, plus petit texte de la roue de 2 mm
const MARGIN = 10;                             // marge de la feuille, en mm
const HEAD = 16;                               // titre et légende, en mm
const MAX_SCALE = 1.6;                         // agrandissement maximal d'un petit arbre

// Couleurs fixes : la feuille est toujours claire, quel que soit le thème de l'écran
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
let shownTitle = '';   // titre calculé affiché dans le champ : il suit le contenu choisi
let layout = null;

/* ---------- Mesures ---------- */

/** Feuille retenue : orientation, dimensions (mm) et échelle de l'arbre. */
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

const ctx = document.createElement('canvas').getContext('2d');

/** Coupe le texte avec « … » s'il dépasse `max` pixels. */
function fit(text, font, max, spacing = 0) {
  ctx.font = font;
  const width = (t) => ctx.measureText(t).width + spacing * t.length;
  if (width(text) <= max) return text;
  let t = text;
  while (t.length > 1 && width(t + '…') > max) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}

/** Nom de famille le plus fréquent, ou vide. */
function topSurname() {
  const count = new Map();
  for (const p of S.people.values()) {
    const s = surname(p);
    if (s) count.set(s, (count.get(s) || 0) + 1);
  }
  const top = [...count].sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : '';
}

/** Titre calculé : le père et la mère de la personne centrale, à défaut le nom le plus fréquent. */
function defaultTitle() {
  const family = parentsName(S.focus) || topSurname();
  if (!family) return t('pr.defaultTitle');
  return t(printContent() === 'book' ? 'pr.bookFamily' : 'pr.familyTitle', family);
}

const today = () => {
  const d = new Date();
  return longDate(`${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`);
};

/* ---------- Dessin ---------- */

function sexMark(sex) {
  if (sex === 'F') return `<circle cx="15" cy="20" r="4" fill="${C.ink}" fill-opacity=".6"/>`;
  if (sex === 'M') return `<rect x="11" y="16" width="8" height="8" fill="${C.ink}" fill-opacity=".6"/>`;
  return `<rect x="12" y="17" width="6" height="6" fill="${C.ink}" fill-opacity=".6" transform="rotate(45 15 20)"/>`;
}

function cardSVG(n) {
  const p = P(n.id);
  const sosa = n.sosa ? String(n.sosa) : '';
  const inLine = S.line && n.sosa && !n.focus;
  const sosaW = sosa ? sosa.length * 6.4 + 8 : 0;
  const name = fit(given(p) || '—', `700 14px ${FONT.body}`, CW - 26 - 11 - (sosa ? sosaW + 6 : 0));
  const sur = fit((surnameLine(p) || t('card.noSurname')).toUpperCase(), `400 11.5px ${FONT.body}`, CW - 22, 1.04);
  const married = ['married', 'remarried'].includes(currentSituation(n.id));
  const dx = married ? 24 : 0; // place des anneaux devant les dates
  const dates = fit(cardDates(p) || t('card.noDates'), `400 11.5px ${FONT.mono}`, CW - 22 - dx);
  return `<g transform="translate(${n.x},${n.y})">`
    + `<rect x=".5" y=".5" width="${CW - 1}" height="${CH - 1}" rx="6" fill="${n.focus ? C.focus : C.card}"`
    + ` stroke="${n.focus ? C.accent : inLine ? C.halo : C[p.sex] || C.line}" stroke-width="${n.focus ? 2 : inLine ? 3 : 1.2}"/>`
    + sexMark(p.sex)
    + `<text x="26" y="25" font-family='${FONT.body}' font-size="14" font-weight="700" fill="${C.ink}">${esc(name)}</text>`
    + (sosa
      ? `<rect x="${CW - 11 - sosaW}" y="12" width="${sosaW}" height="16" rx="3" fill="${C.card}" stroke="${C.line}"/>`
        + `<text x="${CW - 11 - sosaW / 2}" y="24" text-anchor="middle" font-family='${FONT.mono}' font-size="10.5" fill="${C.muted}">${sosa}</text>`
      : '')
    + `<text x="11" y="44" font-family='${FONT.body}' font-size="11.5" letter-spacing="1.04" fill="${C.ink}">${esc(sur)}</text>`
    + (married ? `<path d="${RINGS_PATH}" transform="translate(11,56)" fill="none" stroke="${C.muted}" stroke-width="1.5"/>` : '')
    + `<text x="${11 + dx}" y="66" font-family='${FONT.mono}' font-size="11.5" fill="${C.muted}">${esc(dates)}</text>`
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
    + L.nodes.map(cardSVG).join('')
    + '</svg>';
}

/* ---------- Fenêtre ---------- */

const generationCount = (L) => new Set(L.nodes.map((n) => n.y)).size;

/** Contenu choisi : 'tree', 'fan' ou 'book'. */
const printContent = () => $('#prContent').value;

/** Remplit la liste du découpage dans la langue choisie, sans perdre le choix. */
function fillTiles() {
  const select = $('#prTiles');
  const value = select.value || 'auto';
  select.innerHTML = `<option value="auto">${esc(t('pr.autoSheets'))}</option>`
    + TILE_CHOICES.map((n) => `<option value="${n}">${esc(n === 1 ? t('pr.oneSheet') : t('pr.sheetsWide', n))}</option>`).join('');
  select.value = value;
}

/** Grille de feuilles retenue pour le dessin de dimensions W × H, ou null pour une seule feuille. */
function gridFor({ W, H }) {
  const paper = PAPER[$('#prFormat').value];
  const orient = $('#prOrient').value;
  if ($('#prTiles').value === 'auto') return autoGrid(W, H, paper, MARGIN, orient, READABLE[printContent()]);
  const cols = +$('#prTiles').value;
  return cols > 1 ? bestGrid(W, H, paper, MARGIN, cols, orient) : null;
}

/** Texte d'information sur une grille. */
const gridInfo = (grid) => t('pr.tileInfo', grid.cols, grid.rows, $('#prFormat').value, grid.orient === 'landscape',
  t('decimal', (14 * grid.mm).toFixed(1)), OVERLAP);

/** Mini-carte de l'assemblage dans le pied de feuille : la feuille en cours est remplie. */
function locator(grid, tile) {
  const cell = Math.min(3.2, (FOOT - 1.5) / grid.rows);
  const rects = grid.tiles.map((x) => `<rect x="${x.col * cell}" y="${x.row * cell}" width="${cell}" height="${cell}"`
    + ` fill="${x === tile ? C.accent : '#fff'}" stroke="${C.muted}" stroke-width=".15"/>`).join('');
  return `<svg class="tile-map" width="${grid.cols * cell}mm" height="${grid.rows * cell}mm" viewBox="-.1 -.1 ${grid.cols * cell + 0.2} ${grid.rows * cell + 0.2}">${rects}</svg>`;
}

/** Une feuille de la grille : une fenêtre sur le dessin, avec ses repères d'assemblage. */
function tileHTML(grid, tile, drawing, title) {
  const { w, h, mm } = grid;
  const vw = w / mm;
  const vh = h / mm;
  const band = OVERLAP / mm;
  const next = neighbours(grid, tile);
  const x = tile.x + vw - band;   // bord où se pose la feuille de droite
  const y = tile.y + vh - band;   // bord où se pose la feuille du dessous
  const stroke = `stroke="${C.muted}" stroke-width="${0.2 / mm}" stroke-dasharray="${2 / mm} ${1.5 / mm}"`;
  const label = (lx, ly, text, angle) => `<text x="${lx}" y="${ly}" transform="rotate(${angle} ${lx} ${ly})" text-anchor="middle" dominant-baseline="middle"`
    + ` font-family='${FONT.body}' font-size="${3 / mm}" font-weight="700" fill="${C.muted}" stroke="#fff" stroke-width="${0.8 / mm}" paint-order="stroke">${esc(text)}</text>`;
  // Zone de recouvrement : grisée, avec le code de la feuille à y poser
  const marks = (next.right ? `<rect x="${x}" y="${tile.y}" width="${band}" height="${vh}" fill="${C.muted}" fill-opacity=".1"/>`
      + `<path d="M${x},${tile.y}V${tile.y + vh}" fill="none" ${stroke}/>`
      + label(x + band / 2, tile.y + vh / 2, t('pr.tileGlue', next.right), 90) : '')
    + (next.down ? `<rect x="${tile.x}" y="${y}" width="${vw}" height="${band}" fill="${C.muted}" fill-opacity=".1"/>`
      + `<path d="M${tile.x},${y}H${tile.x + vw}" fill="none" ${stroke}/>`
      + label(tile.x + vw / 2, y + band / 2, t('pr.tileGlue', next.down), 0) : '');
  const arrows = [['←', next.left], ['↑', next.up], ['↓', next.down], ['→', next.right]]
    .filter(([, code]) => code).map(([sym, code]) => `${sym} ${code}`).join('   ');
  return `<section class="tile" style="height:${h + FOOT - 1}mm">`
    + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${tile.x} ${tile.y} ${vw} ${vh}" width="${w}mm" height="${h}mm">${drawing}${marks}</svg>`
    + `<div class="tile-foot" style="height:${FOOT - 1}mm"><b>${sheetCode(tile.row, tile.col)}</b>${locator(grid, tile)}`
    + `<span class="tile-next">${esc(arrows)}</span><span class="tile-title">${esc(title)}</span></div></section>`;
}

/** Première page : le dessin entier, quadrillé par feuille, et la marche à suivre. */
function planHTML(grid, drawing, { W, H }, title, legend) {
  const { w, h, mm } = grid;
  const fit = Math.min(w / W, (h - 45) / H);   // millimètres par unité sur le plan
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
  return `<section class="tile tile-plan" style="height:${h + FOOT - 1}mm"><h1>${esc(t('pr.planTitle'))}</h1><p class="plan-sub">${esc(title)}</p>`
    + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * fit}mm" height="${H * fit}mm">${drawing}${cells}</svg>`
    + `<ol><li>${esc(t('pr.planStep1', last))}</li><li>${esc(t('pr.planStep2'))}</li><li>${esc(t('pr.planStep3'))}</li></ol>`
    + `<p class="plan-sub">${esc(legend)}</p></section>`;
}

export function updatePrintInfo() {
  const info = $('#printInfo');
  const field = $('#prTitleText');
  if (field.value === shownTitle) field.value = defaultTitle();
  shownTitle = defaultTitle();
  if (!layout) {
    info.textContent = t('pr.empty');
    return;
  }
  const content = printContent();
  fillTiles();
  $('#prPaper').hidden = content === 'book';
  $('#prTilesRow').hidden = content === 'book';
  if (content === 'book') {
    info.textContent = t('pr.bookInfo', S.people.size);
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
  if (page.scale < 0.45) text += t(format === 'A3' ? 'pr.smallA3' : 'pr.small');
  info.textContent = text;
}

export function openPrint() {
  layout = S.people.size ? buildFullLayout() : null;
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

/** Prépare la feuille (page, titre, arbre) puis ouvre la fenêtre d'impression du navigateur. */
export async function printTree() {
  if (!layout) return;
  const title = $('#prTitleText').value.trim();
  customTitle = title === defaultTitle() ? '' : title;
  const content = printContent();
  const fan = content === 'fan' ? fanSize() : null;
  const page = pageFor($('#prFormat').value, $('#prOrient').value, fan || layout);
  const grid = content === 'book' ? null : gridFor(fan || layout);

  let style = $('#printPageStyle');
  if (!style) {
    style = document.createElement('style');
    style.id = 'printPageStyle';
    document.head.appendChild(style);
  }
  style.textContent = content === 'book'
    ? pageRule(210, 297, 0) // les marges sont dans les pages du livret
    : grid ? pageRule(grid.pageW, grid.pageH, MARGIN) : pageRule(page.w, page.h, MARGIN);

  const focus = P(S.focus);
  const legend = [
    t('pr.people', S.people.size),
    t('pr.gens', generationCount(layout)),
    t('pr.legend'),
    focus ? t('pr.sosaFrom', fullName(focus)) : '',
    t('pr.printed', today()),
  ].filter(Boolean).join('  ·  ');

  const area = $('#printArea');
  area.classList.toggle('book', content === 'book');
  area.classList.toggle('tiles', !!grid);
  if (grid) {
    area.style.width = grid.w + 'mm';
    area.style.height = '';
    const { W, H } = fan || layout;
    const drawing = `<svg x="0" y="0" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
      + (fan ? fanSVG(FAN_COLORS, 1) : treeSVG(layout, 1)) + '</svg>';
    area.innerHTML = planHTML(grid, drawing, fan || layout, title, legend)
      + grid.tiles.map((tile) => tileHTML(grid, tile, drawing, title)).join('');
  } else if (content === 'book') {
    area.style.width = '';
    area.style.height = '';
    area.innerHTML = await bookletHTML(title);
  } else {
    area.style.width = (page.w - 2 * MARGIN - 1) + 'mm';
    area.style.height = (page.h - 2 * MARGIN - 1) + 'mm';
    area.innerHTML = `<header style="height:${HEAD}mm"><h1>${esc(title)}</h1><p>${esc(legend)}</p></header>`
      + `<div class="print-tree">${fan ? fanSVG(FAN_COLORS, page.scale) : treeSVG(layout, page.scale)}</div>`;
  }

  closePrint();
  launchPrint(title);
}

/** Ouvre l'impression sur la feuille préparée, et la vide ensuite. `name` donne le nom proposé pour le PDF. */
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

/** Livret de famille d'une personne : ses unions et ses enfants directs, sur des pages A4. */
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
