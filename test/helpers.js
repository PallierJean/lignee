/** Outils communs aux tests. */
import { readFileSync } from 'node:fs';
import { S } from '../js/state.js';
import { reindex } from '../js/model/people.js';

/** Famille d'exemple livrée avec l'application (data/arbres/exemple-famille-bertrand.json). */
export const example = () =>
  JSON.parse(readFileSync(new URL('../data/arbres/exemple-famille-bertrand.json', import.meta.url), 'utf8'));

/** Ouvre un arbre en mémoire : personnes et unions en tableaux [{ id, ... }]. */
export function loadTree(people, unions = []) {
  S.people = new Map(people.map(({ id, ...p }) => [id, p]));
  S.unions = new Map(unions.map(({ id, ...u }, i) => [id || 'u' + i, u]));
  reindex();
}

/** Personne minimale. */
export const person = (id, fields = {}) => ({ id, given: '', surname: '', sex: 'U', ...fields });

/** Remet l'application dans un état neutre, en mode navigateur. */
export function resetApp() {
  S.mode = 'local';
  S.tree = 'principal';
  S.trees = new Map([['principal', { name: 'Mon arbre', createdAt: 0, count: 0 }]]);
  Object.assign(S, {
    focus: null, full: false, fan: false, line: true, tab: 'fiche', analyse: 'kin', popup: null, edit: null, busy: false,
    canWrite: true, writeKnown: false, pending: null, confirmDel: false, confirmEx: false, query: '', kinA: '', kinB: '',
    kinShow: false, calMonth: null, timeFamily: false, treeEdit: null, up: 3, down: 2, zoom: 1, lastLayout: null,
  });
  S.dupIgnored = new Set();
  localStorage.clear();
}

/** Contenu HTML d'un élément de la page. */
export const html = (id) => document.getElementById(id).innerHTML;
