/**
 * Shared application state.
 * A single object S, read and modified by the other modules.
 */
import { ZOOMS, THEMES, TEXT_SIZES, TREE_FILTERS, PREF_KEY, DEFAULT_TREE } from './config.js';

export const S = {
  mode: 'loading',       // 'loading' | 'db' (online database) | 'file' (data/arbres/) | 'local' (browser)
  tree: DEFAULT_TREE,    // id of the open tree
  trees: new Map(),      // id -> { name, count, createdAt }: every tree in the collection
  loadedT: false,        // tree list received from the database
  treeEdit: null,        // "My trees" dialog: { id, kind: 'rename' | 'delete' } or null
  people: new Map(),     // id -> person
  unions: new Map(),     // id -> union { a, b, date, place }
  loadedP: false,        // people received from the database
  loadedU: false,        // unions received from the database

  focus: null,           // id of the person at the centre of the tree
  foci: {},              // tree id -> focus person, restored when coming back to the tree
  up: 3,                 // generations of ancestors shown
  down: 2,               // generations of descendants shown
  zoom: 1,
  full: false,           // whole tree, flat (otherwise a view centred on the person)
  fan: false,            // fan chart instead of the tree
  line: true,            // halo on the focus person's direct line
  filter: '',            // tree filter: '' | 'living' | 'certificate' (other cards faded)
  panel: true,           // record/register panel shown
  sheet: false,          // phone: record/register panel open over the tree
  closed: {},            // closed banners: ex (example family), local (local mode)
  theme: 'auto',         // colour theme: see THEMES in config.js
  textSize: 'normal',    // interface text size: see TEXT_SIZES in config.js
  tab: 'record',          // panel tab: 'record' | 'register' | 'analysis'
  analysis: 'kin',       // Analysis tab view: see VIEWS in ui/analysis.js
  timeFamily: false,     // timeline: the close family rather than the person alone
  calMonth: null,        // month shown in the anniversaries (1 to 12), null = current month
  kinA: '',              // people compared in the kinship view
  kinB: '',
  kinShow: false,        // kinship path highlighted in the tree
  kinWasFull: false,     // tree view to restore when removing the highlight
  popup: null,           // id of the person whose record is open in a dialog, or null

  edit: null,            // draft of the form being edited, or null
  confirmDel: false,     // delete confirmation shown
  repoLink: null,        // GitHub repository linked to a tree; never stored, the token stays in memory
  repoConfirm: false,    // confirmation of the save to the repository shown
  repoConflicts: null,   // names of the records changed on both sides, waiting for a choice
  repoError: '',         // last save failed
  repoSavedAt: '',       // time of the last save
  confirmEx: false,      // confirmation of removing the examples shown
  query: '',             // register search

  canWrite: true,        // the user can edit the tree
  writeKnown: false,     // write permission confirmed by the platform
  busy: false,           // save in progress
  pending: null,         // import read, waiting for confirmation

  scrollPending: true,   // recentre the tree on the next render
  lastLayout: null,      // last computed layout
  firstScroll: true,
};

/** Indexes recomputed on every change: children and spouses of each person. */
export const idx = {
  children: new Map(),   // parent id -> [child ids]
  partners: new Map(),   // id -> Map(spouse id -> union id | null)
};

/** DOM elements of the tree cards, reused from one render to the next. */
export const cardEls = new Map();

/** Services provided by claude.ai when the application is published there (otherwise null). */
export const services = {
  db: null,
  downloads: null,
};

export const isLoading = () => S.mode === 'loading' || (S.mode === 'db' && (!S.loadedP || !S.loadedT));

/** Name of the open tree. */
export const treeName = () => (S.trees.get(S.tree) || {}).name || '';

export function loadPrefs() {
  try {
    const v = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    if (Number.isInteger(v.up) && v.up >= 0) S.up = v.up;
    if (Number.isInteger(v.down) && v.down >= 0) S.down = v.down;
    if (ZOOMS.includes(v.zoom)) S.zoom = v.zoom;
    if (typeof v.tree === 'string') S.tree = v.tree;
    if (v.foci && typeof v.foci === 'object') S.foci = v.foci;
    if (typeof S.foci[S.tree] === 'string') S.focus = S.foci[S.tree];
    S.full = v.full === true;
    S.fan = v.fan === true;
    S.line = v.line !== false;
    S.filter = TREE_FILTERS.includes(v.filter) ? v.filter : '';
    S.panel = v.panel !== false;
    if (v.closed && typeof v.closed === 'object') S.closed = v.closed;
    if (THEMES.includes(v.theme)) S.theme = v.theme;
    if (TEXT_SIZES.includes(v.textSize)) S.textSize = v.textSize;
  } catch (e) {
    /* storage unavailable: the defaults are kept */
  }
}

export function savePrefs() {
  try {
    if (S.focus) S.foci[S.tree] = S.focus;
    else delete S.foci[S.tree];
    localStorage.setItem(PREF_KEY, JSON.stringify({ up: S.up, down: S.down, zoom: S.zoom, full: S.full, fan: S.fan, line: S.line, filter: S.filter, panel: S.panel, closed: S.closed, tree: S.tree, foci: S.foci, theme: S.theme, textSize: S.textSize }));
  } catch (e) {
    /* storage unavailable: preferences not remembered */
  }
}
