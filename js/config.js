/**
 * Application constants: tree dimensions, zoom, date formats,
 * browser storage keys.
 */

// Tree dimensions, in pixels (CW and CH must match .card in tree.css)
export const CW = 176;  // card width
export const CH = 88;   // card height
export const HG = 18;   // horizontal gap between two neighbouring cards
export const VG = 58;   // vertical gap between two generations
export const SG = 32;   // gap between two spouses
export const PAD = 48;  // margin around the tree

// Available zoom levels
export const ZOOMS = [0.55, 0.7, 0.85, 1, 1.15, 1.3, 1.6, 2, 2.5, 3];

// Colour themes (css/tokens.css); "auto" follows the system, "season" changes with the date
export const THEMES = ['auto', 'season', 'light', 'dark', 'noel', 'halloween', 'printemps', 'ete', 'automne', 'maraudeur', 'constellations', 'porcelaine', 'matrix', 'grandline', 'galaxie', 'daltonisme', 'contraste', 'contraste-sombre'];
// Interface text size (data-text attribute on <html>, css/base.css); the tree has its own zoom
export const TEXT_SIZES = ['normal', 'large', 'xlarge'];

// GEDCOM months (import/export); displayed months are in i18n.js
export const GM = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Browser local storage keys
export const PREF_KEY = 'lignee.view.v1';   // display preferences
export const TREES_KEY = 'lignee.trees.v1'; // list of trees in local mode
export const TREE_KEY = 'lignee.tree.';     // + id: data of a tree in local mode
export const LANG_KEY = 'lignee.lang.v1';   // interface language: 'fr' or 'en'
export const REPO_KEY = 'lignee.repo.v1';   // repository linked to each tree, without the token
export const GEO_KEY = 'lignee.geo.v1';     // coordinates of places already located
export const INSEE_KEY = 'lignee.insee.v1'; // INSEE death records found for each record
export const DUP_KEY = 'lignee.dups.v1';     // "Not a duplicate" pairs, per tree
export const EXPORT_KEY = 'lignee.exported.v1'; // time of each tree's last export
export const EXPORT_STALE = 30;               // days after which the local banner reminds to export
export const BANNER_SNOOZE = 7;               // days the local banner stays closed

// Starting tree (and tree of the data created before multiple trees were supported);
// its default name is t('ts.default')
export const DEFAULT_TREE = 'principal';
export const EXAMPLE_FILE = 'data/arbres/exemple-famille-bertrand.json'; // family loaded on the first visit

/**
 * A sheet's @page rule, in millimetres: Chrome doesn't know the A2 keyword,
 * ignores the whole rule and cuts the sheet to its default size.
 */
export const pageRule = (w, h, margin) => `@page { size: ${w}mm ${h}mm; margin: ${margin}mm; }`;

// System preferences
export const reduced = window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;
export const narrow = () => (window.matchMedia ? window.matchMedia('(max-width: 900px)').matches : false);

/** Two interlaced rings (married person), in a 20 × 12 box. */
export const RINGS_PATH = 'M8.86 10.64A5 5 0 1 1 10.93 9.09M11.14 1.36A5 5 0 1 1 9.07 2.91';
