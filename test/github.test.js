import assert from 'node:assert/strict';
import { test, describe, beforeEach, afterEach } from 'node:test';
import { S } from '../js/state.js';
import { parseRepo, openRepo, attachPhotos } from '../js/services/github.js';
import { readImportFile, importGo, importRepo, pickRepoBackup, openTransfer } from '../js/ui/transfer.js';
import { photoOf } from '../js/model/people.js';
import { resetApp, html } from './helpers.js';

const el = (id) => document.getElementById(id);
const nativeFetch = globalThis.fetch;
const backup = (extra = {}) => JSON.stringify({ format: 'lignee', name: 'Famille', people: [{ id: 'a', given: 'Ana', photo: 'photos/Ané.jpg', ...extra }], unions: [] });
let calls;

/** Faux GitHub : `files` associe un chemin à son contenu. */
function serve(files, status) {
  calls = [];
  const paths = Object.keys(files);
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, auth: init.headers && init.headers.Authorization });
    if (status) return new Response('', { status });
    if (url.includes('/git/trees/')) {
      return Response.json({ tree: [...paths.map((path) => ({ type: 'blob', path, sha: 'sha-' + paths.indexOf(path) })), { type: 'tree', path: 'x' }] });
    }
    const sha = url.match(/\/git\/blobs\/sha-(\d+)$/);
    const path = sha ? paths[sha[1]] : decodeURIComponent(url.split('/HEAD/')[1]);
    return path in files ? new Response(files[path]) : new Response('', { status: 404 });
  };
}

beforeEach(() => {
  resetApp();
  S.pending = null;
  el('repoUrl').value = 'compte/depot';
  el('repoToken').value = '';
});

afterEach(() => { globalThis.fetch = nativeFetch; });

describe('adresse du dépôt', () => {
  test('formes acceptées', () => {
    const expected = { owner: 'PallierJean', repo: 'my-familly' };
    for (const s of [
      'https://github.com/PallierJean/my-familly', ' https://github.com/PallierJean/my-familly/ ',
      'https://github.com/PallierJean/my-familly.git', 'https://github.com/PallierJean/my-familly/tree/main',
      'git@github.com:PallierJean/my-familly.git', 'PallierJean/my-familly',
    ]) assert.deepEqual(parseRepo(s), expected, s);
  });

  test('refuse le reste', () => {
    for (const s of ['', 'PallierJean', 'https://evil.example/a/b', 'https://github.com.evil.example/a/b', 'a/..', 'a b/c']) {
      assert.equal(parseRepo(s), null, s);
    }
  });
});

describe('lecture du dépôt', () => {
  test('dépôt public : fichiers lus sans jeton sur raw', async () => {
    serve({ 'principal.json': backup(), 'principal/photos/Ané.jpg': 'img', 'package.json': '{}' });
    const repo = await openRepo('compte/depot', '');
    assert.equal(repo.backups.length, 1);
    assert.ok(calls.some((c) => c.url.startsWith('https://raw.githubusercontent.com/compte/depot/HEAD/principal.json')));
    assert.ok(!calls.some((c) => c.url.endsWith('package.json')));
    assert.ok(calls.every((c) => !c.auth));
  });

  test('dépôt privé : le jeton ne part que vers l’API', async () => {
    serve({ 'principal.json': backup(), 'principal/photos/Ané.jpg': 'img' });
    const repo = await openRepo('compte/depot', 'jeton');
    await attachPhotos(repo, repo.backups[0]);
    assert.ok(calls.length >= 3);
    for (const c of calls) {
      assert.ok(c.url.startsWith('https://api.github.com/repos/compte/depot/'));
      assert.equal(c.auth, 'Bearer jeton');
    }
  });

  test('photo dans <sauvegarde>/photos/, accents sous une autre forme', async () => {
    serve({ 'principal.json': backup(), ['principal/photos/Ané.jpg'.normalize('NFD')]: 'img' });
    const repo = await openRepo('compte/depot', '');
    const count = await attachPhotos(repo, repo.backups[0]);
    assert.deepEqual(count, { found: 1, missing: 0 });
    assert.equal(repo.backups[0].people[0].data.photo, 'data:image/jpeg;base64,' + btoa('img'));
  });

  test('photo à côté du fichier ; sources et médias convertis ; absente : retirée', async () => {
    const people = { sources: [{ title: 'Acte', photo: 'photos/acte.png' }], media: [{ photo: 'photos/manque.gif' }] };
    serve({ 'data/arbre.json': backup(people), 'data/photos/Ané.jpg': 'img', 'data/photos/acte.png': 'doc' });
    const repo = await openRepo('compte/depot', '');
    const count = await attachPhotos(repo, repo.backups[0]);
    const p = repo.backups[0].people[0].data;
    assert.deepEqual(count, { found: 2, missing: 1 });
    assert.match(p.sources[0].photo, /^data:image\/png;base64,/);
    assert.deepEqual(p.media, []);
  });

  test('erreurs de GitHub', async () => {
    const codes = { 401: 'badToken', 403: 'forbidden', 404: 'notFound', 409: 'empty', 429: 'forbidden', 500: 'failed' };
    for (const [status, code] of Object.entries(codes)) {
      serve({}, +status);
      await assert.rejects(openRepo('compte/depot', ''), { code });
    }
    await assert.rejects(openRepo('pas une adresse', ''), { code: 'invalid' });
    serve({ 'a.json': '{ pas du json', 'b.json': '{"format":"autre"}' });
    await assert.rejects(openRepo('compte/depot', ''), { code: 'noBackup' });
  });

  test('erreur d’accès pendant les photos : lecture interrompue', async () => {
    serve({ 'principal.json': backup(), 'principal/photos/Ané.jpg': 'img' });
    const repo = await openRepo('compte/depot', '');
    globalThis.fetch = async () => new Response('', { status: 403 });
    await assert.rejects(attachPhotos(repo, repo.backups[0]), { code: 'forbidden' });
  });
});

describe('fenêtre d’import', () => {
  test('aperçu, jeton effacé, puis import avec la photo affichable', async () => {
    serve({ 'principal.json': backup(), 'principal/photos/Ané.jpg': 'img' });
    el('repoToken').value = 'jeton';
    const button = el('repoLoad');
    await importRepo(button);
    assert.equal(button.disabled, false);
    assert.equal(el('repoToken').value, '');
    assert.ok(html('importInfo').includes('data-act="import-new"'));
    assert.ok(html('importInfo').includes('1 photo chargée'));
    await importGo(false);
    assert.ok(photoOf(S.people.get('a')).startsWith('data:image/jpeg'));
    openTransfer();
    assert.equal(el('repoToken').value, '');
  });

  test('plusieurs sauvegardes : on choisit', async () => {
    serve({ 'a.json': backup(), 'b.json': backup({ given: 'Bob', photo: '' }) });
    await importRepo(el('repoLoad'));
    assert.ok(html('importInfo').includes('data-act="import-repo-pick"'));
    assert.equal(S.pending, null);
    await pickRepoBackup(1);
    assert.equal(S.pending.people[0].data.given, 'Bob');
    await pickRepoBackup(1); // déjà choisie
  });

  test('erreur affichée, nouvelle tentative possible', async () => {
    serve({}, 404);
    const button = el('repoLoad');
    await importRepo(button);
    assert.ok(html('importInfo').includes('Dépôt introuvable'));
    assert.equal(button.disabled, false);
    globalThis.fetch = async () => { throw new TypeError('réseau'); };
    await importRepo(button);
    assert.ok(html('importInfo').includes('n’a pas pu être lu'));
  });

  test('le fichier local garde son fonctionnement', async () => {
    await readImportFile({ files: [{ name: 'a.json', text: async () => backup({ photo: '' }) }] });
    assert.ok(html('importInfo').includes('a.json'));
  });
});
