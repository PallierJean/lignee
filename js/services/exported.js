/**
 * When each tree was last saved outside this browser (GEDCOM, Lignée backup or GitHub),
 * kept in this browser: { [tree]: timestamp }. In local mode, the banner reminds
 * the user to export when this is missing or old.
 */
import { EXPORT_KEY } from '../config.js';
import { S } from '../state.js';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(EXPORT_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}

/** Time of the open tree's last export, or 0 if it was never exported. */
export const lastExport = () => readAll()[S.tree] || 0;

/** Records that the open tree has just been saved outside the browser. */
export function markExported(when = Date.now()) {
  const all = readAll();
  all[S.tree] = when;
  try {
    localStorage.setItem(EXPORT_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage full or refused: the reminder will show again */
  }
}
