/** Short message at the bottom of the screen (confirmation or error). */
import { $ } from '../utils/dom.js';
import { t } from '../i18n.js';

let timer;

export function toast(message, isError = false) {
  const el = $('#toast');
  el.textContent = message;
  el.className = 'toast' + (isError ? ' bad' : '');
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => { el.hidden = true; }, isError ? 5200 : 2400);
}

/**
 * Shows a failed action: the storage already explained its own errors; anything else
 * (a bug) gets a generic message and goes to the console instead of failing silently.
 */
export function reportError(e) {
  if (e && e.reported) return;
  console.error(e);
  toast(t('err.unexpected'), true);
}
