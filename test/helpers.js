/** Outils communs aux tests. */
import { readFileSync } from 'node:fs';
import { S } from '../js/state.js';
import { reindex } from '../js/model/people.js';

/** Famille d'exemple livrée avec l'application (data/exemple-famille-bertrand.json). */
export const example = () =>
  JSON.parse(readFileSync(new URL('../data/exemple-famille-bertrand.json', import.meta.url), 'utf8'));

/** Ouvre un arbre en mémoire : personnes et unions en tableaux [{ id, ... }]. */
export function loadTree(people, unions = []) {
  S.people = new Map(people.map(({ id, ...p }) => [id, p]));
  S.unions = new Map(unions.map(({ id, ...u }, i) => [id || 'u' + i, u]));
  reindex();
}

/** Personne minimale. */
export const person = (id, fields = {}) => ({ id, given: '', surname: '', sex: 'U', ...fields });
