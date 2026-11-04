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
      person('g', { given: 'Geneviève', surname: 'Laccorre', sex: 'F' }),
      person('v', { given: 'Véronique', surname: 'Freyssinet', sex: 'F' }),
      person('j', { given: 'Jeanne-Paule', surname: 'Laccorre', maidenName: 'Dumas', sex: 'F' }),
      person('s', { given: 'Simonne Marie Césarie', surname: 'Pallier', maidenName: 'Bourrel', sex: 'F' }),
      person('jf', { given: 'Jeanne', surname: 'Freyssinet', sex: 'F' }), // « Freyssinet, Jeanne-Paule » : pas elle
      person('ml', { given: 'Marie', surname: 'Laccorre', sex: 'F' }), // « Marie » et « Laccorre » éloignés : pas elle
      person('jl', { given: 'Jeanne', surname: 'Roux', maidenName: 'Laccorre', sex: 'F' }), // « Paule » n'est pas son prénom
    ]);
    const caption = 'Geneviève Laccorre (en haut), de gauche à droite : Veronique Freyssinet, Jeanne-Paule Laccorre - Simonne Marie Césarie Bourrel';
    assert.deepEqual(peopleNamedIn(caption), ['g', 'v', 'j', 's']);
    assert.deepEqual(peopleNamedIn('LACCORRE Geneviève'), ['g'], 'le nom avant le prénom');
    assert.deepEqual(peopleNamedIn(''), []);
  });
});
