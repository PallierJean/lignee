/**
 * Scenes of the animated themes, drawing only (ui/ambient.js runs them, and loads this file
 * the first time an animated theme is shown). Each theme has its own file in scenes/, and
 * scenes/shared.js holds the helpers several of them use. The "holidays and seasons" themes and Grand Line,
 * drawn on a layer under the tree: snow and a garland all around the canvas at Christmas; at Halloween, moon and clouds,
 * flickering pumpkins, mist, spider, bats and ghosts; in spring, flowering cherry
 * branches, a flowery meadow, petals, butterflies and swallows; in summer, the beach
 * (waves, foam, blurred swimmers, a small shark, gulls); in autumn, trees losing
 * their coloured leaves in gusts of wind; on Grand Line, a manga page (ink
 * lines, screentone, sound effects) where a pirate ship sails, chased by the navy firing its
 * cannons, whose rubber-armed sailor catches his straw hat; islands, gulls and a
 * sea monster; in the faraway galaxy, drifting stars and nebulae, a ringed planet and twin
 * suns, starfighter and freighter chases with laser bolts and explosions, jumps to hyperspace,
 * a dagger-shaped cruiser, and on the ice a walker brought down by the tow cables of airspeeders.
 * Each object has its own size, speed and sway, drawn at random.
 */

import { noel } from './scenes/noel.js';
import { halloween } from './scenes/halloween.js';
import { printemps } from './scenes/printemps.js';
import { ete } from './scenes/ete.js';
import { grandline } from './scenes/grandline.js';
import { galaxie } from './scenes/galaxie.js';
import { automne } from './scenes/automne.js';

/** Each scene: make(w, h) returns its starting state; draw(ctx, state, now, w, h) draws one frame. */
export const SCENES = { noel, halloween, printemps, ete, grandline, galaxie, automne };
