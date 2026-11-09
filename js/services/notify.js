/**
 * What the services tell the interface, without depending on it: a message to show,
 * data received from the online database, write permission changed.
 * The interface subscribes in ui/connect.js.
 *
 * - 'message' (text, isError): short message at the bottom of the screen;
 * - 'data': documents received, the indexes and the page must follow;
 * - 'access' (force): write permission changed, the page is redrawn.
 */
import { t } from '../i18n.js';
import { markReported } from '../utils/helpers.js';

const listeners = new Map();

export function on(type, fn) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(fn);
}

export function emit(type, ...args) {
  for (const fn of listeners.get(type) || []) fn(...args);
}

/** Shows the message `key` (i18n). */
export const say = (key, isError = false) => emit('message', t(key), isError);

/** Shows the error message `key` and returns `e`, marked as already reported, to throw it. */
export function failure(key, e) {
  say(key, true);
  return markReported(e);
}
