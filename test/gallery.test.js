import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { mediaOf, allMedia, peopleNamedIn } from '../js/model/people.js';
import { loadTree, person } from './helpers.js';

describe('galerie', () => {
  test('une image apparaît chez ceux qui y sont identifiés', () => {
    const m = { id: 'm', photo: 'data:image/jpeg;base64,AAAA', tags: [{ id: 'b', x: 10, y: 20 }] };
    loadTree([person('a', { media: [m] }), person('b'), person('c')]);
    assert.deepEqual(mediaOf('b'), [{ owner: 'a', m }]);
    assert.equal(mediaOf('a').length, 1);
    assert.deepEqual(mediaOf('c'), []);
    assert.equal(allMedia().length, 1);
  });

  test('personnes nommées dans une légende : prénom et nom proches, dans l’ordre du texte', () => {
    loadTree([
      person('g', { given: 'Geneviève', surname: 'Lemaire', sex: 'F' }),
      person('v', { given: 'Véronique', surname: 'Chevalier', sex: 'F' }),
      person('j', { given: 'Jeanne-Paule', surname: 'Lemaire', maidenName: 'Dumas', sex: 'F' }),
      person('s', { given: 'Odette Marie Louise', surname: 'Garnier', maidenName: 'Mercier', sex: 'F' }),
      person('jf', { given: 'Jeanne', surname: 'Chevalier', sex: 'F' }), // « Chevalier, Jeanne-Paule » : pas elle
      person('ml', { given: 'Marie', surname: 'Lemaire', sex: 'F' }), // « Marie » et « Lemaire » éloignés : pas elle
      person('jl', { given: 'Jeanne', surname: 'Roux', maidenName: 'Lemaire', sex: 'F' }), // « Paule » n'est pas son prénom
    ]);
    const caption = 'Geneviève Lemaire (en haut), de gauche à droite : Veronique Chevalier, Jeanne-Paule Lemaire - Odette Marie Louise Mercier';
    assert.deepEqual(peopleNamedIn(caption), ['g', 'v', 'j', 's']);
    assert.deepEqual(peopleNamedIn('LEMAIRE Geneviève'), ['g'], 'le nom avant le prénom');
    assert.deepEqual(peopleNamedIn(''), []);
  });
});
