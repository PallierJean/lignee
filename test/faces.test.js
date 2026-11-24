import assert from 'node:assert/strict';
import { test, describe, before, after } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cosine, faceAt, largestFace, knownFaces, suggestFaces, faceRefs, unknownGroups, portraitFaces, galleryImages, withoutPortrait, SAME } from '../js/model/faces.js';
import { faceView, FRAME } from '../js/ui/crop.js';
import { createServer } from '../server.js';
import { loadTree, person, resetApp } from './helpers.js';

// Faces as the worker gives them: a box in fractions of the image, a vector
const face = (x, y, w, h, vec) => ({ box: [x, y, w, h], score: 0.9, vec });
const ANNE = [1, 0, 0];
const LOUIS = [0, 1, 0];
const PAUL = [0, 0, 1];

describe('visages : correspondances', () => {
  test('cosinus ; visage sous un repère (dans le cadre, ou tout près) ; plus grand visage', () => {
    assert.equal(cosine([1, 0], [2, 0]), 1);
    assert.equal(cosine([1, 0], [0, 3]), 0);
    assert.equal(cosine([0, 0], [1, 0]), 0, 'vecteur nul : rien');
    const a = face(0.1, 0.1, 0.2, 0.2, ANNE);
    const b = face(0.6, 0.1, 0.1, 0.1, LOUIS);
    assert.equal(faceAt([a, b], 20, 20), a);
    assert.equal(faceAt([a, b], 66, 23), b, 'repère sur le menton, juste sous le cadre');
    assert.equal(faceAt([a, b], 50, 90), null, 'loin de tout visage');
    assert.equal(faceAt([], 20, 20), null);
    assert.equal(largestFace([b, a]), a);
    assert.equal(largestFace([]), null);
  });

  test('visages connus : sous les repères, ou le plus grand d’un portrait ; nombre limité par personne', () => {
    const photo = [face(0.1, 0.1, 0.2, 0.2, ANNE), face(0.6, 0.1, 0.2, 0.2, LOUIS)];
    const known = knownFaces([
      { id: 'a', faces: [face(0, 0, 0.9, 0.9, ANNE), face(0, 0, 0.1, 0.1, PAUL)] }, // portrait
      { id: 'l', faces: photo, x: 70, y: 20 },
      { id: 'a', faces: photo, x: 20, y: 20 },
      { id: 'p', faces: photo, x: 50, y: 90 }, // repère hors d'un visage : rien
      { id: 'x', faces: [] },
      { faces: photo },
    ]);
    assert.deepEqual([...known], [['a', [ANNE, ANNE]], ['l', [LOUIS]]]);
    assert.equal(knownFaces([{ id: 'a', faces: photo, x: 20, y: 20 }, { id: 'a', faces: photo, x: 20, y: 20 }], 1).get('a').length, 1);
  });

  test('visages sans repère : suggestions au-dessus du seuil, une personne par visage ; les autres sans nom', () => {
    const known = new Map([['a', [ANNE]], ['l', [LOUIS]], ['p', [PAUL]]]);
    const faces = [
      face(0.6, 0.1, 0.2, 0.2, [0.1, 0.9, 0]),  // Louis
      face(0.1, 0.1, 0.2, 0.2, [0.95, 0.3, 0]), // Anne
      face(0.35, 0.1, 0.2, 0.2, [0.8, 0.5, 0]), // ressemble à Anne, moins : elle est déjà prise
      face(0.4, 0.6, 0.2, 0.2, [1, 1, 1]),      // proche d'Anne et de Louis, déjà pris tous deux
    ];
    const got = suggestFaces(faces, new Map([...known].filter(([id]) => id !== 'p')), []);
    assert.deepEqual(got.map((g) => [g.id, g.x, g.y, g.w]), [['a', 20, 20, 20], [undefined, 45, 20, 20], [undefined, 50, 70, 20], ['l', 70, 20, 20]],
      'chacun sur son visage le plus proche ; les autres visages sans nom, de gauche à droite');
    assert.deepEqual(got[0].box, [0.1, 0.1, 0.2, 0.2]);
    assert.ok(got.filter((g) => g.id).every((g) => g.score >= SAME));
    assert.ok(!('score' in got[1]));
    const tagged = suggestFaces(faces, known, [{ id: 'l', x: 70, y: 20 }, { id: 'p' }]);
    assert.ok(!tagged.some((g) => g.id === 'l'), 'Louis déjà repéré');
    assert.ok(tagged.some((g) => g.id === 'p'), 'Paul sur l’image sans repère : suggéré');
    assert.ok(!tagged.some((g) => g.x === 70), 'le visage de Louis n’est plus proposé');
    assert.deepEqual(suggestFaces([face(0, 0, 0.1, 0.1, [1, -1, 0])], new Map([['a', [[-1, 1, 0]]]])).map((g) => g.id), [undefined], 'trop différent : sans nom');
  });

  test('ce que l’arbre enregistré connaît : portraits, repères de la galerie (récents d’abord) et des archives', () => {
    const tree = {
      people: [{ id: 'a', photo: 'photos/ROUX_Anne/p.jpg' }, { id: 'b', photo: 'data:image/png;base64,A' }, { id: 'c' }],
      media: [
        { id: 'm1', photo: 'photos/galerie/old.jpg', createdAt: 1, tags: [{ id: 'b', x: 10, y: 10 }, { id: 'c' }] },
        { id: 'm2', photo: 'photos/galerie/new.jpg', createdAt: 2, tags: [{ id: 'c', x: 50, y: 50 }] },
        { id: 'm3', photo: 'photos/galerie/this.jpg', tags: [{ id: 'a', x: 30, y: 30 }, { id: 'b' }] },
      ],
      sources: [{ id: 'S1', kind: 'family', photo: 'photos/archives/s.jpg', tags: [{ id: 'a', x: 5, y: 5 }] }, { id: 'S2', title: 'Acte' }],
    };
    assert.deepEqual(faceRefs(tree, 'photos/galerie/this.jpg'), {
      tags: [{ id: 'a', x: 30, y: 30 }],
      refs: [
        { id: 'a', photo: 'photos/ROUX_Anne/p.jpg' },
        { id: 'c', photo: 'photos/galerie/new.jpg', x: 50, y: 50 },
        { id: 'b', photo: 'photos/galerie/old.jpg', x: 10, y: 10 },
        { id: 'a', photo: 'photos/archives/s.jpg', x: 5, y: 5 },
      ],
    });
    assert.deepEqual(faceRefs(null, 'photos/x.jpg'), { tags: [], refs: [] });
  });
});

describe('visages : groupes d’inconnus et portraits', () => {
  test('inconnus regroupés d’une photo à l’autre, jamais deux visages d’une même photo ; repérés et connus à part', () => {
    const x = [0.9, 0.1, 0.4];
    const images = [
      { photo: 'photos/g/1.jpg', faces: [face(0.1, 0.1, 0.1, 0.1, x), face(0.5, 0.1, 0.1, 0.1, [0.88, 0.12, 0.41]), face(0.8, 0.1, 0.1, 0.1, [-1, 0, 0])], tags: [] },
      { photo: 'photos/g/2.jpg', faces: [face(0.2, 0.2, 0.1, 0.1, [0.91, 0.09, 0.39]), face(0.6, 0.2, 0.1, 0.1, [0, 0.2, 1])], tags: [{ id: 'p', x: 65, y: 25 }] },
      { photo: 'photos/g/3.jpg', faces: [face(0.3, 0.3, 0.2, 0.2, [0, -1, 0])] },
    ];
    const groups = unknownGroups(images, new Map([['a', [[-1, 0, 0]]]]));
    assert.equal(groups.length, 1, 'Anne connue, Paul repéré, le visage seul sans groupe');
    assert.deepEqual(groups[0].faces.map((f) => [f.photo, f.x, f.y]).sort(), [['photos/g/1.jpg', 15, 15], ['photos/g/2.jpg', 25, 25]],
      'sur la photo 1, un seul des deux visages semblables');
    assert.deepEqual(groups[0].faces[0].box.length, 4);
    assert.deepEqual(unknownGroups([], new Map()), []);
  });

  test('portrait : le visage le plus grand en pixels sous un repère, pour ceux qui n’en ont pas', () => {
    const big = [face(0.1, 0.1, 0.1, 0.1, ANNE)];
    const refs = [
      { id: 'a', photo: 'photos/g/small.jpg', faces: big, size: [400, 300], x: 15, y: 15 },
      { id: 'a', photo: 'photos/g/large.jpg', faces: big, size: [2000, 1500], x: 15, y: 15 },
      { id: 'a', photo: 'photos/g/miss.jpg', faces: big, size: [4000, 3000], x: 90, y: 90 },
      { id: 'a', photo: 'photos/a.jpg', faces: big },
      { id: 'b', photo: 'photos/g/large.jpg', faces: big, size: [2000, 1500], x: 15, y: 15 },
    ];
    assert.deepEqual(portraitFaces(refs, new Set(['a'])), [{ id: 'a', photo: 'photos/g/large.jpg', x: 15, y: 15, w: 10, box: [0.1, 0.1, 0.1, 0.1] }]);
    const tree = {
      people: [{ id: 'a', photo: 'photos/a.jpg' }, { id: 'b' }, { id: 'c', photo: '' }],
      media: [{ id: 'm', photo: 'photos/g/1.jpg', tags: [{ id: 'b', x: 1, y: 2 }, { id: 'c' }] }, { id: 'n', photo: 'data:image/png;base64,A' }],
    };
    assert.deepEqual([...withoutPortrait(tree)], ['b', 'c']);
    assert.deepEqual(galleryImages(tree), [{ photo: 'photos/g/1.jpg', tags: [{ id: 'b', x: 1, y: 2 }] }]);
  });

  test('recadrage d’un portrait : le visage au milieu du cadre, zoom au-delà de l’ordinaire si le visage est petit', () => {
    const min = Math.max(FRAME.w / 2000, FRAME.h / 1500);
    const v = faceView([0.45, 0.45, 0.05, 0.05], 2000, 1500, min);
    const cx = v.x + 0.475 * 2000 * v.scale;
    const cy = v.y + 0.475 * 1500 * v.scale;
    assert.ok(Math.abs(cx - FRAME.w / 2) < 1e-6 && Math.abs(cy - FRAME.h / 2) < 1e-6, 'centré');
    assert.ok(v.scale > min * 4 && v.max === v.scale, 'petit visage : zoom permis jusque-là');
    const edge = faceView([0, 0, 0.5, 0.5], 400, 500, Math.max(FRAME.w / 400, FRAME.h / 500));
    assert.deepEqual([edge.x, edge.y], [0, 0], 'au bord : le cadre reste rempli');
  });
});

describe('visages : serveur local', () => {
  let dataDir;
  let srv;
  let url;
  const asked = [];
  before(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'lignee-faces-'));
    await mkdir(path.join(dataDir, 'arbre', 'photos', 'galerie'), { recursive: true });
    await writeFile(path.join(dataDir, 'arbre', 'photos', 'galerie', 'g-1.jpg'), 'x');
    await writeFile(path.join(dataDir, 'arbre.json'), JSON.stringify({
      format: 'lignee', version: 3, name: 'Arbre', unions: [],
      people: [{ id: 'a', given: 'Anne', photo: 'photos/ROUX_Anne/p.jpg' }],
      sources: [],
      media: [
        { id: 'm1', photo: 'photos/galerie/g-1.jpg', tags: [{ id: 'a', x: 20, y: 20 }] },
        { id: 'm2', photo: 'photos/galerie/g-2.jpg', tags: [{ id: 'l', x: 70, y: 20 }] },
      ],
    }));
    const faces = {
      status: async () => ({ ready: true }),
      find: async (file, refs, tags) => {
        asked.push({ file, refs, tags });
        return [{ x: 70, y: 20, id: 'l', score: 0.8 }];
      },
      overview: async (images, refs, ids) => {
        asked.push({ images, refs, ids: [...ids] });
        return { groups: [], portraits: [] };
      },
    };
    srv = createServer({ dataDir, faces });
    await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
    url = (rel) => `http://127.0.0.1:${srv.address().port}/${rel}`;
  });
  after(async () => {
    srv.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  test('état ; visages d’une photo, d’après l’arbre enregistré ; nom invalide, photo absente, méthode refusée', async () => {
    assert.deepEqual(await (await fetch(url('api/faces'))).json(), { ready: true });
    assert.equal((await fetch(url('api/faces'), { method: 'POST' })).status, 405);
    const r = await fetch(url(`api/trees/arbre/photos/${encodeURIComponent('galerie/g-1.jpg')}/faces`), { method: 'POST' });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { faces: [{ x: 70, y: 20, id: 'l', score: 0.8 }] });
    const photos = path.join(dataDir, 'arbre', 'photos');
    assert.deepEqual(asked, [{
      file: path.join(photos, 'galerie', 'g-1.jpg'),
      refs: [{ id: 'a', file: path.join(photos, 'ROUX_Anne', 'p.jpg') }, { id: 'l', file: path.join(photos, 'galerie', 'g-2.jpg'), x: 70, y: 20 }],
      tags: [{ id: 'a', x: 20, y: 20 }],
    }]);
    assert.equal((await fetch(url('api/trees/arbre/photos/..%2Fsecret.jpg/faces'), { method: 'POST' })).status, 400);
    assert.equal((await fetch(url('api/trees/arbre/photos/absente.jpg/faces'), { method: 'POST' })).status, 404);
    assert.equal((await fetch(url('api/trees/arbre/photos/g.jpg/faces'))).status, 405);
    assert.equal(asked.length, 1);

    // Toute la galerie
    const all = await fetch(url('api/trees/arbre/faces'));
    assert.deepEqual(await all.json(), { groups: [], portraits: [] });
    assert.deepEqual(asked[1].images.map((x) => x.file), [path.join(photos, 'galerie', 'g-1.jpg'), path.join(photos, 'galerie', 'g-2.jpg')]);
    assert.equal(asked[1].refs.length, 3, 'le portrait et les deux repères');
    assert.deepEqual(asked[1].ids, []);
    assert.equal((await fetch(url('api/trees/autre/faces'))).status, 404);
    assert.equal((await fetch(url('api/trees/arbre/faces'), { method: 'POST' })).status, 405);
  });
});

describe('visages : suggestions dans la visionneuse', () => {
  const nativeFetch = globalThis.fetch;
  after(() => { globalThis.fetch = nativeFetch; });

  test('marqueurs en pointillés et noms à confirmer ; confirmer (annulable), tout confirmer, écarter', async () => {
    const { S } = await import('../js/state.js');
    const media = await import('../js/ui/media.js');
    const { undoAction } = await import('../js/services/storage.js');
    const { checkFaces } = await import('../js/services/faces.js');
    resetApp();
    const asked = [];
    let answer = [{ x: 20, y: 30, id: 'a', score: 0.7 }, { x: 60, y: 30, id: 'l', score: 0.5 }, { x: 80, y: 30, id: 'p', score: 0.4 }];
    globalThis.fetch = async (u, init) => {
      if (String(u) === 'api/faces') return new Response(JSON.stringify({ ready: true }));
      if (String(u).endsWith('/faces') && init && init.method === 'POST') {
        asked.push(String(u));
        return new Response(JSON.stringify({ faces: answer }));
      }
      return new Response('{}');
    };
    loadTree([
      person('a', { given: 'Anne', surname: 'Roux', media: [{ id: 'm1', photo: 'photos/galerie/g-1.jpg', tags: [] }] }),
      person('l', { given: 'Louis', surname: 'Roux' }),
      person('p', { given: 'Paul', surname: 'Roux' }),
    ]);
    S.mode = 'file';
    S.tree = 'arbre';
    S.canWrite = true;
    assert.equal(await checkFaces(), true);
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
    const card = () => document.getElementById('mediaCard').innerHTML;

    media.openMedia('m1');
    assert.match(card(), /Recherche des visages connus/);
    await settle();
    assert.deepEqual(asked, ['api/trees/arbre/photos/galerie%2Fg-1.jpg/faces']);
    assert.match(card(), /Visages reconnus <span class="n">3<\/span>/);
    assert.match(card(), /class="tag-pin guess" type="button" data-guess="0" data-style="left:20%;top:30%" data-act="guess-yes" data-id="a"/);
    assert.match(card(), /data-act="guess-all">Tout confirmer \(3\)/);

    await media.acceptGuesses(['a']);
    assert.deepEqual(S.media.get('m1').tags, [{ id: 'a', x: 20, y: 30 }], 'Anne, déjà sur l’image sans repère : son repère');
    assert.match(card(), /Visages reconnus <span class="n">2<\/span>/);
    await undoAction();
    assert.deepEqual(S.media.get('m1').tags, [{ id: 'a' }], 'Ctrl+Z');

    media.dismissGuess('p');
    assert.doesNotMatch(card(), /data-id="p"/, 'Paul écarté');
    await media.acceptGuesses();
    assert.deepEqual(S.media.get('m1').tags, [{ id: 'a', x: 20, y: 30 }, { id: 'l', x: 60, y: 30 }]);
    assert.doesNotMatch(card(), /Visages reconnus/, 'plus rien à confirmer');
    assert.equal(asked.length, 1, 'une seule recherche par image');

    // Hors du serveur local (ou en lecture seule) : rien n'est cherché
    media.closeMedia();
    answer = [];
    S.canWrite = false;
    media.openMedia('m1');
    assert.doesNotMatch(card(), /Recherche des visages/);
    media.closeMedia();
    S.canWrite = true;
    S.mode = 'local';
  });
});

describe('visages : inconnus dans la visionneuse', () => {
  const nativeFetch = globalThis.fetch;
  after(() => { globalThis.fetch = nativeFetch; });

  test('un visage non reconnu se clique : le repère s’y place, on choisit la personne', async () => {
    const { S } = await import('../js/state.js');
    const media = await import('../js/ui/media.js');
    const { checkFaces } = await import('../js/services/faces.js');
    resetApp();
    globalThis.fetch = async (u) => {
      if (String(u) === 'api/faces') return new Response(JSON.stringify({ ready: true }));
      if (String(u).endsWith('/faces')) return new Response(JSON.stringify({ faces: [{ x: 40, y: 30, w: 8, box: [0.36, 0.25, 0.08, 0.1] }] }));
      return new Response('{}');
    };
    loadTree([person('a', { given: 'Anne', surname: 'Roux', media: [{ id: 'm1', photo: 'photos/galerie/g-2.jpg', tags: [] }] })]);
    S.mode = 'file';
    S.tree = 'arbre';
    S.canWrite = true;
    await checkFaces();
    const card = () => document.getElementById('mediaCard').innerHTML;
    media.openMedia('m1');
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.match(card(), /class="tag-pin face" type="button" data-style="left:40%;top:30%;width:max\(32px,10.4%\)" data-act="face-pick" data-x="40" data-y="30"/);
    assert.doesNotMatch(card(), /Visages reconnus/);
    media.pickFace(40, 30);
    assert.match(card(), /id="tagFind"/, 'qui est-ce ?');
    assert.match(card(), /class="tag-pin new" data-style="left:40%;top:30%"/);
    assert.doesNotMatch(card(), /tag-pin face/, 'les visages s’effacent le temps du choix');
    await media.addTag('a');
    assert.deepEqual(S.media.get('m1').tags, [{ id: 'a', x: 40, y: 30 }]);
    assert.doesNotMatch(card(), /tag-pin face/, 'visage repéré : plus proposé');
    media.closeMedia();
    S.mode = 'local';
  });
});

describe('visages : fenêtre « Visages à identifier »', () => {
  const nativeFetch = globalThis.fetch;
  const realCreate = document.createElement;
  const realImage = globalThis.Image;
  after(() => {
    globalThis.fetch = nativeFetch;
    document.createElement = realCreate;
    globalThis.Image = realImage;
  });

  test('nommer un groupe (sans le visage retiré), annulable ; ignorer ; choisir un portrait recadré', async () => {
    const { S } = await import('../js/state.js');
    const faces = await import('../js/ui/faces.js');
    const { galleryHTML } = await import('../js/ui/analysis.js');
    const { cropOpen, closeCrop } = await import('../js/ui/crop.js');
    const { undoAction } = await import('../js/services/storage.js');
    const { checkFaces } = await import('../js/services/faces.js');
    resetApp();
    const box = [0.1, 0.1, 0.1, 0.1];
    const stored = [];
    globalThis.fetch = async (u, init) => {
      if (String(u) === 'api/faces') return new Response(JSON.stringify({ ready: true }));
      if (String(u) === 'api/trees/arbre/faces') {
        return new Response(JSON.stringify({
          groups: [
            { faces: [{ photo: 'photos/g/1.jpg', x: 15, y: 15, w: 10, box }, { photo: 'photos/g/2.jpg', x: 30, y: 40, w: 10, box }, { photo: 'photos/g/3.jpg', x: 50, y: 50, w: 10, box }] },
            { faces: [{ photo: 'photos/g/1.jpg', x: 70, y: 15, w: 10, box }, { photo: 'photos/g/3.jpg', x: 80, y: 50, w: 10, box }] },
          ],
          portraits: [{ id: 'p', photo: 'photos/g/2.jpg', x: 30, y: 40, w: 10, box }, { id: 'a', photo: 'photos/g/1.jpg', x: 1, y: 1, w: 1, box }],
        }));
      }
      if (String(u).startsWith('api/trees/arbre/photos/g%2F')) return new Response(new Blob(['x'], { type: 'image/jpeg' }));
      if (String(u).endsWith('/photos') && init && init.method === 'POST') {
        stored.push(JSON.parse(init.body).folder);
        return new Response(JSON.stringify({ photo: 'photos/ROUX_Paul/p.jpg' }));
      }
      return new Response('{}');
    };
    globalThis.URL.createObjectURL = () => 'blob:x';
    globalThis.URL.revokeObjectURL = () => {};
    globalThis.Image = class {
      naturalWidth = 1000;
      naturalHeight = 800;
      decode = async () => {};
    };
    document.createElement = (tag) => {
      const el = realCreate(tag);
      el.getContext = () => ({ fillRect() {}, drawImage() {} });
      el.toDataURL = () => 'data:image/jpeg;base64,CROP';
      return el;
    };
    loadTree([
      person('a', { given: 'Anne', surname: 'Roux', photo: 'photos/ROUX_Anne/a.jpg', media: [
        { id: 'm1', photo: 'photos/g/1.jpg', tags: [] },
        { id: 'm2', photo: 'photos/g/2.jpg', tags: [{ id: 'l' }] },
        { id: 'm3', photo: 'photos/g/3.jpg', tags: [] },
      ] }),
      person('l', { given: 'Louis', surname: 'Roux', sex: 'M' }),
      person('p', { given: 'Paul', surname: 'Roux' }),
    ]);
    S.mode = 'file';
    S.tree = 'arbre';
    S.canWrite = true;
    await checkFaces();
    assert.match(galleryHTML('all'), /data-act="faces-open">Visages à identifier/);

    const card = () => document.getElementById('facesCard').innerHTML;
    faces.openFaces();
    assert.match(card(), /Recherche des visages dans la galerie/);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.match(card(), /Même personne sur plusieurs photos <span class="n">2<\/span>/);
    assert.match(card(), /Sur 3 photos/);
    assert.match(card(), /class="face-thumb"><img src="api\/trees\/arbre\/photos\/g%2F1.jpg" alt="" loading="lazy" data-style="width:625.00%;transform:translate\(-7.00%,-7.00%\)"/);
    assert.match(card(), /Portraits à ajouter <span class="n">1<\/span>/, 'Anne a déjà le sien');

    faces.onFacesFind(0, 'louis');
    assert.match(document.getElementById('fcHits0').innerHTML, /data-act="fc-name" data-g="0" data-id="l">Louis/);
    faces.dropFace(0, 2);
    assert.match(card(), /Sur 2 photos/);
    await faces.nameGroup(0, 'l');
    assert.deepEqual(S.media.get('m1').tags, [{ id: 'a' }, { id: 'l', x: 15, y: 15 }]);
    assert.deepEqual(S.media.get('m2').tags, [{ id: 'a' }, { id: 'l', x: 30, y: 40 }], 'Louis, sur la photo sans repère : son repère');
    assert.deepEqual(S.media.get('m3').tags, [{ id: 'a' }], 'le visage retiré');
    assert.equal(document.getElementById('toast').textContent, 'Louis ROUX identifié sur 2 photos');
    assert.match(card(), /Même personne sur plusieurs photos <span class="n">1<\/span>/);
    await undoAction();
    assert.deepEqual(S.media.get('m1').tags, [{ id: 'a' }], 'Ctrl+Z, en une fois');
    assert.deepEqual(S.media.get('m2').tags, [{ id: 'a' }, { id: 'l' }]);

    faces.skipGroup(1);
    assert.doesNotMatch(card(), /Même personne/);

    const chosen = faces.choosePortrait('p');
    for (let i = 0; i < 20 && !cropOpen(); i++) await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(cropOpen(), 'le recadrage s’ouvre sur le visage');
    assert.ok(+document.getElementById('cropZoom').max >= 4, 'zoom permis jusqu’au visage');
    closeCrop(true);
    await chosen;
    assert.equal(S.people.get('p').photo, 'photos/ROUX_Paul/p.jpg');
    assert.deepEqual(stored, ['ROUX_Paul']);
    assert.match(card(), /Rien à proposer/);
    await undoAction();
    assert.equal(S.people.get('p').photo || '', '', 'Ctrl+Z');

    faces.closeFaces();
    assert.equal(faces.facesOpen(), false);
    S.mode = 'local';
  });
});
