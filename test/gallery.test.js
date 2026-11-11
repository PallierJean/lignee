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

describe('supprimer une image depuis la visionneuse', () => {
  test('confirmation, disparue partout, annulable ; la visionneuse passe à la suivante', async () => {
    const { S } = await import('../js/state.js');
    const media = await import('../js/ui/media.js');
    const { mediaGroups } = await import('../js/ui/record.js');
    const { undoAction } = await import('../js/services/storage.js');
    const { resetApp } = await import('./helpers.js');
    resetApp();
    loadTree([
      person('a', { given: 'Anne', surname: 'Roux', media: [{ id: 'm1', photo: 'data:image/png;base64,A', tags: [{ id: 'b', x: 1, y: 1 }] }, { id: 'm2', photo: 'data:image/png;base64,B' }] }),
      person('b', { given: 'Paul', surname: 'Roux' }),
    ]);
    mediaGroups.set('g', [{ owner: 'a', id: 'm1' }, { owner: 'a', id: 'm2' }]);
    media.openMedia('a', 'm1', 'g');
    const card = () => document.getElementById('mediaCard').innerHTML;
    assert.match(card(), /data-act="media-delete">Supprimer l’image/);
    media.askMediaDelete(true);
    assert.match(card(), /galerie de Anne ROUX, et de celles des personnes identifiées/);
    await media.deleteMedia();
    assert.deepEqual(S.people.get('a').media.map((m) => m.id), ['m2']);
    assert.equal(mediaOf('b').length, 0, 'plus dans la galerie de la personne identifiée');
    assert.match(card(), /data:image\/png;base64,B/, 'la suivante s’affiche');
    await undoAction();
    assert.deepEqual(S.people.get('a').media.map((m) => m.id), ['m1', 'm2'], 'Ctrl+Z la remet');
    media.closeMedia();
  });
});

describe('ajouter des photos depuis la galerie', () => {
  test('première case : ajouter à la galerie de la personne centrale ; seulement en écriture', async () => {
    const { S } = await import('../js/state.js');
    const { addMediaTile, mediaGrid } = await import('../js/ui/record.js');
    const { resetApp } = await import('./helpers.js');
    resetApp();
    loadTree([person('a', { given: 'Anne', surname: 'Roux', media: [{ id: 'm1', photo: 'data:image/png;base64,A' }] })]);
    const grid = mediaGrid(allMedia(), 'all', addMediaTile('a'));
    assert.match(grid, /^<div class="meds"><label class="med med-add" title="Ajouter des photos à la galerie de Anne ROUX"><input type="file" accept="image\/\*" multiple/);
    S.canWrite = false;
    assert.equal(addMediaTile('a'), '', 'lecture seule : pas d’ajout');
    S.canWrite = true;
  });
});

describe('verso depuis la visionneuse', () => {
  test('ajouter, changer ou retirer le verso sans passer par la fiche ; annulable', async () => {
    const { S } = await import('../js/state.js');
    const media = await import('../js/ui/media.js');
    const { undoAction } = await import('../js/services/storage.js');
    const { resetApp } = await import('./helpers.js');
    resetApp();
    loadTree([person('a', { given: 'Anne', surname: 'Roux', media: [{ id: 'm1', photo: 'data:image/png;base64,A' }] })]);
    media.openMedia('a', 'm1');
    const card = () => document.getElementById('mediaCard').innerHTML;
    assert.match(card(), /data-media-back="1">Ajouter le verso</);
    S.people.set('a', { ...S.people.get('a'), media: [{ id: 'm1', photo: 'data:image/png;base64,A', back: 'data:image/png;base64,B' }] });
    media.renderMedia();
    assert.match(card(), />Changer le verso</);
    assert.match(card(), /data-act="media-back-remove">Retirer le verso</);
    await media.setMediaBack(null);
    assert.equal(S.people.get('a').media[0].back, undefined);
    assert.match(card(), /Ajouter le verso/);
    await undoAction();
    assert.equal(S.people.get('a').media[0].back, 'data:image/png;base64,B', 'Ctrl+Z le remet');
    media.closeMedia();
  });
});
