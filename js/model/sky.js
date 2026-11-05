/**
 * Le ciel vu d'un lieu à un instant : position des étoiles des constellations au-dessus de
 * l'horizon (hauteur et azimut), d'après leurs coordonnées (data/constellations.js) et le temps
 * sidéral. Précision de l'ordre du degré, bien assez pour dessiner le ciel.
 */
import { CONSTELLATIONS } from '../data/constellations.js';

export const BORDEAUX = { lat: 44.84, lon: -0.58 };

const RAD = Math.PI / 180;

/** Temps sidéral local (degrés) à l'instant `date`, à la longitude `lon` (est positive). */
export function siderealDeg(date, lon) {
  const days = date.getTime() / 86400000 + 2440587.5 - 2451545; // depuis le 1er janvier 2000, 12 h TU
  return (((280.46061837 + 360.98564736629 * days + lon) % 360) + 360) % 360;
}

/** Hauteur et azimut (degrés ; azimut compté du nord vers l'est) d'un astre (ascension droite en heures). */
export function horizontal(raHours, decDeg, date, place = BORDEAUX) {
  const h = (siderealDeg(date, place.lon) - raHours * 15) * RAD;
  const dec = decDeg * RAD;
  const lat = place.lat * RAD;
  const alt = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(h));
  const az = Math.atan2(-Math.sin(h) * Math.cos(dec), Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(h));
  return { alt: alt / RAD, az: ((az / RAD) + 360) % 360 };
}

/**
 * Constellations à l'instant `date` : [{ fr, en, stars: { clé: { alt, az, name, bright } }, lines }].
 * Toutes y sont, au-dessus ou au-dessous de l'horizon (hauteur négative) : à l'affichage d'en décider.
 */
export function skyAt(date, place = BORDEAUX) {
  return CONSTELLATIONS.map((c) => ({
    fr: c.fr,
    en: c.en,
    lines: c.lines,
    stars: Object.fromEntries(Object.entries(c.stars).map(([key, [ra, dec, name, b]]) => [key, { ...horizontal(ra, dec, date, place), name: name || '', bright: b === 'b' }])),
  }));
}

/**
 * Instant du ciel à montrer : maintenant s'il fait nuit (de 21 h à 5 h), sinon ce soir à 22 h
 * (heure de l'ordinateur).
 */
export function tonight(now = new Date()) {
  const hour = now.getHours();
  if (hour >= 21 || hour < 5) return new Date(now);
  const d = new Date(now);
  d.setHours(22, 0, 0, 0);
  return d;
}
