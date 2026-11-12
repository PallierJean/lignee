import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { mediaOf, allMedia, peopleNamedIn } from '../js/model/people.js';
import { loadTree, person } from './helpers.js';

describe('galerie', () => {
  test('une image apparaît chez ceux qui y sont identifiés ; la fiche qui la gardait (format 2) aussi, sans repère', () => {
    const m = { id: 'm', photo: 'data:image/jpeg;base64,AAAA', tags: [{ id: 'b', x: 10, y: 20 }] };
    loadTree([person('a', { media: [m] }), person('b'), person('c')]);
    assert.deepEqual(mediaOf('b'), [{ id: 'm', m: { photo: m.photo, tags: [{ id: 'a' }, { id: 'b', x: 10, y: 20 }] } }]);
    assert.equal(mediaOf('a').length, 1);
    assert.deepEqual(mediaOf('c'), []);
    assert.equal(allMedia().length, 1);
  });

  test('format 2 → 3 : les images quittent les fiches pour la galerie, sans doublon ni perte', async () => {
    const { galleryFromPeople, tagsOf } = await import('../js/model/media.js');
    const people = [
      { id: 'a', data: { given: 'Anne', media: [{ id: 'm1', photo: 'photos/x.jpg', title: 'Noces', tags: [{ id: 'b', x: 5, y: 6, extra: 1 }] }, { id: 'm2', photo: 'photos/y.jpg', tags: [{ id: 'a', x: 1, y: 2 }] }] } },
      { id: 'b', data: { given: 'Paul', media: [{ id: 'm1', photo: 'photos/x.jpg' }, { photo: 'sans id' }] } },
      { id: 'c', data: { given: 'Rien' } },
    ];
    const media = galleryFromPeople(people, [{ id: 'm0', data: { photo: 'photos/z.jpg', tags: [] } }]);
    assert.deepEqual(media.map((x) => x.id).slice(0, 3), ['m0', 'm1', 'm2']);
    assert.equal(media.length, 4, 'une image sans identifiant en reçoit un');
    assert.deepEqual(media[3].data, { photo: 'sans id', tags: [{ id: 'b' }] });
    assert.deepEqual(media[1].data.tags, [{ id: 'a' }, { id: 'b', x: 5, y: 6, extra: 1 }], 'la fiche qui la gardait : identifiée sans repère ; les repères gardés tels quels');
    assert.deepEqual(media[2].data.tags, [{ id: 'a', x: 1, y: 2 }], 'déjà identifiée : pas deux fois');
    assert.ok(people.every((p) => !('media' in p.data)), 'les fiches ne gardent plus d’images');
    assert.deepEqual(tagsOf({ tags: [{ id: 'a', x: '150', y: -3 }, { id: 'b' }, { id: 'c', x: 'bad', y: 5 }, { x: 1 }, null] }), [{ id: 'a', x: 100, y: 0 }, { id: 'b' }, { id: 'c', x: 0, y: 5 }]);
  });

  test('sauvegarde au format 2 : lue et convertie ; format 1 refusé ; écrite au format 3', async () => {
    const { parseBackup, buildBackup } = await import('../js/services/backup.js');
    const v2 = JSON.stringify({ format: 'lignee', version: 2, people: [{ id: 'a', given: 'Anne', media: [{ id: 'm1', photo: 'photos/x.jpg' }] }], unions: [], sources: [] });
    const read = parseBackup(v2);
    assert.deepEqual(read.people, [{ id: 'a', data: { given: 'Anne' } }]);
    assert.deepEqual(read.media, [{ id: 'm1', data: { photo: 'photos/x.jpg', tags: [{ id: 'a' }] } }]);
    assert.throws(() => parseBackup('{"format":"lignee","version":1,"people":[]}'), (e) => e.code === 'old');
    const out = JSON.parse(buildBackup({ name: 'x', people: new Map([['a', { given: 'Anne' }]]), unions: new Map(), sources: new Map(), media: new Map([['m1', { photo: 'p', tags: [{ id: 'a' }] }]]) }));
    assert.equal(out.version, 3);
    assert.deepEqual(out.media, [{ id: 'm1', photo: 'p', tags: [{ id: 'a' }] }]);
    assert.equal('media' in out.people[0], false);
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
    mediaGroups.set('g', ['m1', 'm2']);
    media.openMedia('m1', 'g');
    const card = () => document.getElementById('mediaCard').innerHTML;
    assert.match(card(), /data-act="media-delete">Supprimer l’image/);
    media.askMediaDelete(true);
    assert.match(card(), /galerie de l’arbre et de celles des personnes identifiées/);
    await media.deleteMedia();
    assert.deepEqual([...S.media.keys()], ['m2']);
    assert.equal(mediaOf('b').length, 0, 'plus dans la galerie de la personne identifiée');
    assert.match(card(), /data:image\/png;base64,B/, 'la suivante s’affiche');
    await undoAction();
    assert.deepEqual([...S.media.keys()].sort(), ['m1', 'm2'], 'Ctrl+Z la remet');
    media.closeMedia();
  });
});

describe('ajouter des photos depuis la galerie', () => {
  test('première case : dans la galerie de l’arbre, personne n’est identifié ; sur une fiche, la personne ; seulement en écriture', async () => {
    const { S } = await import('../js/state.js');
    const { addMediaTile, mediaGrid } = await import('../js/ui/record.js');
    const { resetApp } = await import('./helpers.js');
    resetApp();
    loadTree([person('a', { given: 'Anne', surname: 'Roux', media: [{ id: 'm1', photo: 'data:image/png;base64,A' }] })]);
    S.focus = 'a';
    const grid = mediaGrid(allMedia(), 'all', addMediaTile());
    assert.match(grid, /^<div class="meds"><label class="med med-add" title="Ajouter des photos à la galerie de l’arbre"><input type="file" accept="image\/\*" multiple class="sr" data-gal-add="">/);
    assert.match(addMediaTile('a'), /title="Ajouter des photos à la galerie de Anne ROUX".*data-gal-add="a"/);
    S.canWrite = false;
    assert.equal(addMediaTile('a'), '', 'lecture seule : pas d’ajout');
    assert.equal(addMediaTile(), '');
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
    media.openMedia('m1');
    const card = () => document.getElementById('mediaCard').innerHTML;
    assert.match(card(), /data-media-back="1">Ajouter le verso</);
    S.media.set('m1', { ...S.media.get('m1'), back: 'data:image/png;base64,B' });
    media.renderMedia();
    assert.match(card(), />Changer le verso</);
    assert.match(card(), /data-act="media-back-remove">Retirer le verso</);
    await media.setMediaBack(null);
    assert.equal(S.media.get('m1').back, undefined);
    assert.match(card(), /Ajouter le verso/);
    await undoAction();
    assert.equal(S.media.get('m1').back, 'data:image/png;base64,B', 'Ctrl+Z le remet');
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
    mediaGroups.set('g', ['m1', 'm2']);
    media.openMedia('m1', 'g');
    const card = () => document.getElementById('mediaCard').innerHTML;
    assert.match(card(), /data-act="media-archive">Classer aux archives/);
    media.askMediaArchive(true);
    assert.doesNotMatch(card(), /<select/, 'pas de type à choisir');
    await media.archiveMedia();
    assert.deepEqual([...S.media.keys()], ['m2'], 'plus dans la galerie');
    const [doc] = sourcesOf(S.people.get('a'));
    assert.equal(doc.kind, 'family', 'une archive : « Archives familiales »');
    assert.equal(doc.title, 'Contrat');
    assert.equal(doc.note, '1912 — chez le notaire');
    assert.equal(doc.photo, 'data:image/png;base64,A');
    assert.equal(doc.back, 'data:image/png;base64,V', 'le verso suit');
    assert.equal(doc.fact, '');
    assert.equal(sourcesOf(S.people.get('b'))[0].source, doc.source, 'la personne identifiée cite la même source');
    assert.equal(S.sources.size, 1);
    assert.match(card(), /data:image\/png;base64,B/, 'la suivante s’affiche');
    await undoAction();
    assert.deepEqual([...S.media.keys()].sort(), ['m1', 'm2'], 'Ctrl+Z la remet');
    assert.equal(sourcesOf(S.people.get('a')).length, 0);
    assert.equal(sourcesOf(S.people.get('b')).length, 0);
    assert.equal(S.sources.size, 0);
    // An image identifying no one: no record would cite the source
    S.media.set('m3', { photo: 'data:image/png;base64,C', tags: [] });
    media.openMedia('m3');
    await media.archiveMedia();
    assert.ok(S.media.has('m3'), 'elle reste');
    assert.equal(S.sources.size, 0);
    media.closeMedia();
  });
});

describe('galerie indépendante des fiches', () => {
  test('une image de la galerie est enregistrée sous un nom de fichier commun, pas celui de la personne au centre', async () => {
    const { S } = await import('../js/state.js');
    const { resetApp } = await import('./helpers.js');
    resetApp();
    loadTree([person('a', { given: 'Anne', surname: 'Roux' })]);
    S.focus = 'a';
    const nativeFetch = globalThis.fetch;
    const labels = [];
    S.mode = 'file';
    S.tree = 'arbre';
    globalThis.fetch = async (u, init = {}) => {
      if (/\/photos$/.test(String(u))) {
        labels.push(JSON.parse(init.body).label);
        return new Response(JSON.stringify({ photo: 'photos/galerie-' + labels.length + '.jpg' }));
      }
      return new Response('', { status: 204 });
    };
    try {
      const { storePhoto, GALLERY_LABEL } = await import('../js/services/storage.js');
      assert.equal(await storePhoto('data:image/png;base64,AAAA', GALLERY_LABEL), 'photos/galerie-1.jpg');
      assert.deepEqual(labels, ['galerie'], 'pas le nom de la personne au centre de l’arbre');
    } finally {
      globalThis.fetch = nativeFetch;
      S.mode = 'local';
    }
  });

  test('un repère posé remplace l’identification sans repère ; une personne supprimée quitte les images, qui restent', async () => {
    const { S } = await import('../js/state.js');
    const media = await import('../js/ui/media.js');
    const A = await import('../js/actions.js');
    const { resetApp } = await import('./helpers.js');
    resetApp();
    loadTree([person('a', { given: 'Anne', surname: 'Roux' }), person('b', { given: 'Paul', surname: 'Roux' })]);
    S.media.set('m1', { photo: 'data:image/png;base64,A', tags: [{ id: 'a' }, { id: 'b', x: 3, y: 4 }] });
    media.openMedia('m1');
    const card = () => document.getElementById('mediaCard').innerHTML;
    assert.equal((card().match(/class="tag-pin/g) || []).length, 1, 'un seul repère sur l’image');
    assert.match(card(), /data-act="media-person" data-id="a">Anne ROUX/, 'mais les deux dans la liste');
    media.placePin({ querySelector: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) }) }, { clientX: 20, clientY: 30, target: { closest: () => null } });
    await media.addTag('a');
    assert.deepEqual(S.media.get('m1').tags, [{ id: 'b', x: 3, y: 4 }, { id: 'a', x: 20, y: 30 }]);
    media.closeMedia();
    await A.doDelete('b');
    assert.deepEqual(S.media.get('m1').tags, [{ id: 'a', x: 20, y: 30 }], 'plus identifiée, l’image reste');
    await A.doDelete('a');
    assert.ok(S.media.has('m1'), 'dans la galerie de l’arbre, même sans personne');
    assert.deepEqual(S.media.get('m1').tags, []);
  });
});

describe('nom d’une image', () => {
  test('pas de titre : les personnes identifiées, sinon rien (« Image sans titre ») ; un nom de fichier ne compte pas', async () => {
    const { mediaLabel } = await import('../js/model/people.js');
    loadTree([person('b', { given: 'Paul', surname: 'Roux' })]);
    assert.equal(mediaLabel({ title: 'PART_1474012919711_DSC_0936', tags: [{ id: 'b', x: 1, y: 1 }] }), 'Paul ROUX');
    assert.equal(mediaLabel({ title: 'PART_1474012919711_DSC_0936' }), '');
    assert.equal(mediaLabel({ title: 'Noces d’or', tags: [{ id: 'b', x: 1, y: 1 }] }), 'Noces d’or');
  });
});

describe('galerie à la place de l’arbre', () => {
  test('le bouton de la barre montre toutes les images, Échap ou « Revenir à l’arbre » ramène l’arbre', async () => {
    const { S } = await import('../js/state.js');
    const A = await import('../js/actions.js');
    const { renderAll } = await import('../js/ui/render.js');
    const { resetApp } = await import('./helpers.js');
    resetApp();
    loadTree([
      person('a', { given: 'Anne', surname: 'Roux', media: [{ id: 'm1', photo: 'data:image/png;base64,A' }, { id: 'm2', photo: 'data:image/png;base64,B', tags: [{ id: 'b', x: 1, y: 1 }] }] }),
      person('b', { given: 'Paul', surname: 'Roux' }),
    ]);
    S.focus = 'a';
    renderAll();
    const el = (id) => document.getElementById(id);
    assert.equal(el('stageGallery').hidden, true);
    A.toggleStageGallery();
    assert.equal(el('stageGallery').hidden, false);
    assert.equal(el('canvas').hidden, true, 'l’arbre reste dessous, caché');
    assert.equal(el('btnGallery').getAttribute('aria-pressed'), 'true');
    assert.match(el('stageGallery').innerHTML, /Galerie <span class="n">2<\/span>/);
    assert.match(el('stageGallery').innerHTML, /data-group="stage"/);
    assert.match(el('stageGallery').innerHTML, /Revenir à l’arbre/);
    A.toggleStageGallery();
    assert.equal(el('stageGallery').hidden, true);
    assert.equal(el('canvas').hidden, false);
    S.gallery = false;
  });
});
