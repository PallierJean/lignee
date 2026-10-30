import assert from 'node:assert/strict';
import { test, describe, beforeEach, afterEach } from 'node:test';
import { S } from '../js/state.js';
import { parseRepo, openRepo, attachPhotos, pushBackup } from '../js/services/github.js';
import { confirmRepoPush, pushRepo, forgetRepo, renderRepoBanner } from '../js/ui/repo-link.js';
import { readImportFile, importGo, importRepo, pickRepoBackup, openTransfer, closeTransfer } from '../js/ui/transfer.js';
import { photoOf } from '../js/model/people.js';
import { resetApp, html } from './helpers.js';

const el = (id) => document.getElementById(id);
const nativeFetch = globalThis.fetch;
const backup = (extra = {}) => JSON.stringify({ format: 'lignee', name: 'Famille', people: [{ id: 'a', given: 'Ana', photo: 'photos/Ané.jpg', ...extra }], unions: [] });
let calls;
let head;

/** Faux GitHub : `files` associe un chemin à son contenu ; `writable` : le jeton peut écrire. */
function serve(files, status, writable = false) {
  calls = [];
  const paths = Object.keys(files);
  globalThis.fetch = async (url, init = {}) => {
    const method = init.method || 'GET';
    calls.push({ url, method, auth: init.headers && init.headers.Authorization, body: init.body && JSON.parse(init.body) });
    if (status) return new Response('', { status });
    if (method !== 'GET') {
      if (url.endsWith('/git/refs') && method === 'POST') return new Response('', { status: writable ? 422 : 403 });
      if (url.includes('/git/refs/heads/')) return Response.json({});
      return Response.json({ sha: url.split('/').pop() + '-sha' });
    }
    if (url.endsWith('/commits/HEAD')) return new Response(head + '\n');
    if (url.endsWith('/compte/depot')) return Response.json({ default_branch: 'main' });
    if (url.includes('/git/commits/')) return Response.json({ tree: { sha: 'arbre' } });
    if (url.includes('/git/trees/')) {
      return Response.json({ tree: [...paths.map((path) => ({ type: 'blob', path, sha: 'sha-' + paths.indexOf(path) })), { type: 'tree', path: 'x' }] });
    }
    const sha = url.match(/\/git\/blobs\/sha-(\d+)$/);
    const path = sha ? paths[sha[1]] : decodeURIComponent(url.split(`/${head}/`)[1]);
    return path in files ? new Response(files[path]) : new Response('', { status: 404 });
  };
}

beforeEach(() => {
  resetApp();
  S.pending = null;
  head = 'c0';
  forgetRepo();
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
    assert.ok(calls.some((c) => c.url.startsWith('https://raw.githubusercontent.com/compte/depot/c0/principal.json')));
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
    assert.equal(count.found, 1);
    assert.equal(count.missing, 0);
    assert.equal(repo.backups[0].people[0].data.photo, 'data:image/jpeg;base64,' + btoa('img'));
  });

  test('photo à côté du fichier ; sources et médias convertis ; absente : retirée', async () => {
    const people = { sources: [{ title: 'Acte', photo: 'photos/acte.png' }], media: [{ photo: 'photos/manque.gif' }] };
    serve({ 'data/arbre.json': backup(people), 'data/photos/Ané.jpg': 'img', 'data/photos/acte.png': 'doc' });
    const repo = await openRepo('compte/depot', '');
    const count = await attachPhotos(repo, repo.backups[0]);
    const p = repo.backups[0].people[0].data;
    assert.equal(count.found, 2);
    assert.equal(count.missing, 1);
    assert.match(p.sources[0].photo, /^data:image\/png;base64,/);
    assert.deepEqual(p.media, []);
  });

  test('erreurs de GitHub', async () => {
    const codes = { 401: 'badToken', 403: 'forbidden', 404: 'notFound', 409: 'empty', 422: 'conflict', 429: 'forbidden', 500: 'failed' };
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

  test('jeton effacé dès sa lecture, même en cas d’échec', async () => {
    serve({}, 401);
    el('repoToken').value = ' jeton ';
    await importRepo(el('repoLoad'));
    assert.equal(calls[0].auth, 'Bearer jeton');
    assert.equal(el('repoToken').value, '');
  });

  test('fermer la fenêtre : jeton saisi et dépôt ouvert oubliés', async () => {
    serve({ 'a.json': backup(), 'b.json': backup({ photo: '' }) });
    el('repoToken').value = 'jeton';
    await importRepo(el('repoLoad'));
    closeTransfer();
    await pickRepoBackup(0);
    assert.equal(S.pending, null);
    el('repoToken').value = 'jeton';
    closeTransfer();
    assert.equal(el('repoToken').value, '');
  });

  test('le fichier local garde son fonctionnement', async () => {
    await readImportFile({ files: [{ name: 'a.json', text: async () => backup({ photo: '' }) }] });
    assert.ok(html('importInfo').includes('a.json'));
  });
});

describe('droits du jeton', () => {
  const files = { 'principal.json': backup(), 'principal/photos/Ané.jpg': 'img' };

  test('sans jeton : aucune demande d’écriture', async () => {
    serve(files, 0, true);
    assert.equal((await openRepo('compte/depot', '')).write, false);
    assert.ok(calls.every((c) => c.method === 'GET'));
  });

  test('jeton en lecture : refusé, donc lecture seule', async () => {
    serve(files);
    assert.equal((await openRepo('compte/depot', 'jeton')).write, false);
  });

  test('jeton en écriture : le test ne demande qu’une référence invalide', async () => {
    serve(files, 0, true);
    const repo = await openRepo('compte/depot', 'jeton');
    assert.equal(repo.write, true);
    assert.equal(repo.branch, 'main');
    const writes = calls.filter((c) => c.method !== 'GET');
    assert.equal(writes.length, 1);
    assert.ok(!writes[0].body.ref.startsWith('refs/'));
  });
});

describe('bandeaux', () => {
  async function load(writable, token = 'jeton') {
    serve({ 'principal.json': backup(), 'principal/photos/Ané.jpg': 'img' }, 0, writable);
    el('repoToken').value = token;
    await importRepo(el('repoLoad'));
    await importGo(true);
  }

  test('lecture seule : bandeau sans envoi, jeton oublié', async () => {
    await load(false);
    renderRepoBanner();
    assert.equal(el('repoBanner').hidden, false);
    assert.ok(html('repoBanner').includes('Lecture seule'));
    assert.ok(!html('repoBanner').includes('repo-push'));
    assert.ok(!('repo' in S.repoLink));
    calls.length = 0;
    await pushRepo();
    assert.equal(calls.length, 0);
  });

  test('écriture : bandeau d’alerte, confirmation puis envoi', async () => {
    await load(true);
    renderRepoBanner();
    assert.ok(html('repoBanner').includes('ATTENTION : LECTURE ET ÉCRITURE'));
    assert.ok(html('repoBanner').includes('data-act="repo-push-ask"'));
    confirmRepoPush(true);
    assert.ok(html('repoBanner').includes('data-act="repo-push-yes"'));
    confirmRepoPush(false);
    await pushRepo();
    assert.ok(calls.some((c) => c.url.endsWith('/git/refs/heads/main') && c.method === 'PATCH'));
    assert.match(el('toast').textContent, /envoyé/);
  });

  test('dépôt changé entretemps : rien n’est écrit, message affiché', async () => {
    await load(true);
    head = 'c1';
    calls.length = 0;
    await pushRepo();
    assert.ok(calls.every((c) => c.method === 'GET'));
    assert.ok(html('repoBanner').includes('a changé'));
  });

  test('un autre arbre ouvert : ni bandeau ni envoi', async () => {
    await load(true);
    S.tree = 'autre';
    renderRepoBanner();
    assert.equal(el('repoBanner').hidden, true);
    calls.length = 0;
    await pushRepo();
    assert.equal(calls.length, 0);
  });

  test('ajout à un arbre déjà rempli : pas de lien', async () => {
    S.people.set('z', { given: 'Zoé' });
    serve({ 'principal.json': backup(), 'principal/photos/Ané.jpg': 'img' }, 0, true);
    el('repoToken').value = 'jeton';
    await importRepo(el('repoLoad'));
    await importGo(false);
    assert.equal(S.repoLink, null);
  });

  test('fenêtre fermée avant l’import : le jeton d’écriture est oublié', async () => {
    serve({ 'principal.json': backup(), 'principal/photos/Ané.jpg': 'img' }, 0, true);
    el('repoToken').value = 'jeton';
    await importRepo(el('repoLoad'));
    closeTransfer();
    await importGo(true);
    assert.equal(S.repoLink, null);
  });

  test('déconnecter oublie le dépôt', async () => {
    await load(true);
    forgetRepo();
    assert.equal(S.repoLink, null);
    assert.equal(el('repoBanner').hidden, true);
  });
});

describe('envoi vers le dépôt', () => {
  const data = 'data:image/jpeg;base64,' + btoa('img');
  const other = 'data:image/png;base64,' + btoa('neuf');
  const send = (people) => JSON.stringify({ format: 'lignee', name: 'F', people, unions: [] });

  async function opened() {
    serve({ 'principal.json': backup(), 'principal/photos/Ané.jpg': 'img', 'principal/photos/vieille.jpg': 'x' }, 0, true);
    const repo = await openRepo('compte/depot', 'jeton');
    const { photos } = await attachPhotos(repo, repo.backups[0]);
    return { repo, target: { path: 'principal.json', photos } };
  }

  const treeEntries = () => calls.find((c) => c.url.endsWith('/git/trees')).body;
  const json = () => JSON.parse(treeEntries().tree.find((x) => x.path === 'principal.json').content);

  test('photo inchangée : ni renvoyée ni dupliquée, le chemin revient dans le JSON', async () => {
    const { repo, target } = await opened();
    calls.length = 0;
    await pushBackup(repo, target, send([{ id: 'a', photo: data }]), 'msg');
    assert.ok(!calls.some((c) => c.url.endsWith('/git/blobs')));
    assert.equal(json().people[0].photo, 'photos/Ané.jpg');
    assert.equal(treeEntries().base_tree, 'arbre');
    assert.deepEqual(calls.find((c) => c.url.endsWith('/git/commits')).body.parents, ['c0']);
    assert.equal(repo.head, 'commits-sha');
  });

  test('nouvelle photo transférée, photo retirée supprimée, sources comprises', async () => {
    const { repo, target } = await opened();
    calls.length = 0;
    await pushBackup(repo, target, send([{ id: 'a', sources: [{ photo: other }] }]), 'msg');
    const blob = calls.find((c) => c.url.endsWith('/git/blobs')).body;
    assert.deepEqual(blob, { content: btoa('neuf'), encoding: 'base64' });
    const ref = json().people[0].sources[0].photo;
    assert.match(ref, /^photos\/photo_.+\.png$/);
    const entries = treeEntries().tree;
    assert.ok(entries.some((x) => x.path === 'principal/' + ref && x.sha === 'blobs-sha'));
    assert.ok(entries.some((x) => x.path === 'principal/photos/Ané.jpg' && x.sha === null));
    assert.ok(!entries.some((x) => x.path.endsWith('vieille.jpg')), 'fichier jamais chargé : conservé');
  });

  test('second envoi : la photo ajoutée n’est pas retransférée', async () => {
    const { repo, target } = await opened();
    await pushBackup(repo, target, send([{ id: 'a', photo: other }]), 'msg');
    head = repo.head;
    calls.length = 0;
    await pushBackup(repo, target, send([{ id: 'a', photo: other }]), 'msg');
    assert.ok(!calls.some((c) => c.url.endsWith('/git/blobs')));
  });
});
