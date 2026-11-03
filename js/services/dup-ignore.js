/**
 * Paires de fiches écartées par « Ce n'est pas un doublon », gardées dans ce navigateur,
 * par arbre : { [arbre]: ['idA|idB', …] }.
 */
import { DUP_KEY } from '../config.js';
import { S } from '../state.js';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(DUP_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}

/** Paires écartées dans l'arbre ouvert. */
export const ignoredPairs = () => new Set(readAll()[S.tree] || []);

/** Écarte durablement la paire `key` (« idA|idB ») de l'arbre ouvert. */
export function ignorePair(key) {
  const all = readAll();
  all[S.tree] = [...new Set([...(all[S.tree] || []), key])];
  try {
    localStorage.setItem(DUP_KEY, JSON.stringify(all));
  } catch (e) {
    /* stockage plein ou refusé : la paire réapparaîtra au prochain chargement */
  }
}
