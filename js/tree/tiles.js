/**
 * Découpage d'un dessin sur plusieurs feuilles à assembler. Les feuilles voisines se
 * recouvrent : on colle chacune sur le trait de la précédente. Toutes les mesures de
 * la feuille sont en millimètres, celles du dessin dans ses propres unités.
 */
export const OVERLAP = 10;   // recouvrement entre deux feuilles voisines, en mm
export const FOOT = 7;       // pied de feuille (titre, numéro), en mm
const MAX_MM = (1.6 * 25.4) / 96; // millimètres par unité : au-delà, on n'agrandit plus

/** Grille pour `cols` feuilles de large : { cols, rows, total, mm, w, h, tiles: [{ col, row, x, y }] }. */
export function tileGrid(W, H, pageW, pageH, margin, cols) {
  const w = pageW - 2 * margin;
  const h = pageH - 2 * margin - FOOT;
  let mm = (cols * w - (cols - 1) * OVERLAP) / W;
  let n = cols;
  if (mm > MAX_MM) {
    mm = MAX_MM; // petit dessin : inutile d'utiliser toutes les feuilles demandées
    n = Math.max(1, Math.ceil((W * mm - OVERLAP) / (w - OVERLAP)));
  }
  const rows = Math.max(1, Math.ceil((H * mm - OVERLAP) / (h - OVERLAP)));
  const tiles = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < n; col++) tiles.push({ col, row, x: (col * (w - OVERLAP)) / mm, y: (row * (h - OVERLAP)) / mm });
  }
  return { cols: n, rows, total: n * rows, mm, w, h, tiles };
}

/** Code d'une feuille, comme sur une carte : ligne en lettre, colonne en chiffre (« B3 »). */
export const sheetCode = (row, col) => String.fromCharCode(65 + row) + (col + 1);

/** Codes des feuilles voisines : { left, right, up, down }, vides au bord de l'assemblage. */
export function neighbours(grid, { row, col }) {
  return {
    left: col > 0 ? sheetCode(row, col - 1) : '',
    right: col < grid.cols - 1 ? sheetCode(row, col + 1) : '',
    up: row > 0 ? sheetCode(row - 1, col) : '',
    down: row < grid.rows - 1 ? sheetCode(row + 1, col) : '',
  };
}

/**
 * Découpage automatique : juste assez de feuilles pour que le dessin soit à `target` millimètres
 * par unité au moins. Renvoie null si une seule feuille suffit.
 */
export function autoGrid(W, H, paper, margin, orient, target) {
  const o = orient !== 'auto' ? orient : W >= H ? 'landscape' : 'portrait';
  const pageW = o === 'landscape' ? paper[1] : paper[0];
  const w = pageW - 2 * margin;
  const cols = Math.max(1, Math.ceil((W * target - OVERLAP) / (w - OVERLAP)));
  const grid = bestGrid(W, H, paper, margin, cols, o);
  return grid.total > 1 ? grid : null;
}

/** Grille retenue : l'orientation demandée, ou celle qui suit la forme du dessin (texte plus grand). */
export function bestGrid(W, H, [short, long], margin, cols, orient) {
  const make = (o) => ({ orient: o, pageW: o === 'landscape' ? long : short, pageH: o === 'landscape' ? short : long,
    ...tileGrid(W, H, o === 'landscape' ? long : short, o === 'landscape' ? short : long, margin, cols) });
  return make(orient !== 'auto' ? orient : W >= H ? 'landscape' : 'portrait');
}
