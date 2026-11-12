/**
 * Acceptance cases of the voice: sentences as Whisper writes them (capitals, full stops, "et" for
 * "est", "soeur"), and the command each one asks for. An expected command lists only what matters
 * (`person` and `union`: the fields said); null: a sentence for the language model.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseCommand } from '../js/model/voice.js';

const CORPUS = [
  // Add a person
  ['Ajoute Marie Dupont, née le 12 mars 1920 à Limoges.', { action: 'add', person: { given: 'Marie', surname: 'Dupont', sex: 'F', birthDate: '12 mars 1920', birthPlace: 'Limoges' } }],
  ['Ajoute Pierre Martin né en 1890 à Confolens et mort en 1960 à Paris.', { action: 'add', person: { given: 'Pierre', surname: 'Martin', sex: 'M', birthDate: '1890', birthPlace: 'Confolens', deathDate: '1960', deathPlace: 'Paris' } }],
  ['Ajouter Jean Tellier, né le 1er janvier 1950.', { action: 'add', person: { given: 'Jean', surname: 'Tellier', birthDate: '1 janvier 1950' } }],
  ['Ajoute une personne, Paul Durand, né vers 1850.', { action: 'add', person: { given: 'Paul', surname: 'Durand', birthDate: 'vers 1850' } }],
  ['Ajoute Anne-Marie Tellier, née en 1955, décédée en 2010.', { action: 'add', person: { given: 'Anne-Marie', surname: 'Tellier', birthDate: '1955', deathDate: '2010' } }],
  ['Ajoute Louis Tellier, agriculteur, né en 1920.', { action: 'add', person: { given: 'Louis', surname: 'Tellier', occupation: 'agriculteur', birthDate: '1920' } }],
  ['Rajoute Marie Dupont née en 1920.', { action: 'add', person: { given: 'Marie', surname: 'Dupont', birthDate: '1920' } }],
  ['Crée la fiche de Jean Martin, né en 1930.', { action: 'add', person: { given: 'Jean', surname: 'Martin', birthDate: '1930' } }],
  ['Nouvelle personne : Jean-Pierre Tellier.', { action: 'add', person: { given: 'Jean-Pierre', surname: 'Tellier' } }],
  ['Ajoute Marie de la Borie.', { action: 'add', person: { given: 'Marie', surname: 'De la Borie' } }],

  // Parents and children
  ['Jean Tellier est le fils de Marc Tellier et de Véronique Dorvigné.', { action: 'add', who: 'Marc Tellier', relation: 'child', person: { given: 'Jean', surname: 'Tellier', sex: 'M' } }],
  ['Sophie est la fille de Marc Tellier.', { action: 'add', who: 'Marc Tellier', relation: 'child', person: { given: 'Sophie', sex: 'F' } }],
  ['Sophie et la fille de Marc Tellier.', { action: 'add', who: 'Marc Tellier', relation: 'child', person: { given: 'Sophie', sex: 'F' } }],
  ['Marc Tellier a un fils qui s’appelle Jean.', { action: 'add', who: 'Marc Tellier', relation: 'child', person: { given: 'Jean', sex: 'M' } }],
  ['Marc Tellier a eu un fils, Jean, en 1995.', { action: 'add', who: 'Marc Tellier', relation: 'child', person: { given: 'Jean', sex: 'M', birthDate: '1995' } }],
  ['Véronique Dorvigné a eu une fille, Sophie Tellier, née en 1998.', { action: 'add', who: 'Véronique Dorvigné', relation: 'child', person: { given: 'Sophie', surname: 'Tellier', sex: 'F', birthDate: '1998' } }],
  ['Ajoute un fils à Marc Tellier : Jean, né en 1995.', { action: 'add', who: 'Marc Tellier', relation: 'child', person: { given: 'Jean', sex: 'M', birthDate: '1995' } }],
  ['Ajoute le fils de Marc Tellier, Jean Tellier, né en 1995.', { action: 'add', who: 'Marc Tellier', relation: 'child', person: { given: 'Jean', surname: 'Tellier', birthDate: '1995' } }],
  ['Ajoute une fille à Véronique Dorvigné, Sophie.', { action: 'add', who: 'Véronique Dorvigné', relation: 'child', person: { given: 'Sophie', sex: 'F' } }],
  ['Le père de Marc Tellier s’appelle Louis Tellier.', { action: 'add', who: 'Marc Tellier', relation: 'father', person: { given: 'Louis', surname: 'Tellier', sex: 'M' } }],
  ['Le père de Marc Tellier, c’est Louis Tellier.', { action: 'add', who: 'Marc Tellier', relation: 'father', person: { given: 'Louis', surname: 'Tellier' } }],
  ['La mère de Marc Tellier est Jeanne Lamborre, née en 1930.', { action: 'add', who: 'Marc Tellier', relation: 'mother', person: { given: 'Jeanne', surname: 'Lamborre', sex: 'F', birthDate: '1930' } }],
  ['Louis Tellier est le père de Marc Tellier, il est né en 1925 à Confolens.', { action: 'add', who: 'Marc Tellier', relation: 'father', person: { given: 'Louis', surname: 'Tellier', birthDate: '1925', birthPlace: 'Confolens' } }],
  ['Ajoute la mère de Marc Tellier : Jeanne Lamborre.', { action: 'add', who: 'Marc Tellier', relation: 'mother', person: { given: 'Jeanne', surname: 'Lamborre' } }],

  // Brothers and sisters
  ['Marc Tellier a un frère, Paul Tellier, né en 1963.', { action: 'add', who: 'Marc Tellier', relation: 'sibling', person: { given: 'Paul', surname: 'Tellier', sex: 'M', birthDate: '1963' } }],
  ['Paul Tellier est le frère de Marc Tellier.', { action: 'add', who: 'Marc Tellier', relation: 'sibling', person: { given: 'Paul', surname: 'Tellier', sex: 'M' } }],
  ['La sœur de Marc s’appelle Anne.', { action: 'add', who: 'Marc', relation: 'sibling', person: { given: 'Anne', sex: 'F' } }],
  ['Marc Tellier a une soeur qui s’appelle Anne Tellier.', { action: 'add', who: 'Marc Tellier', relation: 'sibling', person: { given: 'Anne', surname: 'Tellier', sex: 'F' } }],
  ['Ajoute une sœur à Marc Tellier : Anne.', { action: 'add', who: 'Marc Tellier', relation: 'sibling', person: { given: 'Anne', sex: 'F' } }],

  // Unions
  ['Marc Tellier est marié avec Véronique Dorvigné.', { action: 'add', who: 'Marc Tellier', relation: 'spouse', person: { given: 'Véronique', surname: 'Dorvigné' }, union: { type: 'married' } }],
  ['Marc Tellier s’est marié avec Véronique Dorvigné le 3 juin 1990 à Confolens.', { action: 'add', who: 'Marc Tellier', relation: 'spouse', person: { given: 'Véronique', surname: 'Dorvigné' }, union: { type: 'married', date: '3 juin 1990', place: 'Confolens' } }],
  ['Marc Tellier et Véronique Dorvigné se sont mariés en 1990.', { action: 'add', who: 'Marc Tellier', relation: 'spouse', person: { given: 'Véronique', surname: 'Dorvigné' }, union: { type: 'married', date: '1990' } }],
  ['Marc Tellier a épousé Véronique Dorvigné en 1990 à Limoges.', { action: 'add', who: 'Marc Tellier', relation: 'spouse', union: { type: 'married', date: '1990', place: 'Limoges' } }],
  ['Marc Tellier vit en concubinage avec Véronique Dorvigné.', { action: 'add', who: 'Marc Tellier', relation: 'spouse', person: { given: 'Véronique', surname: 'Dorvigné' }, union: { type: 'cohabiting' } }],
  ['Véronique Dorvigné est la concubine de Marc Tellier.', { action: 'add', who: 'Marc Tellier', relation: 'spouse', person: { given: 'Véronique', surname: 'Dorvigné', sex: 'F' }, union: { type: 'cohabiting' } }],
  ['Marc Tellier est le concubin de Véronique Dorvigné depuis 1985.', { action: 'add', who: 'Véronique Dorvigné', relation: 'spouse', person: { given: 'Marc', surname: 'Tellier', sex: 'M' }, union: { type: 'cohabiting', date: '1985' } }],
  ['Véronique Dorvigné est la femme de Marc Tellier.', { action: 'add', who: 'Marc Tellier', relation: 'spouse', person: { given: 'Véronique', surname: 'Dorvigné', sex: 'F' } }],
  ['Marc Tellier est pacsé avec Paul Durand.', { action: 'add', who: 'Marc Tellier', relation: 'spouse', union: { type: 'pacs' } }],
  ['La femme de Marc Tellier s’appelle Véronique Dorvigné.', { action: 'add', who: 'Marc Tellier', relation: 'spouse', person: { given: 'Véronique', surname: 'Dorvigné', sex: 'F' } }],
  ['Marc Tellier est en couple avec Véronique Dorvigné.', { action: 'add', who: 'Marc Tellier', relation: 'spouse', union: { type: 'cohabiting' } }],
  ['Ajoute la compagne de Marc Tellier : Véronique Dorvigné.', { action: 'add', who: 'Marc Tellier', relation: 'spouse', union: { type: 'cohabiting' } }],

  // Facts about someone already in the tree
  ['Marc Tellier est né le 7 juin 1961 à Confolens.', { action: 'edit', who: 'Marc Tellier', person: { birthDate: '7 juin 1961', birthPlace: 'Confolens' } }],
  ['Marc Tellier est né en 1961.', { action: 'edit', who: 'Marc Tellier', person: { birthDate: '1961' } }],
  ['Marc Tellier est né à Confolens.', { action: 'edit', who: 'Marc Tellier', person: { birthPlace: 'Confolens' } }],
  ['Marc Tellier est mort le 3 mars 2020 à Limoges.', { action: 'edit', who: 'Marc Tellier', person: { deathDate: '3 mars 2020', deathPlace: 'Limoges' } }],
  ['Marc Tellier est mort à Limoges en 2020.', { action: 'edit', who: 'Marc Tellier', person: { deathDate: '2020', deathPlace: 'Limoges' } }],
  ['Marc Tellier est décédé en 2020.', { action: 'edit', who: 'Marc Tellier', person: { deathDate: '2020' } }],
  ['Marc Tellier était menuisier.', { action: 'edit', who: 'Marc Tellier', person: { occupation: 'menuisier' } }],
  ['Marc Tellier est cultivateur à Confolens.', { action: 'edit', who: 'Marc Tellier', person: { occupation: 'cultivateur' } }],
  ['La date de naissance de Marc Tellier est le 7 juin 1961.', { action: 'edit', who: 'Marc Tellier', person: { birthDate: '7 juin 1961' } }],
  ['Le lieu de naissance de Marc Tellier est Confolens.', { action: 'edit', who: 'Marc Tellier', person: { birthPlace: 'Confolens' } }],
  ['Le métier de Marc Tellier est menuisier.', { action: 'edit', who: 'Marc Tellier', person: { occupation: 'menuisier' } }],

  // Search, open
  ['Cherche Tellier.', { action: 'search', who: 'Tellier' }],
  ['Recherche les Dorvigné.', { action: 'search', who: 'les Dorvigné' }],
  ['Ouvre la fiche de Marc Tellier.', { action: 'open', who: 'Marc Tellier' }],
  ['Affiche Marc Tellier.', { action: 'open', who: 'Marc Tellier' }],
  ['Montre-moi la fiche de Marc.', { action: 'open', who: 'Marc' }],
  ['Va sur la fiche de Marc Tellier.', { action: 'open', who: 'Marc Tellier' }],

  // For the language model
  ['Quel temps fait-il ?', null],
  ['Ajoute les parents de Marc Tellier : Louis Tellier et Jeanne Lamborre.', null],
];

describe('voix : corpus des phrases dites', () => {
  for (const [sentence, want] of CORPUS) {
    test(sentence, () => {
      const c = parseCommand(sentence);
      if (!want) return assert.equal(c.action, 'unknown', 'pour le modèle de langage');
      for (const k of ['action', 'who', 'relation']) if (k in want) assert.equal(c[k], want[k], k);
      for (const group of ['person', 'union']) {
        for (const [k, v] of Object.entries(want[group] || {})) assert.equal(c[group][k], v, `${group}.${k}`);
      }
    });
  }
});
