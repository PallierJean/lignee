/**
 * The sky seen from a place at a given moment: position of the constellation stars above the
 * horizon (altitude and azimuth), from their coordinates (data/constellations.js) and sidereal
 * time. Accurate to about a degree, plenty to draw the sky.
 */
import { CONSTELLATIONS } from '../data/constellations.js';

export const BORDEAUX = { lat: 44.84, lon: -0.58 };

const RAD = Math.PI / 180;

/** Local sidereal time (degrees) at instant `date`, at longitude `lon` (east positive). */
export function siderealDeg(date, lon) {
  const days = date.getTime() / 86400000 + 2440587.5 - 2451545; // since 1 January 2000, 12:00 UT
  return (((280.46061837 + 360.98564736629 * days + lon) % 360) + 360) % 360;
}

/** Altitude and azimuth (degrees; azimuth measured from north towards east) of a star (right ascension in hours). */
export function horizontal(raHours, decDeg, date, place = BORDEAUX) {
  const h = (siderealDeg(date, place.lon) - raHours * 15) * RAD;
  const dec = decDeg * RAD;
  const lat = place.lat * RAD;
  const alt = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(h));
  const az = Math.atan2(-Math.sin(h) * Math.cos(dec), Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(h));
  return { alt: alt / RAD, az: ((az / RAD) + 360) % 360 };
}

/**
 * Constellations at instant `date`: [{ fr, en, stars: { key: { alt, az, name, bright } }, lines }].
 * All are included, above or below the horizon (negative altitude): the display decides.
 */
export function skyAt(date, place = BORDEAUX) {
  return CONSTELLATIONS.map((c) => ({
    fr: c.fr,
    en: c.en,
    lines: c.lines,
    stars: Object.fromEntries(Object.entries(c.stars).map(([key, [ra, dec, name, b]]) => [key, { ...horizontal(ra, dec, date, place), name: name || '', bright: b === 'b' }])),
  }));
}
