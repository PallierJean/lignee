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
      person('g', { given: 'Geneviève', surname: 'Lamborre', sex: 'F' }),
      person('v', { given: 'Véronique', surname: 'Freyssinet', sex: 'F' }),
      person('j', { given: 'Jeanne-Paule', surname: 'Lamborre', maidenName: 'Dumas', sex: 'F' }),
      person('s', { given: 'Simonne Marie Césarie', surname: 'Tellier', maidenName: 'Bourrel', sex: 'F' }),
      person('jf', { given: 'Jeanne', surname: 'Freyssinet', sex: 'F' }), // « Freyssinet, Jeanne-Paule » : pas elle
      person('ml', { given: 'Marie', surname: 'Lamborre', sex: 'F' }), // « Marie » et « Lamborre » éloignés : pas elle
      person('jl', { given: 'Jeanne', surname: 'Roux', maidenName: 'Lamborre', sex: 'F' }), // « Paule » n'est pas son prénom
    ]);
    const caption = 'Geneviève Lamborre (en haut), de gauche à droite : Veronique Freyssinet, Jeanne-Paule Lamborre - Simonne Marie Césarie Bourrel';
    assert.deepEqual(peopleNamedIn(caption), ['g', 'v', 'j', 's']);
    assert.deepEqual(peopleNamedIn('LAMBORRE Geneviève'), ['g'], 'le nom avant le prénom');
    assert.deepEqual(peopleNamedIn(''), []);
  });
});
