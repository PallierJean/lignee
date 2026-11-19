import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { mediaOf, allMedia, peopleNamedIn } from '../js/model/people.js';
import { loadTree, person } from './helpers.js';

describe('galerie', () => {
  test('une image apparaît chez ceux qui y sont identifiés ; la fiche où elle a été ajoutée aussi, sans repère', () => {
    const m = { id: 'm', photo: 'data:image/jpeg;base64,AAAA', tags: [{ id: 'b', x: 10, y: 20 }] };
    loadTree([person('a', { media: [m] }), person('b'), person('c')]);
    assert.deepEqual(mediaOf('b'), [{ id: 'm', m: { photo: m.photo, tags: [{ id: 'a' }, { id: 'b', x: 10, y: 20 }] } }]);
    assert.equal(mediaOf('a').length, 1);
    assert.deepEqual(mediaOf('c'), []);
    assert.equal(allMedia().length, 1);
  });

  test('repères : une position illisible devient 0, sans position pas de repère', async () => {
    const { tagsOf } = await import('../js/model/media.js');
    assert.deepEqual(tagsOf({ tags: [{ id: 'a', x: '150', y: -3 }, { id: 'b' }, { id: 'c', x: 'bad', y: 5 }, { x: 1 }, null] }), [{ id: 'a', x: 100, y: 0 }, { id: 'b' }, { id: 'c', x: 0, y: 5 }]);
  });

  test('format 3 : la galerie lue et écrite à part des fiches ; formats 1 et 2 refusés', async () => {
    const { parseBackup, buildBackup } = await import('../js/services/backup.js');
    const v3 = JSON.stringify({ format: 'lignee', version: 3, people: [{ id: 'a', given: 'Anne' }], unions: [], sources: [], media: [{ id: 'm1', photo: 'photos/galerie-x.jpg', tags: [{ id: 'a' }] }] });
    const read = parseBackup(v3);
    assert.deepEqual(read.people, [{ id: 'a', data: { given: 'Anne' } }]);
    assert.deepEqual(read.media, [{ id: 'm1', data: { photo: 'photos/galerie-x.jpg', tags: [{ id: 'a' }] } }]);
    for (const version of [1, 2]) assert.throws(() => parseBackup(`{"format":"lignee","version":${version},"people":[]}`), (e) => e.code === 'old');
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
    assert.match(card(), /data-act="media-delete"><svg[^]*?<\/svg>Supprimer l’image/);
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
    assert.match(card(), /data-act="media-person" data-id="a"><b>Anne ROUX/, 'mais les deux dans la liste');
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
    S.stage = '';
  });

  test('les sources à la place de l’arbre, exclusives de la galerie, filtrées sans toucher au panneau', async () => {
    const { S } = await import('../js/state.js');
    const A = await import('../js/actions.js');
    const { renderAll } = await import('../js/ui/render.js');
    const { setLibraryFilter } = await import('../js/ui/analysis.js');
    const { resetApp } = await import('./helpers.js');
    resetApp();
    loadTree([
      person('a', { given: 'Anne', surname: 'Roux', sources: [{ kind: 'birth', title: 'Acte de naissance', ref: 'n°3' }] }),
      person('b', { given: 'Paul', surname: 'Roux', sources: [{ kind: 'marriage', title: 'Contrat', ref: 'n°9' }] }),
    ]);
    S.focus = 'a';
    renderAll();
    const el = (id) => document.getElementById(id);
    A.toggleStageGallery();
    A.toggleStageSources();
    assert.equal(el('btnGallery').getAttribute('aria-pressed'), 'false', 'la galerie laisse la place');
    assert.equal(el('btnSources').getAttribute('aria-pressed'), 'true');
    assert.equal(el('canvas').hidden, true);
    const out = el('stageGallery').innerHTML;
    assert.match(out, /Sources <span class="n">2<\/span>/);
    assert.match(out, /id="sg-lib-q"/);
    assert.match(out, /data-act="stage-sources">Revenir à l’arbre/);
    assert.match(out, /Acte de naissance/);
    setLibraryFilter(undefined, 'contrat');
    assert.doesNotMatch(el('sg-libList').innerHTML, /Acte de naissance/);
    assert.match(el('sg-libList').innerHTML, /Contrat/);
    setLibraryFilter(undefined, '');
    A.toggleStageSources();
    assert.equal(el('stageGallery').hidden, true);
    assert.equal(el('canvas').hidden, false);
  });
});

describe('archives dans la visionneuse', () => {
  /** Anne cites an archive where she and Paul are placed; Jean is in the tree, not on it. */
  async function setup() {
    const { S } = await import('../js/state.js');
    const media = await import('../js/ui/media.js');
    const { mediaGroups } = await import('../js/ui/record.js');
    const { resetApp } = await import('./helpers.js');
    resetApp();
    loadTree([
      person('a', { given: 'Anne', surname: 'Roux', media: [
        { id: 'm1', photo: 'data:image/png;base64,A', back: 'data:image/png;base64,V', title: 'Mariage', date: '1912', note: 'à Lyon',
          tags: [{ id: 'a', x: 10, y: 20 }, { id: 'b', x: 60, y: 30 }] }] }),
      person('b', { given: 'Paul', surname: 'Roux' }),
      person('c', { given: 'Jean', surname: 'Roux' }),
    ]);
    S.media.get('m1').text = { of: 'data:image/png;base64,A', model: 'Claude', lines: [{ box: [0, 0, 1, 1], text: 'Mariage' }] };
    mediaGroups.set('g', ['m1']);
    media.openMedia('m1', 'g');
    await media.archiveMedia();
    const [sid] = S.sources.keys();
    mediaGroups.set('archives', [sid]);
    const card = () => document.getElementById('mediaCard').innerHTML;
    const citers = () => [...S.people].filter(([, p]) => (p.citations || []).some((c) => c.source === sid)).map(([id]) => id).sort();
    return { S, media, sid, card, citers };
  }

  test('classer garde les repères et la lecture ; la visionneuse montre les ronds au survol', async () => {
    const { S, media, sid, card } = await setup();
    assert.deepEqual(S.sources.get(sid).tags, [{ id: 'a', x: 10, y: 20 }, { id: 'b', x: 60, y: 30 }]);
    assert.equal(S.sources.get(sid).text.lines[0].text, 'Mariage', 'la lecture suit');
    media.openArchive(sid);
    assert.equal(document.getElementById('mediaDlg').hidden, false);
    assert.equal((card().match(/class="tag-pin/g) || []).length, 2, 'un rond par visage');
    assert.match(card(), /data-act="tag-remove"/);
    assert.match(card(), /data-act="archive-to-gallery"/);
    assert.match(card(), /data-act="media-delete"/);
    assert.doesNotMatch(card(), /media-archive|media-crop/, 'ni « Classer aux archives », ni recadrage');
    media.closeMedia();
  });

  test('identifier quelqu’un : il cite l’archive ; le retirer : il ne la cite plus ; la dernière personne reste', async () => {
    const { S, media, sid, citers } = await setup();
    const { undoAction } = await import('../js/services/storage.js');
    media.openArchive(sid);
    media.placePin({ querySelector: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100 }) }) }, { clientX: 50, clientY: 50, target: { closest: () => null } });
    await media.addTag('c');
    assert.deepEqual(citers(), ['a', 'b', 'c'], 'Jean ajouté : il cite l’archive');
    assert.deepEqual(S.sources.get(sid).tags.at(-1), { id: 'c', x: 25, y: 50 });
    await media.removeTag(1);
    assert.deepEqual(citers(), ['a', 'c'], 'Paul retiré : il ne la cite plus');
    assert.ok(!S.sources.get(sid).tags.some((x) => x.id === 'b'));
    await undoAction();
    assert.deepEqual(citers(), ['a', 'b', 'c'], 'Ctrl+Z');
    await media.removeTag(0);
    await media.removeTag(0);
    assert.deepEqual(citers(), ['c']);
    await media.removeTag(0);
    assert.deepEqual(citers(), ['c'], 'la dernière personne reste');
    assert.match(document.getElementById('toast').textContent, /au moins une personne/);
    assert.ok(S.sources.has(sid));
    media.closeMedia();
  });

  test('remettre dans la galerie : la même image, ses repères et sa lecture ; plus d’archive ni de citation', async () => {
    const { S, media, sid, citers } = await setup();
    const { undoAction } = await import('../js/services/storage.js');
    media.openArchive(sid);
    await media.archiveToGallery();
    assert.equal(S.sources.size, 0);
    assert.deepEqual(citers(), []);
    const [m] = [...S.media.values()];
    assert.equal(m.photo, 'data:image/png;base64,A');
    assert.equal(m.back, 'data:image/png;base64,V');
    assert.equal(m.title, 'Mariage');
    assert.equal(m.note, '1912 — à Lyon');
    assert.deepEqual(m.tags, [{ id: 'a', x: 10, y: 20 }, { id: 'b', x: 60, y: 30 }]);
    assert.equal(m.text.lines[0].text, 'Mariage');
    assert.equal(document.getElementById('mediaDlg').hidden, true, 'plus rien à montrer : la visionneuse se ferme');
    await undoAction();
    assert.ok(S.sources.has(sid), 'Ctrl+Z la remet aux archives');
    assert.equal(S.media.size, 0);
    assert.deepEqual(citers(), ['a', 'b']);
  });

  test('supprimer l’archive : après confirmation, elle quitte l’arbre et les fiches', async () => {
    const { S, media, sid, card, citers } = await setup();
    const { undoAction } = await import('../js/services/storage.js');
    media.openArchive(sid);
    media.askMediaDelete(true);
    assert.match(card(), /Supprimer cette archive/);
    await media.deleteMedia();
    assert.equal(S.sources.has(sid), false);
    assert.deepEqual(citers(), []);
    assert.equal(S.media.size, 0, 'pas remise dans la galerie');
    await undoAction();
    assert.deepEqual(citers(), ['a', 'b']);
  });

  test('une fiche qui cite l’archive, enregistrée par le formulaire, ne lui fait pas perdre ses repères', async () => {
    const { S, sid } = await setup();
    const { opUpdate } = await import('../js/services/storage.js');
    const { sourcesOf } = await import('../js/model/sources.js');
    const docs = sourcesOf(S.people.get('a'));
    await opUpdate('people', 'a', { birthPlace: 'Lyon', sources: docs });
    assert.equal(S.sources.get(sid).tags.length, 2, 'inchangée');
    await opUpdate('people', 'a', { sources: docs.map((d) => ({ ...d, title: 'Noces' })) });
    assert.equal(S.sources.get(sid).title, 'Noces');
    assert.equal(S.sources.get(sid).tags.length, 2, 'titre changé depuis la fiche : les repères restent');
  });

  test('légende d’une archive : titre et texte modifiés sur la source, sans date', async () => {
    const { S, media, sid, card } = await setup();
    media.openArchive(sid);
    media.editCaption(true);
    assert.doesNotMatch(card(), /mdEditDate/);
    document.getElementById('mdEditTitle').value = 'Noces';
    document.getElementById('mdEditNote').value = 'Lyon, 1912';
    await media.saveCaption();
    assert.equal(S.sources.get(sid).title, 'Noces');
    assert.equal(S.sources.get(sid).note, 'Lyon, 1912');
    media.closeMedia();
  });
});

describe('archives : icônes dans la liste', () => {
  test('flèche vers la galerie et poubelle sur chaque archive ; la poubelle demande confirmation dans la visionneuse', async () => {
    const { S } = await import('../js/state.js');
    const media = await import('../js/ui/media.js');
    const { mediaGroups } = await import('../js/ui/record.js');
    const { renderAnalysis } = await import('../js/ui/analysis.js');
    const { resetApp } = await import('./helpers.js');
    resetApp();
    loadTree([
      person('a', { given: 'Anne', surname: 'Roux', media: [{ id: 'm1', photo: 'data:image/png;base64,A', back: 'data:image/png;base64,V', title: 'Lettre', tags: [{ id: 'a', x: 5, y: 5 }] }] }),
    ]);
    mediaGroups.set('g', ['m1']);
    media.openMedia('m1', 'g');
    await media.archiveMedia();
    const [sid] = S.sources.keys();
    S.tab = 'analysis';
    S.analysis = 'archives';
    renderAnalysis();
    const pane = () => document.getElementById('paneAnalysis').innerHTML;
    assert.match(pane(), new RegExp(`data-act="archive-to-gallery" data-id="${sid}" aria-label="Remettre dans la galerie"[^>]*><svg`));
    assert.match(pane(), new RegExp(`data-act="archive-delete" data-id="${sid}" aria-label="Supprimer l’archive"[^>]*><svg`));
    assert.match(pane(), /data-act="archive-open"[^>]*data-back="1"/, 'la vignette du verso ouvre le verso');
    media.openArchive(sid, true);
    assert.match(document.getElementById('mediaCard').innerHTML, /<img src="data:image\/png;base64,V"/);
    media.closeMedia();
    // The bin: the viewer opens on the archive, the deletion asked under the image
    media.askArchiveDelete(sid);
    assert.equal(document.getElementById('mediaDlg').hidden, false);
    assert.match(document.getElementById('mediaCard').innerHTML, /Supprimer cette archive/);
    media.closeMedia();
    // The arrow: straight back to the gallery, without opening anything
    await media.archiveToGallery(sid);
    assert.equal(S.sources.size, 0);
    assert.equal(S.media.size, 1);
    assert.equal(document.getElementById('mediaDlg').hidden, true);
  });
});
