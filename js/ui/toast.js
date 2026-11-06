/** Short message at the bottom of the screen (confirmation or error). */
import { $ } from '../utils/dom.js';

let timer;

export function toast(message, isError = false) {
  const el = $('#toast');
  el.textContent = message;
  el.className = 'toast' + (isError ? ' bad' : '');
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => { el.hidden = true; }, isError ? 5200 : 2400);
}
