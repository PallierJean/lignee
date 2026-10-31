/**
 * Tests sur le vrai GitHub, avec un dépôt de test et deux jetons limités à ce dépôt.
 * Lancés par « npm run test:github », qui lit .env.test (ignoré par Git : les jetons n'y entrent jamais).
 * Sans ces variables, ils sont ignorés : « npm test » et la CI n'ont pas besoin de réseau.
 */
import assert from 'node:assert/strict';
import { test, describe, after } from 'node:test';
import { Buffer } from 'node:buffer';
import { openRepo, attachPhotos, pushBackup } from '../js/services/github.js';
import { sleep } from '../js/utils/helpers.js';

const { LIGNEE_TEST_REPO: REPO, LIGNEE_TEST_READ_TOKEN: READ, LIGNEE_TEST_WRITE_TOKEN: WRITE } = process.env;
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PNG2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const path = `e2e-${Date.now()}.json`;
const backup = (people) => JSON.stringify({ format: 'lignee', version: 1, name: 'Essai é', people, unions: [] });
const people = (photo) => [{ id: 'a', given: 'Zoé', notes: 'accents éàü — “ok” 👍', ...(photo ? { photo } : {}) }];
const paths = (repo) => [...repo.files.keys()];

let last = ''; // dernier commit envoyé

const push = async (repo, target, text, message) => {
  await pushBackup(repo, target, text, message);
  last = repo.head;
};

/** État relu du dépôt, comme après un rechargement de la page. GitHub peut relire l'ancien commit juste après un envoi. */
async function reopen() {
  let repo = await openRepo(REPO, WRITE, true);
  for (let i = 0; last && repo.head !== last && i < 25; i++) {
    await sleep(200);
    repo = await openRepo(REPO, WRITE, true);
  }
  const saved = repo.backups.find((b) => b.path === path);
  const { photos } = saved ? await attachPhotos(repo, saved) : { photos: new Map() };
  return { repo, saved, target: { path, photos } };
}

describe('vrai GitHub', { skip: !(REPO && READ && WRITE) && 'jetons absents : voir .env.test' }, () => {
  after(async () => {
    const { repo, target, saved } = await reopen();
    if (!saved) return;
    const entries = [path, ...[...target.photos.values()].map((x) => x.path)].map((p) => ({ path: p, mode: '100644', type: 'blob', sha: null }));
    const { tree: { sha: baseTree } } = await (await repo.api(`/git/commits/${repo.head}`)).json();
    const { sha: tree } = await repo.send('POST', '/git/trees', { base_tree: baseTree, tree: entries });
    const { sha } = await repo.send('POST', '/git/commits', { message: 'test: nettoyage des essais', tree, parents: [repo.head] });
    await repo.send('PATCH', `/git/refs/heads/${repo.branch}`, { sha });
  });

  test('les droits des deux jetons sont détectés', async () => {
    assert.equal((await openRepo(REPO, READ, true)).write, false);
    const repo = await openRepo(REPO, WRITE, true);
    assert.equal(repo.write, true);
    assert.equal(repo.branch, 'main');
  });

  test('le jeton de lecture ne peut rien écrire, même directement', async () => {
    const repo = await openRepo(REPO, READ, true);
    await assert.rejects(repo.send('POST', '/git/blobs', { content: 'eA==', encoding: 'base64' }), { code: 'forbidden' });
  });

  test('un dépôt privé ne se lit pas sans jeton', async () => {
    await assert.rejects(openRepo(REPO, ''), { code: 'notFound' });
  });

  test('envoi : JSON et photo en fichiers, contenu identique à la relecture', async () => {
    const { repo, target } = await reopen();
    const before = repo.head;
    await push(repo, target, backup(people(PNG)), 'test: envoi');
    assert.notEqual(repo.head, before);

    const { saved, target: again, repo: next } = await reopen();
    const person = saved.people[0].data;
    assert.equal(person.given, 'Zoé');
    assert.equal(person.notes, 'accents éàü — “ok” 👍');
    assert.equal(person.photo, PNG, 'photo identique à l’octet près');
    assert.equal(again.photos.size, 1);
    const stored = [...again.photos.values()][0];
    assert.ok(paths(next).includes(stored.path));
    assert.ok(stored.path.startsWith(path.replace('.json', '/photos/')));
  });

  test('après rechargement : photo inchangée pas retransférée, chemin conservé', async () => {
    const { repo, target } = await reopen();
    const [known] = target.photos.values();
    await push(repo, target, backup([{ ...people(PNG)[0], occupation: 'Médecin' }]), 'test: reconnexion');
    const { saved, target: again } = await reopen();
    assert.equal(saved.people[0].data.occupation, 'Médecin');
    assert.deepEqual([...again.photos.values()].map((x) => x.path), [known.path]);
  });

  test('photo remplacée : l’ancienne quitte le dépôt, sans doublon', async () => {
    const { repo, target } = await reopen();
    const [old] = target.photos.values();
    await push(repo, target, backup(people(PNG2)), 'test: remplacement');
    const { saved, repo: next, target: again } = await reopen();
    assert.equal(saved.people[0].data.photo, PNG2);
    assert.ok(!paths(next).includes(old.path));
    assert.equal(again.photos.size, 1);
  });

  test('personne sans photo : seule la fiche compte, la photo retirée disparaît', async () => {
    const { repo, target } = await reopen();
    const [old] = target.photos.values();
    await push(repo, target, backup([{ id: 'b', given: 'Sans photo' }, ...people('')]), 'test: sans photo');
    const { saved, repo: next } = await reopen();
    assert.equal(saved.people.length, 2);
    assert.ok(!paths(next).includes(old.path));
  });

  test('dépôt modifié entretemps : refus, rien n’est écrit', async () => {
    const stale = await reopen();
    const fresh = await reopen();
    await push(fresh.repo, fresh.target, backup(people('')), 'test: autre appareil');
    await assert.rejects(pushBackup(stale.repo, stale.target, backup([{ id: 'x', given: 'Écrase' }]), 'test: refusé'), { code: 'conflict' });
    const { saved } = await reopen();
    assert.equal(saved.people[0].data.given, 'Zoé');
  });

  test('jeton invalide : refusé clairement', async () => {
    await assert.rejects(openRepo(REPO, 'github_pat_invalide'), { code: 'badToken' });
  });
});
