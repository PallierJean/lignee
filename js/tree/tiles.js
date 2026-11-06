/**
 * Splitting a drawing across several sheets to assemble. Neighbouring sheets
 * overlap: each one is glued on the line of the previous one. All sheet measurements
 * are in millimetres, the drawing's in its own units.
 */
export const OVERLAP = 10;   // overlap between two neighbouring sheets, in mm
export const FOOT = 7;       // sheet footer (title, number), in mm
const MAX_MM = (1.6 * 25.4) / 96; // millimetres per unit: beyond this, no further enlarging

/** Grid `cols` sheets wide: { cols, rows, total, mm, w, h, tiles: [{ col, row, x, y }] }. */
export function tileGrid(W, H, pageW, pageH, margin, cols) {
  const w = pageW - 2 * margin;
  const h = pageH - 2 * margin - FOOT;
  let mm = (cols * w - (cols - 1) * OVERLAP) / W;
  let n = cols;
  if (mm > MAX_MM) {
    mm = MAX_MM; // small drawing: no need to use all the sheets requested
    n = Math.max(1, Math.ceil((W * mm - OVERLAP) / (w - OVERLAP)));
  }
  const rows = Math.max(1, Math.ceil((H * mm - OVERLAP) / (h - OVERLAP)));
  const tiles = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < n; col++) tiles.push({ col, row, x: (col * (w - OVERLAP)) / mm, y: (row * (h - OVERLAP)) / mm });
  }
  return { cols: n, rows, total: n * rows, mm, w, h, tiles };
}

/** A sheet's code, as on a map: row as a letter, column as a digit ("B3"). */
export const sheetCode = (row, col) => String.fromCharCode(65 + row) + (col + 1);

/** Codes of the neighbouring sheets: { left, right, up, down }, empty at the edge of the assembly. */
export function neighbours(grid, { row, col }) {
  return {
    left: col > 0 ? sheetCode(row, col - 1) : '',
    right: col < grid.cols - 1 ? sheetCode(row, col + 1) : '',
    up: row > 0 ? sheetCode(row - 1, col) : '',
    down: row < grid.rows - 1 ? sheetCode(row + 1, col) : '',
  };
}

/**
 * Automatic tiling: just enough sheets for the drawing to be at least `target` millimetres
 * per unit. Returns null if a single sheet is enough.
 */
export function autoGrid(W, H, paper, margin, orient, target) {
  const o = orient !== 'auto' ? orient : W >= H ? 'landscape' : 'portrait';
  const pageW = o === 'landscape' ? paper[1] : paper[0];
  const w = pageW - 2 * margin;
  const cols = Math.max(1, Math.ceil((W * target - OVERLAP) / (w - OVERLAP)));
  const grid = bestGrid(W, H, paper, margin, cols, o);
  return grid.total > 1 ? grid : null;
}

/** Chosen grid: the requested orientation, or the one that follows the drawing's shape (larger text). */
export function bestGrid(W, H, [short, long], margin, cols, orient) {
  const make = (o) => ({ orient: o, pageW: o === 'landscape' ? long : short, pageH: o === 'landscape' ? short : long,
    ...tileGrid(W, H, o === 'landscape' ? long : short, o === 'landscape' ? short : long, margin, cols) });
  return make(orient !== 'auto' ? orient : W >= H ? 'landscape' : 'portrait');
}
