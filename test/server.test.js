import http from 'node:http';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer, safeName } from '../server.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const exists = (f) => access(f).then(() => true, () => false);
const backup = (name, people = []) => JSON.stringify({ format: 'lignee', version: 1, name, people, unions: [] });

let dataDir;
let server;
let base;

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'lignee-'));
  server = createServer({ dataDir });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/`;
});

after(async () => {
  server.close();
  await rm(dataDir, { recursive: true, force: true });
});

const api = (rel, init) => fetch(base + 'api/trees/' + rel, init);
const put = (id, body) => api(id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });

describe('arbres', () => {
  test('créer, lister, lire, supprimer', async () => {
    assert.deepEqual(await (await api('')).json(), []);
    assert.equal((await api('a1')).status, 404);

    assert.equal((await put('a1', backup('Famille A', [{ id: 'p1' }]))).status, 204);
    const list = await (await api('')).json();
    assert.deepEqual(list.map(({ id, name, count }) => ({ id, name, count })), [{ id: 'a1', name: 'Famille A', count: 1 }]);
    assert.equal((await (await api('a1')).json()).name, 'Famille A');
    assert.ok(!(await exists(path.join(dataDir, 'a1.json.tmp'))), 'pas de fichier temporaire restant');

    assert.equal((await api('a1', { method: 'DELETE' })).status, 204);
    assert.equal((await api('a1')).status, 404);
  });

  test('refuse ce qui n’est pas une sauvegarde Lignée', async () => {
    assert.equal((await put('a2', 'pas du JSON')).status, 400);
    assert.equal((await put('a2', '{"format":"autre","people":[],"unions":[]}')).status, 400);
    assert.equal((await api('a2')).status, 404);
  });

  test('identifiants invalides refusés', async () => {
    for (const id of ['..%2F..%2Fetc', 'a.b', '%2E%2E%2F', 'x'.repeat(65)]) {
      assert.equal((await api(id)).status, 400, id);
    }
  });

  test('écritures simultanées : la dernière arrivée gagne', async () => {
    await Promise.all(Array.from({ length: 10 }, (_, i) => put('a3', backup('v' + i))));
    assert.equal((await (await api('a3')).json()).name, 'v9');
  });
});

describe('sécurité et conflits', () => {
  const raw = (headers, method = 'GET', target = '/api/trees/') => new Promise((resolve, reject) => {
    const { port } = new URL(base);
    const req = http.request({ host: '127.0.0.1', port, path: target, method, headers }, (res) => {
      res.resume();
      res.on('end', () => resolve(res));
    });
    req.on('error', reject);
    req.end();
  });

  test('Host étranger (DNS rebinding) et Origin d’un autre site : refusés', async () => {
    assert.equal((await raw({ Host: 'pirate.example:8000' })).statusCode, 403);
    assert.equal((await raw({ Host: 'pirate.example' }, 'GET', '/data/arbres/a.json')).statusCode, 403);
    const local = '127.0.0.1:' + new URL(base).port;
    assert.equal((await raw({ Host: local, Origin: 'https://pirate.example' }, 'POST', '/api/trees/x/photos')).statusCode, 403);
    assert.equal((await raw({ Host: local, Origin: 'null' }, 'POST', '/api/trees/x/photos/sweep')).statusCode, 403);
    assert.equal((await raw({ Host: local })).statusCode, 200);
    assert.equal((await raw({ Host: 'localhost:8000', Origin: 'http://localhost:8000' })).statusCode, 200);
  });

  test('en-têtes de protection', async () => {
    const res = await fetch(base);
    assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  });

  test('If-Match : une version périmée n’écrase pas l’arbre', async () => {
    await put('v1', backup('A'));
    const etag = (await api('v1')).headers.get('etag');
    const write = (name, tag) => api('v1', { method: 'PUT', headers: { 'If-Match': tag }, body: backup(name) });
    const first = await write('B', etag);
    assert.equal(first.status, 204);
    assert.equal(first.headers.get('etag'), (await api('v1')).headers.get('etag'));
    assert.equal((await write('C', etag)).status, 409);
    assert.equal((await (await api('v1')).json()).name, 'B');
    assert.equal((await write('C', first.headers.get('etag'))).status, 204);
  });
});

describe('photos', () => {
  test('enregistrée dans data/arbres/<id>/photos/, conservée au renommage, supprimée quand plus citée', async () => {
    await put('t1', backup('Mon arbre'));
    const res = await api('t1/photos', { method: 'POST', body: JSON.stringify({ label: 'DUPONT-Jean', data: PNG }) });
    assert.equal(res.status, 201);
    const { photo } = await res.json();
    assert.match(photo, /^photos\/DUPONT-Jean-[0-9a-f-]{36}\.png$/);
    const file = path.join(dataDir, 't1', photo);
    assert.ok(await exists(file));

    const got = await api('t1/' + photo);
    assert.equal(got.status, 200);
    assert.equal(got.headers.get('content-type'), 'image/png');

    // Renommage : la photo ne bouge pas
    await put('t1', backup('Autre nom', [{ id: 'p1', photo }]));
    assert.ok(await exists(file));

    // Photo retirée de la fiche : fichier et dossiers vides supprimés
    await put('t1', backup('Autre nom', [{ id: 'p1' }]));
    assert.ok(!(await exists(file)));
    assert.ok(!(await exists(path.join(dataDir, 't1'))));
  });

  test('keepPhotos garde une photo retirée (Annuler) ; le balayage efface ce qui n’est plus cité', async () => {
    const post = async () => (await (await api('t9/photos', { method: 'POST', body: JSON.stringify({ label: 'A', data: PNG }) })).json()).photo;
    const [kept, document, dropped] = [await post(), await post(), await post()];
    const inGallery = await post();
    await put('t9', backup('X', [{ id: 'p', photo: kept, sources: [{ id: 's', photo: document }], media: [{ id: 'm', photo: inGallery }] }, { id: 'q', photo: dropped }]));
    const res = await api('t9?keepPhotos=1', { method: 'PUT', body: backup('X', [{ id: 'p', photo: kept, sources: [{ id: 's', photo: document }], media: [{ id: 'm', photo: inGallery }] }]) });
    assert.equal(res.status, 204);
    assert.ok(await exists(path.join(dataDir, 't9', dropped)), 'gardée pour Annuler');
    assert.equal((await api('t9/photos/sweep', { method: 'POST' })).status, 204);
    assert.ok(!(await exists(path.join(dataDir, 't9', dropped))), 'plus citée : effacée');
    assert.ok(await exists(path.join(dataDir, 't9', kept)));
    assert.ok(await exists(path.join(dataDir, 't9', document)), 'document d’une source conservé');
    assert.ok(await exists(path.join(dataDir, 't9', inGallery)), 'image de la galerie conservée');
  });

  test('suppression de l’arbre : ses photos aussi', async () => {
    await put('t2', backup('X'));
    const { photo } = await (await api('t2/photos', { method: 'POST', body: JSON.stringify({ label: 'A', data: PNG }) })).json();
    await put('t2', backup('X', [{ id: 'p', photo }]));
    await api('t2', { method: 'DELETE' });
    assert.ok(!(await exists(path.join(dataDir, 't2'))));
  });

  test('contenus et noms refusés', async () => {
    const post = (data) => api('t3/photos', { method: 'POST', body: JSON.stringify({ label: 'A', data }) });
    assert.equal((await post('data:text/html;base64,PGI+')).status, 400);
    assert.equal((await post('https://exemple.org/a.png')).status, 400);
    assert.equal((await api('t3/photos/..%2F..%2Ft1.json')).status, 400);
    assert.equal((await api('t3/photos/a.exe')).status, 400);
    assert.equal((await api('t3/photos/absente.jpg')).status, 404);
  });
});

describe('fichiers de l’application', () => {
  test('index.html servi à la racine', async () => {
    const res = await fetch(base);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
  });

  test('pas de sortie du dossier de l’application', async () => {
    const res = await fetch(base + '%2E%2E/%2E%2E/etc/passwd');
    assert.ok([403, 404].includes(res.status));
    assert.ok(!(await res.text()).includes('root:'));
  });

  test('méthodes non prévues', async () => {
    assert.equal((await fetch(base, { method: 'POST' })).status, 405);
    assert.equal((await api('', { method: 'DELETE' })).status, 405);
  });
});

test('safeName : noms de fichier sûrs', () => {
  assert.equal(safeName('a/b\\c:d*e?f"g<h>i|j', 'x'), 'a-b-c-d-e-f-g-h-i-j');
  assert.equal(safeName('  ..caché  ', 'x'), 'caché');
  assert.equal(safeName('', 'défaut'), 'défaut');
  assert.equal(safeName('n'.repeat(200), 'x').length, 80);
});
