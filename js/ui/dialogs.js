/**
 * The page's dialogs in one place: which one is open, which one Escape closes first,
 * which ones close on a click on their backdrop. Escape, backdrop clicks and keyboard
 * shortcuts (not while a dialog is open) all read this list.
 */
import { $ } from '../utils/dom.js';

/**
 * Dialogs from the topmost to the lowest: Escape closes the first open one.
 * Each: { id, close (Escape), backdrop: closes on a backdrop click (true, or the function to call),
 * menu: not a dialog (doesn't block shortcuts), isOpen (optional, otherwise "not hidden") }.
 */
let dialogs = [];

export function defineDialogs(list) {
  dialogs = list;
}

const isOpen = (d) => (d.isOpen ? d.isOpen() : !$('#' + d.id).hidden);

/** True if a dialog (not a menu) is open: shortcuts then stay off. */
export const dialogOpen = () => dialogs.some((d) => !d.menu && isOpen(d));

/** Escape: closes the topmost open dialog. Returns false if none was open. */
export function closeTopDialog() {
  const d = dialogs.find(isOpen);
  if (!d) return false;
  d.close();
  return true;
}

/** Click on a dialog's backdrop (the overlay itself): that dialog closes. Returns true if handled. */
export function closeOnBackdrop(target) {
  const d = dialogs.find((x) => x.backdrop && x.id === target.id);
  if (!d || !isOpen(d)) return false;
  (typeof d.backdrop === 'function' ? d.backdrop : d.close)();
  return true;
}
