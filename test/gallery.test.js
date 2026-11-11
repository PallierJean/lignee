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

describe('classer une image aux archives', () => {
  test('elle quitte la galerie et devient une source citée par les personnes identifiées ; annulable', async () => {
    const { S } = await import('../js/state.js');
    const media = await import('../js/ui/media.js');
    const { mediaGroups } = await import('../js/ui/record.js');
    const { sourcesOf } = await import('../js/model/sources.js');
    const { undoAction } = await import('../js/services/storage.js');
    const { resetApp } = await import('./helpers.js');
    resetApp();
    loadTree([
      person('a', { given: 'Anne', surname: 'Roux', media: [
        { id: 'm1', photo: 'data:image/png;base64,A', back: 'data:image/png;base64,V', title: 'Contrat', date: '1912', note: 'chez le notaire', tags: [{ id: 'b', x: 1, y: 1 }] },
        { id: 'm2', photo: 'data:image/png;base64,B' }] }),
      person('b', { given: 'Paul', surname: 'Roux' }),
    ]);
    mediaGroups.set('g', [{ owner: 'a', id: 'm1' }, { owner: 'a', id: 'm2' }]);
    media.openMedia('a', 'm1', 'g');
    const card = () => document.getElementById('mediaCard').innerHTML;
    assert.match(card(), /data-act="media-archive">Classer aux archives/);
    media.askMediaArchive(true);
    assert.match(card(), /<select id="archiveKind">/);
    await media.archiveMedia('notary');
    assert.deepEqual(S.people.get('a').media.map((m) => m.id), ['m2'], 'plus dans la galerie');
    const [doc] = sourcesOf(S.people.get('a'));
    assert.equal(doc.kind, 'notary');
    assert.equal(doc.title, 'Contrat');
    assert.equal(doc.note, '1912 — chez le notaire');
    assert.equal(doc.photo, 'data:image/png;base64,A');
    assert.equal(doc.back, 'data:image/png;base64,V', 'le verso suit');
    assert.equal(doc.fact, '');
    assert.equal(sourcesOf(S.people.get('b'))[0].source, doc.source, 'la personne identifiée cite la même source');
    assert.equal(S.sources.size, 1);
    assert.match(card(), /data:image\/png;base64,B/, 'la suivante s’affiche');
    await undoAction();
    assert.deepEqual(S.people.get('a').media.map((m) => m.id), ['m1', 'm2'], 'Ctrl+Z la remet');
    assert.equal(sourcesOf(S.people.get('a')).length, 0);
    assert.equal(sourcesOf(S.people.get('b')).length, 0);
    assert.equal(S.sources.size, 0);
    media.closeMedia();
  });
});
