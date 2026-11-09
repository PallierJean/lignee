/**
 * Animations of the "holidays and seasons" themes, and of Grand Line, drawn on a layer under
 * the tree: snow and a garland all around the canvas at Christmas; at Halloween, moon and clouds,
 * flickering pumpkins, mist, spider, bats and ghosts; in spring, flowering cherry
 * branches, a flowery meadow, petals, butterflies and swallows; in summer, the beach
 * (waves, foam, blurred swimmers, a small shark, gulls); in autumn, trees losing
 * their coloured leaves in gusts of wind; on Grand Line, a manga page (ink
 * lines, screentone, sound effects) where a pirate ship sails, chased by the navy firing its
 * cannons, whose rubber-armed sailor catches his straw hat; islands, gulls and a
 * sea monster. Each object has its own size, speed and sway,
 * drawn at random. Stopped outside these themes or if the system asks for reduced motion (the
 * background pattern stays), paused when the tab is hidden.
 *
 * This module runs the animation (layer, timer, frames); the scenes themselves are drawn by
 * ui/ambient/scenes.js, loaded only when an animated theme is shown.
 */
import { reduced } from '../config.js';

const FRAME = 40;   // ms between two frames

// Themes with an animation: their scenes are in ui/ambient/scenes.js, loaded on demand
const ANIMATED = ['noel', 'halloween', 'printemps', 'ete', 'grandline', 'automne'];

let scenes = null;  // the scenes, once loaded
let wanted = null;  // last theme asked for, while the scenes load
let layer = null;
let timer = null;
let scene = null;   // { name, state }

/** One frame of the current scene. */
function frame() {
  if (document.hidden) return;
  const canvas = layer.firstChild;
  const box = layer.parentElement;
  const w = box.clientWidth;
  const h = box.clientHeight;
  const ratio = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    scene.state = scenes[scene.name].make(w, h);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, w, h);
  scenes[scene.name].draw(ctx, scene.state, Date.now(), w, h);
}

/** State of the current scene (for tests: trigger a moment without waiting for chance). */
export const ambientState = () => (scene ? scene.state : null);

/**
 * Starts the animation of theme `theme` if it has one, otherwise stops it. The scenes are
 * loaded the first time; the promise settles once the first frame is drawn.
 */
export async function setAmbient(theme) {
  wanted = theme;
  const box = document.getElementById('canvas');
  const can = ANIMATED.includes(theme) && !reduced && box && typeof box.prepend === 'function'
    && typeof document.createElement('canvas').getContext === 'function';
  if (!can) {
    clearInterval(timer);
    timer = null;
    if (layer) layer.remove();
    layer = null;
    scene = null;
    if (document.documentElement.dataset) delete document.documentElement.dataset.ambient;
    return;
  }
  if (scene && scene.name === theme) return;
  if (!scenes) {
    try {
      scenes = (await import('./ambient/scenes.js')).SCENES;
    } catch (e) {
      return; // file unavailable: the theme stays, without animation
    }
    if (wanted !== theme) return; // another theme chosen meanwhile
  }
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'ambient';
    layer.setAttribute('aria-hidden', 'true');
    layer.append(document.createElement('canvas'));
    box.prepend(layer);
  }
  const canvas = layer.firstChild;
  canvas.width = 0; // new scene: prepared on the first frame
  scene = { name: theme, state: null };
  document.documentElement.dataset.ambient = theme; // the CSS can lighten the still background pattern
  frame();
  // After a first successful frame: a drawing error doesn't leave a timer running
  if (!timer) timer = setInterval(frame, FRAME);
}
