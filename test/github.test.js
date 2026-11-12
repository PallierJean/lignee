import assert from 'node:assert/strict';
import { test, describe, beforeEach, afterEach } from 'node:test';
import { S } from '../js/state.js';
import { parseRepo, openRepo, attachPhotos, pushBackup } from '../js/services/github.js';
import { confirmRepoSave, saveRepo, forgetRepo, renderRepoBanner, chooseRepoSave, flushRepoSave, scheduleRepoSave } from '../js/ui/repo-link.js';
import { beginAction, commitAction, opUpdate } from '../js/services/storage.js';
import { readImportFile, importGo, pickRepoBackup, connectRepo, connectOpenedRepo, openTransfer, closeTransfer } from '../js/ui/transfer.js';
import { photoOf } from '../js/model/people.js';
import { REPO_KEY } from '../js/config.js';
import { resetApp, html } from './helpers.js';

const el = (id) => document.getElementById(id);
const nativeFetch = globalThis.fetch;
const backup = (extra = {}) => JSON.stringify({ format: 'lignee', version: 2, name: 'Famille', people: [{ id: 'a', given: 'Ana', photo: 'photos/Ané.jpg', ...extra }], unions: [] });
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
      if (url.endsWith('/git/refs') && method === 'POST') return new Response('', { status: writable ? (head ? 422 : 409) : 403 });
      if (url.includes('/contents/')) return Response.json({ commit: { sha: 'premier' } });
      if (url.includes('/git/refs/heads/')) return Response.json({});
      return Response.json({ sha: url.split('/').pop() + '-sha' });
    }
    if (url.endsWith('/commits/HEAD')) return head ? new Response(head + '\n') : new Response('', { status: 409 });
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
  localStorage.clear();
  S.repoLink = null;
  S.repoSavedAt = '';
  el('repoUrl').value = 'compte/depot';
  el('repoToken').value = '';
});

afterEach(() => { globalThis.fetch = nativeFetch; });

describe('adresse du dépôt', () => {
  test('formes acceptées', () => {
    const expected = { owner: 'compte', repo: 'ma-famille' };
    for (const s of [
      'https://github.com/compte/ma-famille', ' https://github.com/compte/ma-famille/ ',
      'https://github.com/compte/ma-famille.git', 'https://github.com/compte/ma-famille/tree/main',
      'git@github.com:compte/ma-famille.git', 'compte/ma-famille',
    ]) assert.deepEqual(parseRepo(s), expected, s);
  });

  test('refuse le reste', () => {
    for (const s of ['', 'compte', 'https://evil.example/a/b', 'https://github.com.evil.example/a/b', 'a/..', 'a b/c']) {
      assert.equal(parseRepo(s), null, s);
    }
  });
});

describe('lecture du dépôt', () => {
  test('sauvegarde d’une version plus récente : refusée, jamais écrasée', async () => {
    serve({ 'arbre.json': JSON.stringify({ format: 'lignee', version: 99, people: [{ id: 'a', given: 'A' }], unions: [] }) }, 0, true);
    await assert.rejects(openRepo('compte/depot', 'jeton', true), { code: 'newer' });
    el('repoToken').value = 'jeton';
    await connectRepo(el('repoConnect'));
    assert.ok(html('importInfo').includes('version plus récente'));
    assert.equal(S.repoLink, null);
  });

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
    const fields = { citations: [{ id: 'c', source: 'S1', fact: '' }], media: [{ photo: 'photos/manque.gif' }] };
    const file = JSON.parse(backup(fields));
    file.sources = [{ id: 'S1', title: 'Acte', photo: 'photos/acte.png' }];
    serve({ 'data/arbre.json': JSON.stringify(file), 'data/photos/Ané.jpg': 'img', 'data/photos/acte.png': 'doc' });
    const repo = await openRepo('compte/depot', '');
    const count = await attachPhotos(repo, repo.backups[0]);
    const p = repo.backups[0].people[0].data;
    assert.equal(count.found, 2);
    assert.equal(count.missing, 1);
    // The source's document, loaded where the source is
    const src = repo.backups[0].sources.find((x) => x.id === p.citations[0].source).data;
    assert.match(src.photo, /^data:image\/png;base64,/);
    assert.equal(count.base.sources.get(p.citations[0].source).photo, 'photos/acte.png', 'base : chemins du dépôt');
    assert.equal(p.media, undefined, 'les images ne sont plus dans les fiches');
    assert.deepEqual(repo.backups[0].media, [], 'absente du dépôt : l’image est retirée de la galerie');
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
  test('dépôt ouvert dans un nouvel arbre, jeton effacé, photo affichable', async () => {
    serve({ 'principal.json': backup(), 'principal/photos/Ané.jpg': 'img' });
    el('repoToken').value = 'jeton';
    const button = el('repoConnect');
    await connectRepo(button);
    assert.equal(button.disabled, false);
    assert.equal(el('repoToken').value, '');
    assert.equal(el('transfer').hidden, true);
    assert.equal(S.pending, null);
    assert.ok(photoOf(S.people.get('a')).startsWith('data:image/jpeg'));
    openTransfer();
    assert.equal(el('repoToken').value, '');
  });

  test('photo introuvable : signalée alors que la fenêtre se ferme', async () => {
    serve({ 'principal.json': backup() });
    await connectRepo(el('repoConnect'));
    assert.equal(el('transfer').hidden, true);
    assert.match(el('toast').textContent, /1 introuvable/);
  });

  test('plusieurs sauvegardes : on choisit', async () => {
    serve({ 'a.json': backup(), 'b.json': backup({ given: 'Bob', photo: '' }) });
    await connectRepo(el('repoConnect'));
    assert.ok(html('importInfo').includes('data-act="import-repo-pick"'));
    assert.equal(S.pending, null);
    await pickRepoBackup(1);
    assert.equal(S.pending, null);
    assert.equal([...S.people.values()][0].given, 'Bob');
    await pickRepoBackup(1); // déjà choisie
  });

  test('erreur affichée, nouvelle tentative possible', async () => {
    serve({}, 404);
    const button = el('repoConnect');
    await connectRepo(button);
    assert.ok(html('importInfo').includes('Dépôt introuvable'));
    assert.equal(button.disabled, false);
    globalThis.fetch = async () => { throw new TypeError('réseau'); };
    await connectRepo(button);
    assert.ok(html('importInfo').includes('n’a pas pu être lu'));
  });

  test('jeton effacé dès sa lecture, même en cas d’échec', async () => {
    serve({}, 401);
    el('repoToken').value = ' jeton ';
    await connectRepo(el('repoConnect'));
    assert.equal(calls[0].auth, 'Bearer jeton');
    assert.equal(el('repoToken').value, '');
  });

  test('fermer la fenêtre : jeton saisi et dépôt ouvert oubliés', async () => {
    serve({ 'a.json': backup(), 'b.json': backup({ photo: '' }) });
    el('repoToken').value = 'jeton';
    await connectRepo(el('repoConnect'));
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
    await connectRepo(el('repoConnect'));
    await importGo(true);
  }

  test('lecture seule : bandeau sans envoi, jeton oublié', async () => {
    await load(false);
    renderRepoBanner();
    assert.equal(el('repoBanner').hidden, false);
    assert.ok(html('repoBanner').includes('Lecture seule'));
    assert.ok(!html('repoBanner').includes('repo-save'));
    assert.ok(!('repo' in S.repoLink));
    calls.length = 0;
    await saveRepo();
    assert.equal(calls.length, 0);
  });

  test('écriture : bandeau d’alerte, confirmation puis envoi', async () => {
    await load(true);
    renderRepoBanner();
    assert.ok(html('repoBanner').includes('ATTENTION : LECTURE ET ÉCRITURE'));
    assert.ok(!html('repoBanner').includes('data-act="repo-save"'), 'envoi automatique : pas de bouton');
    assert.match(html('repoBanner'), /Chaque modification est enregistrée sur GitHub/);
    assert.ok(!html('repoBanner').includes('data-act="repo-save-yes"'));
    await saveRepo();
    assert.ok(calls.some((c) => c.url.endsWith('/git/refs/heads/main') && c.method === 'PATCH'));
    assert.match(el('toast').textContent, /sauvegardé/);
    assert.ok(html('repoBanner').includes('Dernière sauvegarde'));
  });

  const pushed = () => JSON.parse(calls.find((c) => c.url.endsWith('/git/trees')).body.tree.find((x) => x.path === 'principal.json').content);

  test('dépôt changé entretemps : ses modifications sont fusionnées, puis l’arbre part', async () => {
    const files = { 'principal.json': backup(), 'principal/photos/Ané.jpg': 'img' };
    serve(files, 0, true);
    el('repoToken').value = 'jeton';
    await connectRepo(el('repoConnect'));
    await importGo(true);
    const [id] = S.people.keys();
    S.people.set(id, { ...S.people.get(id), birthPlace: 'Lyon' });
    files['principal.json'] = JSON.stringify({
      format: 'lignee', version: 2, name: 'Famille',
      people: [{ id, given: 'Ana', surname: 'Durand', photo: 'photos/Ané.jpg' }, { id: 'b', given: 'Bruno' }],
      unions: [],
    });
    head = 'c1';
    calls.length = 0;
    await saveRepo();
    assert.equal(S.repoError, '');
    assert.deepEqual(calls.find((c) => c.url.endsWith('/git/commits')).body.parents, ['c1']);
    const json = pushed();
    assert.deepEqual(json.people.find((p) => p.id === id), { id, given: 'Ana', surname: 'Durand', birthPlace: 'Lyon', photo: 'photos/Ané.jpg' });
    assert.ok(json.people.some((p) => p.id === 'b'));
    assert.equal(S.people.get(id).surname, 'Durand');
    assert.match(S.people.get(id).photo, /^data:image\/jpeg/);
    assert.equal(S.people.get('b').given, 'Bruno');
    assert.ok(!calls.some((c) => c.url.endsWith('/git/blobs')), 'photo connue : pas renvoyée');
  });

  test('chaque modification part sur GitHub, une fois, avec ce qui a changé ; rien si rien n’a changé', async () => {
    const files = { 'principal.json': backup(), 'principal/photos/Ané.jpg': 'img' };
    serve(files, 0, true);
    el('repoToken').value = 'jeton';
    await connectRepo(el('repoConnect'));
    await importGo(true);
    await flushRepoSave(); // l'import lui-même part
    head = S.repoLink.repo.head;
    calls.length = 0;
    // Deux modifications rapprochées : un seul commit, qui dit ce qui a changé
    const [id] = S.people.keys();
    beginAction('hist.edit');
    await opUpdate('people', id, { occupation: 'Tisserand' });
    commitAction();
    beginAction('hist.edit');
    await opUpdate('people', id, { notes: 'Lyon' });
    commitAction();
    assert.ok(!calls.some((c) => c.method === 'PATCH'), 'pas tout de suite');
    await flushRepoSave();
    const commits = calls.filter((c) => c.url.endsWith('/git/commits'));
    assert.equal(commits.length, 1);
    assert.match(commits[0].body.message, /Mise à jour de l’arbre depuis Lignée : modification/);
    assert.equal(pushed().people[0].notes, 'Lyon');
    assert.match(html('repoBanner'), /Chaque modification est enregistrée sur GitHub/);
    // Rien de changé : pas de commit vide
    head = S.repoLink.repo.head;
    calls.length = 0;
    scheduleRepoSave('hist.edit');
    await flushRepoSave();
    assert.ok(!calls.some((c) => c.method === 'POST'), 'aucun envoi');
  });

  test('même champ changé des deux côtés : choix demandé, rien n’est écrit avant', async () => {
    const files = { 'principal.json': backup(), 'principal/photos/Ané.jpg': 'img' };
    serve(files, 0, true);
    el('repoToken').value = 'jeton';
    await connectRepo(el('repoConnect'));
    await importGo(true);
    const [id] = S.people.keys();
    S.people.set(id, { ...S.people.get(id), given: 'Anne' });
    files['principal.json'] = JSON.stringify({ format: 'lignee', version: 2, people: [{ id, given: 'Anna', photo: 'photos/Ané.jpg' }], unions: [] });
    head = 'c1';
    calls.length = 0;
    await saveRepo();
    assert.ok(calls.every((c) => c.method === 'GET'));
    assert.ok(html('repoBanner').includes('des deux côtés'));
    assert.ok(html('repoBanner').includes('Anne'));
    assert.equal(S.people.get(id).given, 'Anne');

    await saveRepo(true, 'theirs');
    assert.equal(S.repoConflicts, null);
    assert.equal(S.people.get(id).given, 'Anna');
    assert.equal(pushed().people[0].given, 'Anna');
  });

  test('un autre arbre ouvert : ni bandeau ni envoi', async () => {
    await load(true);
    S.tree = 'autre';
    renderRepoBanner();
    assert.equal(el('repoBanner').hidden, true);
    calls.length = 0;
    await saveRepo();
    assert.equal(calls.length, 0);
  });

  test('fenêtre fermée avant l’import : le jeton d’écriture est oublié', async () => {
    serve({ 'principal.json': backup(), 'principal/photos/Ané.jpg': 'img' }, 0, true);
    el('repoToken').value = 'jeton';
    await connectRepo(el('repoConnect'));
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
  const send = (people, sources = []) => JSON.stringify({ format: 'lignee', version: 2, name: 'F', people, unions: [], sources });

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
    await pushBackup(repo, target, send([{ id: 'a', surname: 'Garnier', given: 'Paul', citations: [{ id: 'c', source: 'S', fact: '' }] }], [{ id: 'S', kind: 'birth', title: 'Naissance', photo: other }]), 'msg');
    const blob = calls.find((c) => c.url.endsWith('/git/blobs')).body;
    assert.deepEqual(blob, { content: btoa('neuf'), encoding: 'base64' });
    const ref = json().sources[0].photo;
    assert.match(ref, /^photos\/Naissance-[0-9a-f-]{36}\.png$/, 'nommée d’après le titre de la source');
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

describe('lecture juste après un envoi', () => {
  const send = (given) => JSON.stringify({ format: 'lignee', version: 2, name: 'F', people: [{ id: 'a', given }], unions: [] });

  test('GitHub relit encore l’ancien commit : pas de faux conflit', async () => {
    serve({ 'principal.json': backup({ photo: '' }) }, 0, true);
    const repo = await openRepo('compte/depot', 'jeton');
    const target = { path: 'principal.json', photos: new Map() };
    await pushBackup(repo, target, send('Un'), 'msg');
    setTimeout(() => { head = repo.head; }, 100);
    await pushBackup(repo, target, send('Deux'), 'msg');
    assert.deepEqual(calls.findLast((c) => c.url.endsWith('/git/commits')).body.parents, ['commits-sha']);
  });
});

describe('connecter l’arbre ouvert', () => {
  const connect = async (files, writable = true, token = 'jeton') => {
    serve(files, 0, writable);
    el('repoToken').value = token;
    await connectRepo(el('repoConnect'));
  };

  beforeEach(() => {
    S.trees.get(S.tree).name = 'Agathé Famille';
    S.people.set('a', { given: 'Agathe', photo: 'data:image/jpeg;base64,' + btoa('img') });
  });

  test('dépôt vide : premier commit, puis fichier nommé d’après l’arbre et photo en fichier', async () => {
    head = '';
    await connect({});
    assert.equal(el('repoToken').value, '');
    assert.equal(S.repoLink.path, 'agathe-famille.json');
    calls.length = 0;
    await saveRepo();
    const first = calls.find((c) => c.method === 'PUT');
    assert.ok(first.url.endsWith('/contents/agathe-famille.json'));
    assert.deepEqual(calls.find((c) => c.url.endsWith('/git/commits')).body.parents, ['premier']);
    const { tree } = calls.find((c) => c.url.endsWith('/git/trees')).body;
    const json = JSON.parse(tree.find((x) => x.path === 'agathe-famille.json').content);
    assert.match(json.people[0].photo, /^photos\/Agathe-[0-9a-f-]{36}\.jpg$/);
    assert.ok(tree.some((x) => x.path === 'agathe-famille/' + json.people[0].photo));
    assert.equal(S.repoError, '');
  });

  test('sans jeton ou jeton en lecture : refus clair, pas de lien', async () => {
    await connect({}, true, '');
    assert.ok(html('importInfo').includes('indiquez un jeton'));
    await connect({}, false);
    assert.ok(html('importInfo').includes('ne permet pas d’y écrire'));
    assert.equal(S.repoLink, null);
  });

  test('accès en lecture : nouvel arbre, l’arbre ouvert ne reçoit rien', async () => {
    const opened = S.tree;
    const before = S.trees.size;
    await connect({ 'x.json': backup({ photo: '' }) }, false);
    assert.notEqual(S.tree, opened);
    assert.equal(S.trees.size, before + 1);
    assert.equal(S.trees.get(S.tree).name, 'Famille');
    assert.deepEqual([...S.people.values()].map((p) => p.given), ['Ana']);
    assert.ok(!html('importInfo').includes('repo-connect-open'));
    assert.equal(S.repoLink.tree, S.tree);
    assert.ok(!('repo' in S.repoLink));
  });

  test('famille d’exemple ouverte, jeton en écriture : nouvel arbre relié au dépôt', async () => {
    const opened = S.tree;
    S.people.clear();
    S.people.set('e', { given: 'Exemple', example: true });
    await connect({ 'x.json': backup({ photo: '' }) });
    assert.notEqual(S.tree, opened);
    assert.deepEqual([...S.people.values()].map((p) => p.given), ['Ana']);
    assert.ok(!html('importInfo').includes('repo-connect-open'));
    assert.equal(S.repoLink.tree, S.tree);
    assert.equal(S.repoLink.path, 'x.json');
  });

  test('famille d’exemple ouverte, dépôt vide : elle ne part pas, un nouvel arbre est relié', async () => {
    const opened = S.tree;
    S.people.clear();
    S.people.set('e', { given: 'Exemple', example: true });
    await connect({});
    assert.notEqual(S.tree, opened);
    assert.equal(S.people.size, 0);
    assert.equal(S.trees.get(S.tree).name, 'depot');
    assert.equal(S.repoLink.tree, S.tree);
  });

  test('arbre ouvert vide : la sauvegarde s’ouvre dans un nouvel arbre', async () => {
    const opened = S.tree;
    S.people.clear();
    await connect({ 'agathe-famille.json': backup({ photo: '' }) });
    assert.notEqual(S.tree, opened);
    assert.equal(S.people.size, 1);
    assert.ok(!html('importInfo').includes('repo-connect-open'));
  });

  test('sauvegarde au nom de l’arbre : reliée sans question', async () => {
    await connect({ 'agathe-famille.json': backup({ photo: '' }) });
    assert.equal(S.repoLink.path, 'agathe-famille.json');
    assert.equal(S.pending, null);
    assert.equal(document.getElementById('transfer').hidden, true); // the dialog closes
  });

  test('autre sauvegarde et arbre personnel : nouvel arbre ou connexion, jamais d’ajout', async () => {
    const opened = S.tree;
    await connect({ 'x.json': backup({ photo: '' }) });
    assert.equal(S.tree, opened);
    assert.equal(S.repoLink, null);
    assert.ok(html('importInfo').includes('data-act="import-new"'));
    assert.ok(!html('importInfo').includes('data-act="import-go"'));
    assert.ok(html('importInfo').includes('Connecter plutôt « Agathé Famille »'));
    await importGo(true);
    assert.notEqual(S.tree, opened);
    assert.equal(S.repoLink.tree, S.tree);
    await connectOpenedRepo(); // déjà importée
    assert.equal(S.repoLink.tree, S.tree);
  });

  test('sauvegarde déjà présente : confirmation au premier envoi seulement', async () => {
    await connect({ 'agathe.json': backup({ photo: '' }) });
    await connectOpenedRepo();
    assert.equal(S.pending, null);
    assert.equal(S.repoLink.path, 'agathe.json');
    calls.length = 0;
    await saveRepo();
    assert.ok(calls.every((c) => c.method === 'GET'), 'rien n’est envoyé avant le choix');
    assert.equal(el('repoDiffDlg').hidden, false);
    assert.match(html('repoDiffBody'), /Différentes : votre version est envoyée/);
    assert.match(html('repoDiffBody'), /Agathe <small>\(prénoms, photo\)<\/small>/);
    await chooseRepoSave('replace');
    assert.equal(el('repoDiffDlg').hidden, true);
    assert.ok(calls.some((c) => c.method === 'PATCH'));
    head = S.repoLink.repo.head;
    calls.length = 0;
    await saveRepo();
    assert.ok(calls.some((c) => c.method === 'PATCH'));
  });

  const sent = () => JSON.parse(calls.findLast((c) => c.url.endsWith('/git/trees')).body.tree.find((x) => x.path === 'agathe.json').content);
  const twoPeople = () => JSON.stringify({ format: 'lignee', version: 2, name: 'F', people: [{ id: 'a', given: 'Ana' }, { id: 'r', given: 'Rémi' }], unions: [] });

  test('bouton seulement si besoin : première sauvegarde à vérifier, ou envoi qui a échoué', async () => {
    await connect({ 'agathe.json': backup({ photo: '' }) });
    await connectOpenedRepo();
    renderRepoBanner();
    assert.match(html('repoBanner'), /data-act="repo-save">Sauvegarder sur GitHub</, 'première sauvegarde');
    await chooseRepoSave('replace');
    assert.ok(!html('repoBanner').includes('data-act="repo-save"'), 'ensuite : automatique');
    S.repoError = 'GitHub refuse l’accès';
    renderRepoBanner();
    assert.match(html('repoBanner'), /data-act="repo-save">Réessayer l’envoi</, 'après un échec');
    S.repoError = '';
  });

  test('sauvegarde pas encore confirmée : rien ne part tout seul', async () => {
    await connect({ 'agathe.json': backup({ photo: '' }) });
    await connectOpenedRepo();
    assert.equal(S.repoLink.mustConfirm, true);
    calls.length = 0;
    beginAction('hist.edit');
    await opUpdate('people', [...S.people.keys()][0], { notes: 'x' });
    commitAction();
    await flushRepoSave();
    assert.ok(calls.every((c) => c.method === 'GET'));
    assert.match(html('repoBanner'), /Première sauvegarde/);
  });

  test('connecté après l’aperçu d’import : les photos du dépôt sont reconnues, pas renvoyées ; les doublons partent', async () => {
    // Même photo que celle de l'arbre ouvert (beforeEach), plus un doublon laissé par une ancienne version
    await connect({
      'agathe.json': JSON.stringify({ format: 'lignee', version: 2, name: 'F', people: [{ id: 'a', given: 'Agathe', photo: 'photos/Agathe-1.jpg' }], unions: [] }),
      'agathe/photos/Agathe-1.jpg': 'img', 'agathe/photos/Agathe-0db90881-c80d-4a4f-a99a-632f168b33cd.jpg': 'img',
      'agathe/photos/posée-à-la-main.jpg': 'img', 'autre/photos/x-0db90881-c80d-4a4f-a99a-632f168b33cd.jpg': 'img',
    });
    await connectOpenedRepo();
    await saveRepo();
    assert.match(html('repoDiffBody'), /Photos : 0 envoyée, 1 retirée/);
    calls.length = 0;
    await chooseRepoSave('replace');
    assert.ok(!calls.some((c) => c.url.endsWith('/git/blobs')), 'photo identique : pas renvoyée');
    const { tree } = calls.find((c) => c.url.endsWith('/git/trees')).body;
    assert.equal(JSON.parse(tree.find((x) => x.path === 'agathe.json').content).people[0].photo, 'photos/Agathe-1.jpg');
    assert.deepEqual(tree.filter((x) => x.sha === null).map((x) => x.path), ['agathe/photos/Agathe-0db90881-c80d-4a4f-a99a-632f168b33cd.jpg'], 'seul le doublon nommé par Lignée, dans son dossier, part');
  });

  test('avant de remplacer : la liste de ce qui change ; « Remplacer » retire ce qui n’est que dans le dépôt', async () => {
    await connect({ 'agathe.json': twoPeople() });
    await connectOpenedRepo();
    await saveRepo();
    const body = html('repoDiffBody');
    assert.match(body, /Seulement dans le dépôt[^<]*<span class="n">1<\/span><\/h3><ul class="diff-list"><li>Rémi<\/li>/);
    assert.match(body, /Photos : 1 envoyée/);
    await chooseRepoSave('replace');
    assert.deepEqual(sent().people.map((p) => p.id), ['a']);
    assert.ok(!S.people.has('r'));
  });

  test('« Fusionner » : ce qui n’est que dans le dépôt est gardé, votre version l’emporte ailleurs', async () => {
    await connect({ 'agathe.json': twoPeople() });
    await connectOpenedRepo();
    await saveRepo();
    calls.length = 0;
    await chooseRepoSave('merge');
    assert.equal(S.people.get('r').given, 'Rémi', 'repris dans l’arbre ouvert');
    assert.equal(S.people.get('a').given, 'Agathe');
    assert.deepEqual(sent().people.map((p) => [p.id, p.given]).sort(), [['a', 'Agathe'], ['r', 'Rémi']]);
    assert.match(el('toast').textContent, /1 fiche reprise/);
    assert.equal(S.repoLink.mustConfirm, false);
  });

  test('plusieurs sauvegardes : celle de l’arbre, sinon un nouveau fichier', async () => {
    await connect({ 'agathe-famille.json': backup(), 'autre.json': backup() });
    assert.equal(S.repoLink.path, 'agathe-famille.json');
    forgetRepo();
    await connect({ 'a.json': backup(), 'b.json': backup() });
    assert.equal(S.repoLink, null);
    assert.ok(html('importInfo').includes('data-act="import-repo-pick"'));
    await connectOpenedRepo();
    assert.equal(S.repoLink.path, 'agathe-famille.json');
    assert.equal(S.repoLink.mustConfirm, false);
  });

  test('rechargement : dépôt retenu sans le jeton, reconnexion sans confirmation', async () => {
    head = '';
    await connect({});
    await saveRepo();
    head = S.repoLink.repo.head;
    assert.ok(!localStorage.getItem(REPO_KEY).includes('jeton'));
    assert.equal(JSON.parse(localStorage.getItem(REPO_KEY))[S.tree].name, 'compte/depot');
    S.repoLink = null; // page rechargée
    renderRepoBanner();
    assert.ok(html('repoBanner').includes('data-act="repo-reconnect"'));
    openTransfer();
    assert.equal(el('repoUrl').value, 'compte/depot');
    await connect({ 'agathe-famille.json': backup({ photo: '' }) });
    assert.equal(S.repoLink.mustConfirm, false);
  });

  test('dépôt modifié ailleurs depuis la dernière sauvegarde : confirmation demandée', async () => {
    head = '';
    await connect({});
    await saveRepo();
    S.repoLink = null;
    head = 'ailleurs';
    await connect({ 'agathe-famille.json': backup({ photo: '' }) });
    assert.equal(S.repoLink.mustConfirm, true);
  });

  test('déconnecter oublie aussi le dépôt retenu', async () => {
    await connect({});
    forgetRepo();
    renderRepoBanner();
    assert.equal(el('repoBanner').hidden, true);
  });
});
