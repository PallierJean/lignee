import assert from 'node:assert/strict';
import { test, describe, before, after } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cosine, faceAt, largestFace, knownFaces, suggestFaces, faceRefs, SAME } from '../js/model/faces.js';
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

  test('suggestions : au-dessus du seuil, une personne par visage, sans les visages ni les personnes déjà repérés', () => {
    const known = new Map([['a', [ANNE]], ['l', [LOUIS]], ['p', [PAUL]]]);
    const faces = [
      face(0.6, 0.1, 0.2, 0.2, [0.1, 0.9, 0]),  // Louis
      face(0.1, 0.1, 0.2, 0.2, [0.95, 0.3, 0]), // Anne
      face(0.35, 0.1, 0.2, 0.2, [0.8, 0.5, 0]), // ressemble à Anne, moins : elle est déjà prise
      face(0.4, 0.6, 0.2, 0.2, [1, 1, 1]),      // proche d'Anne et de Louis, déjà pris tous deux
    ];
    const got = suggestFaces(faces, new Map([...known].filter(([id]) => id !== 'p')), []);
    assert.deepEqual(got.map((g) => [g.id, g.x, g.y]), [['a', 20, 20], ['l', 70, 20]], 'chacun sur son visage le plus proche, de gauche à droite');
    assert.ok(got.every((g) => g.score >= SAME));
    const tagged = suggestFaces(faces, known, [{ id: 'l', x: 70, y: 20 }, { id: 'p' }]);
    assert.ok(!tagged.some((g) => g.id === 'l'), 'Louis déjà repéré');
    assert.ok(tagged.some((g) => g.id === 'p'), 'Paul sur l’image sans repère : suggéré');
    assert.ok(!tagged.some((g) => g.x === 70), 'le visage de Louis n’est plus proposé');
    assert.deepEqual(suggestFaces([face(0, 0, 0.1, 0.1, [1, -1, 0])], new Map([['a', [[-1, 1, 0]]]])), [], 'trop différent');
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
