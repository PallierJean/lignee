/**
 * User actions, called by events.js (data-act attributes):
 * - actions/view.js: focus person, tabs, generations, zoom, panel, theme, language, undo / redo;
 * - actions/edit.js: the form, saving, deleting, the example family;
 * - actions/analysis.js: kinship, timeline, duplicates, places, INSEE deaths.
 */
export * from './actions/view.js';
export * from './actions/edit.js';
export * from './actions/analysis.js';
