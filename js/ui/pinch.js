/**
 * Two-finger pinch on the tree canvas: each time the fingers spread or close by a quarter,
 * the tree zooms in or out one step (the zoom levels of the − and + buttons).
 */
import { zoomBy } from '../actions.js';

const STEP = 1.25; // spread ratio for one zoom step

const touches = new Map(); // pointerId -> { x, y }
let base = 0;              // distance between the two fingers at the last step

const spread = () => {
  const [a, b] = [...touches.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
};

/** Pointer events on the page: only touches on the tree canvas count. */
export function pinch(ev) {
  if (ev.pointerType !== 'touch') return;
  if (ev.type === 'pointerdown') {
    if (!ev.target.closest || !ev.target.closest('#canvas') || ev.target.closest('.fan-nav')) return;
    touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    base = touches.size === 2 ? spread() : 0;
    return;
  }
  if (!touches.has(ev.pointerId)) return;
  if (ev.type !== 'pointermove') {
    touches.delete(ev.pointerId);
    base = 0;
    return;
  }
  touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  if (touches.size !== 2 || !base) return;
  const ratio = spread() / base;
  if (ratio > STEP || ratio < 1 / STEP) {
    zoomBy(ratio > 1 ? 1 : -1);
    base = spread();
  }
}
