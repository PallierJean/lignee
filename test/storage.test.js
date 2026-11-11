import assert from 'node:assert/strict';
import { test, describe, before, after, beforeEach } from 'node:test';
import { mkdtemp, rm, readdir, readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { S, loadPrefs, savePrefs, treeName } from '../js/state.js';
import { createServer } from '../server.js';
import {
  loadFile, loadLocal, seedExample, saveLocal, inBatch, opSet, opUpdate, opDelete, openTree, createTree, renameTree, deleteTree, storePhoto, storePhotos,
  buildPortableBackup, beginAction, commitAction, undoAction,
} from '../js/services/storage.js';
import { PREF_KEY, TREES_KEY, TREE_KEY } from '../js/config.js';
import { loadTree, person, resetApp } from './helpers.js';
import { sourcesOf } from '../js/model/sources.js';
import { NEARLY_FULL, loadLocalTree } from '../js/services/storage/local.js';

const el = (id) => document.getElementById(id);
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('mode fichier, sur le vrai serveur', () => {
  let server;
  let dataDir;
  const nativeFetch = globalThis.fetch;

  before(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'lignee-'));
    server = createServer({ dataDir });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}/`;
    globalThis.fetch = (url, init) => nativeFetch(new URL(url, base), init);
    globalThis.FileReader = class {
      readAsDataURL(blob) {
        blob.arrayBuffer().then((b) => {
          this.result = 'data:image/png;base64,' + Buffer.from(b).toString('base64');
          this.onload();
        });
      }
    };
  });

  after(async () => {
    globalThis.fetch = nativeFetch;
    server.close();
    server.closeAllConnections();
    await rm(dataDir, { recursive: true, force: true });
  });

  test('premier lancement : reprend les arbres du navigateur', async () => {
    resetApp();
    localStorage.setItem(TREES_KEY, JSON.stringify([{ id: 'principal', name: 'Mon arbre', createdAt: 1 }]));
    localStorage.setItem(TREE_KEY + 'principal', JSON.stringify({ people: { a: { given: 'Ana' } }, unions: {} }));
    assert.equal(await loadFile(), true);
    assert.equal(S.mode, 'file');
    assert.equal(S.people.get('a').given, 'Ana');
    assert.ok((await readdir(dataDir)).includes('principal.json'));
  });

  test('écritures, photo, documents, sauvegarde portable', async () => {
    await opSet('people', 'b', { given: 'Bob', surname: 'Roux' });
    await opUpdate('people', 'b', { occupation: 'Tisserand' });
    const stored = await storePhoto(PNG, S.people.get('b'));
    assert.match(stored, /^photos\/ROUX-Bob-/);
    await opUpdate('people', 'b', { photo: stored, sources: [{ id: 's', photo: PNG }, { id: 't' }], media: [{ id: 'm', photo: PNG }] });
    assert.equal(await storePhotos(), 2, 'la fiche et la source partagée');
    const p = S.people.get('b');
    assert.ok(sourcesOf(p)[0].photo.startsWith('photos/'));
    assert.ok(p.media[0].photo.startsWith('photos/'));
    await saveLocal();
    const backup = JSON.parse(await buildPortableBackup());
    const portable = backup.people.find((x) => x.id === 'b');
    assert.ok(portable.photo.startsWith('data:image'));
    assert.ok(portable.media[0].photo.startsWith('data:image'));
    assert.equal(backup.version, 2);
    assert.ok(backup.sources.find((x) => x.id === portable.citations[0].source).photo.startsWith('data:image'), 'document de la source');
    const saved = JSON.parse(await readFile(path.join(dataDir, 'principal.json'), 'utf8'));
    assert.ok(saved.sources.some((x) => x.photo && x.photo.startsWith('photos/')), 'fichier : la source garde son chemin');
    assert.equal(await storePhoto('photos/a.jpg', p), 'photos/a.jpg');
  });

  test('photo introuvable : la sauvegarde part sans elle', async () => {
    await opUpdate('people', 'b', { photo: 'photos/absente.jpg', media: [{ id: 'm', photo: 'photos/absente.jpg' }] });
    const portable = JSON.parse(await buildPortableBackup()).people.find((x) => x.id === 'b');
    assert.equal(portable.photo, undefined);
    assert.equal(portable.media.length, 0);
  });

  test('collection d’arbres', async () => {
    const id = await createTree('Second');
    assert.ok(S.trees.has(id));
    await renameTree(id, 'Deuxième');
    assert.equal(S.trees.get(id).name, 'Deuxième');
    await renameTree('principal', 'Premier');
    await openTree(id);
    assert.equal(S.people.size, 0);
    assert.equal(treeName(), 'Deuxième');
    await deleteTree(id);
    assert.equal(S.tree, 'principal');
    assert.ok(S.people.has('a'));
  });

  test('arbre d’une version plus récente : vide et en lecture seule, fichier et photos intacts', async () => {
    const future = JSON.stringify({ format: 'lignee', version: 99, name: 'Futur', people: [{ id: 'z', given: 'Zoé' }], unions: [], sources: [{ id: 's', photo: 'photos/acte.jpg' }] });
    await writeFile(path.join(dataDir, 'futur.json'), future);
    await mkdir(path.join(dataDir, 'futur', 'photos'), { recursive: true });
    await writeFile(path.join(dataDir, 'futur', 'photos', 'acte.jpg'), 'img');
    await loadFile();
    await openTree('futur');
    assert.equal(S.canWrite, false);
    assert.equal(S.people.size, 0);
    assert.match(el('toast').textContent, /version plus récente/);
    // Même un envoi direct au serveur ne l'écrase pas, et le ménage des photos n'y touche pas
    const put = await fetch('api/trees/futur', { method: 'PUT', body: JSON.stringify({ format: 'lignee', version: 1, people: [], unions: [] }) });
    assert.equal(put.status, 409);
    await fetch('api/trees/futur/photos/sweep', { method: 'POST' });
    assert.equal(await readFile(path.join(dataDir, 'futur.json'), 'utf8'), future);
    await access(path.join(dataDir, 'futur', 'photos', 'acte.jpg'));
    await openTree('principal');
    assert.equal(S.canWrite, true);
    assert.ok(S.people.has('a'));
    await rm(path.join(dataDir, 'futur.json'));
    await loadFile();
  });

  test('conflit : l’autre version n’est pas écrasée, et l’échec est signalé', async () => {
    const res = await fetch('api/trees/principal');
    const body = await res.json();
    body.name = 'Modifié ailleurs';
    await fetch('api/trees/principal', { method: 'PUT', body: JSON.stringify(body) });
    await assert.rejects(opUpdate('people', 'a', { given: 'Perdu' }));
    assert.match(el('toast').textContent, /modifié ailleurs/);
    const stored = JSON.parse(await readFile(path.join(dataDir, 'principal.json'), 'utf8'));
    assert.equal(stored.name, 'Modifié ailleurs');
    await openTree('principal');
    assert.equal(S.people.get('a').given, 'Ana');
    await opUpdate('people', 'a', { given: 'Annie' });
    assert.equal(S.people.get('a').given, 'Annie');
  });

  test('annuler retrouve une photo retirée', async () => {
    const photo = await storePhoto(PNG, { surname: 'X', given: 'Y' });
    await opUpdate('people', 'a', { photo });
    beginAction('hist.edit');
    await opUpdate('people', 'a', { photo: '' });
    commitAction();
    await undoAction();
    assert.equal(S.people.get('a').photo, photo);
    await access(path.join(dataDir, 'principal', photo));
  });

  test('serveur lancé avant la mise à jour : lecture seule, rien n’est écrit ni balayé', async () => {
    const real = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, init = {}) => {
      calls.push([String(url), init.method || 'GET']);
      const res = await real(url, init);
      // Un ancien serveur n'annonce pas la version de son format
      const headers = new Headers(res.headers);
      headers.delete('X-Lignee-Format');
      return new Response(await res.arrayBuffer(), { status: res.status, headers });
    };
    try {
      resetApp();
      assert.equal(await loadFile(), true);
      assert.equal(S.canWrite, false);
      assert.match(el('toast').textContent, /lancé avant la mise à jour/);
      assert.ok(S.people.size > 0, 'l’arbre reste lisible');
      assert.ok(calls.every(([, method]) => method === 'GET'), 'aucune écriture, aucun balayage des photos');
    } finally {
      globalThis.fetch = real;
    }
    resetApp();
    await loadFile();
    assert.equal(S.canWrite, true, 'serveur à jour : écriture permise');
  });

  test('serveur absent : le mode fichier est écarté', async () => {
    const saved = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('hors ligne'); };
    assert.equal(await loadFile(), false);
    await assert.rejects(createTree('X'));
    assert.match(el('toast').textContent, /création/);
    globalThis.fetch = saved;
  });
});

describe('mode navigateur', () => {
  beforeEach(resetApp);

  test('arbres et préférences survivent au rechargement', () => {
    loadTree([person('a', { given: 'Ana' })]);
    saveLocal();
    S.people = new Map();
    S.trees = new Map();
    loadLocal();
    assert.equal(S.people.get('a').given, 'Ana');
    S.focus = 'a';
    S.up = 6;
    S.fan = true;
    S.panel = false;
    savePrefs();
    S.up = 3;
    S.fan = false;
    S.focus = null;
    S.panel = true;
    loadPrefs();
    assert.deepEqual([S.up, S.fan, S.focus, S.panel], [6, true, 'a', false]);
    S.up = 0;
    savePrefs();
    S.up = 3;
    loadPrefs();
    assert.equal(S.up, 0);
    S.up = 12; // au-delà de 7 pour un arbre profond
    savePrefs();
    S.up = 3;
    loadPrefs();
    assert.equal(S.up, 12);
    S.panel = true;
  });

  test('stockage illisible ou plein', () => {
    localStorage.setItem(PREF_KEY, '{ pas du json');
    loadPrefs();
    localStorage.setItem(TREES_KEY, '{ pas du json');
    loadLocal();
    assert.ok(S.trees.size >= 1);
    const set = localStorage.setItem;
    localStorage.setItem = () => { throw new Error('plein'); };
    try {
      assert.throws(() => saveLocal(), /plein/);
      assert.match(el('toast').textContent, /refuse/);
      savePrefs();
    } finally {
      localStorage.setItem = set;
    }
  });

  test('browser full: not saved, the change is undone in memory, with a clear message', async () => {
    S.mode = 'local';
    loadLocal();
    await opSet('people', 'kept', { given: 'Kept' });
    const set = localStorage.setItem;
    localStorage.setItem = () => { throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); };
    try {
      await assert.rejects(opSet('people', 'lost', { given: 'Lost' }));
      await assert.rejects(opUpdate('people', 'kept', { given: 'Changed' }));
      await assert.rejects(opDelete('people', 'kept'));
      assert.match(el('toast').textContent, /plus de place/);
    } finally {
      localStorage.setItem = set;
    }
    assert.equal(S.people.has('lost'), false);
    assert.equal(S.people.get('kept').given, 'Kept');
    loadLocalTree();
    assert.equal(S.people.get('kept').given, 'Kept');
    assert.equal(S.people.has('lost'), false);
  });

  test('batch: one save, all or nothing', async () => {
    S.mode = 'local';
    loadLocal();
    await opSet('people', 'a', { given: 'Ana' });
    const set = localStorage.setItem;
    let saves = 0;
    localStorage.setItem = function (k, v) {
      if (k.startsWith(TREE_KEY)) saves++;
      return set.call(this, k, v);
    };
    try {
      const out = await inBatch(async () => {
        await opSet('people', 'b', { given: 'Bob' });
        await opUpdate('people', 'a', { surname: 'Roux' });
        await opSet('unions', 'u', { a: 'a', b: 'b' });
        assert.equal(S.people.get('a').surname, 'Roux', 'later rules read the earlier writes');
        return 'done';
      });
      assert.equal(out, 'done');
      assert.equal(saves, 1);
      // A failure in the middle: nothing stays, in memory or stored
      await assert.rejects(inBatch(async () => {
        await opDelete('people', 'b');
        await opUpdate('people', 'a', { given: 'Changed' });
        throw new Error('bug');
      }), /bug/);
      assert.equal(saves, 1);
      assert.equal(S.people.get('a').given, 'Ana');
      assert.ok(S.people.has('b'));
      // The save fails: everything goes back too
      localStorage.setItem = () => { throw new Error('refused'); };
      await assert.rejects(inBatch(async () => {
        await opSet('people', 'c', { given: 'Cy' });
        await opDelete('unions', 'u');
      }));
      assert.ok(!S.people.has('c') && S.unions.has('u'));
    } finally {
      localStorage.setItem = set;
    }
    loadLocalTree();
    assert.deepEqual([...S.people.keys()].sort(), ['a', 'b']);
  });

  test('browser nearly full: one warning', async () => {
    S.mode = 'local';
    loadLocal();
    await opSet('people', 'big', { given: 'Big', notes: 'x'.repeat(NEARLY_FULL) });
    assert.match(el('toast').textContent, /bientôt plein/);
    el('toast').textContent = '';
    await opUpdate('people', 'big', { given: 'Bigger' });
    assert.equal(el('toast').textContent, '');
    await opDelete('people', 'big');
  });
});

describe('famille d’exemple à la première visite', () => {
  const nativeFetch = globalThis.fetch;
  const family = JSON.stringify({ format: 'lignee', version: 2, name: 'Famille Bertrand (exemple)', people: [{ id: 'e1', given: 'Louis', example: true }], unions: [{ id: 'u1', a: 'e1' }] });

  beforeEach(() => {
    resetApp();
    localStorage.clear();
    globalThis.fetch = async () => new Response(family);
  });

  after(() => { globalThis.fetch = nativeFetch; });

  test('navigateur vierge : chargée et ouverte sous son nom', async () => {
    await seedExample();
    loadLocal();
    assert.equal(treeName(), 'Famille Bertrand (exemple)');
    assert.equal(S.people.get('e1').given, 'Louis');
    assert.equal(S.unions.size, 1);
  });

  test('un arbre existe déjà : rien n’est demandé ni remplacé', async () => {
    localStorage.setItem(TREES_KEY, JSON.stringify([{ id: 'principal', name: 'Ma famille' }]));
    localStorage.setItem(TREE_KEY + 'principal', JSON.stringify({ people: { a: { given: 'Ana' } }, unions: {} }));
    globalThis.fetch = async () => { throw new Error('ne doit pas être appelé'); };
    await seedExample();
    loadLocal();
    assert.equal(treeName(), 'Ma famille');
    assert.deepEqual([...S.people.keys()], ['a']);
  });

  test('retirer les exemples ne les fait pas revenir', async () => {
    await seedExample();
    loadLocal();
    S.people.delete('e1');
    saveLocal();
    await seedExample();
    loadLocal();
    assert.equal(S.people.size, 0);
  });

  test('fichier absent : démarrage sur un arbre vide', async () => {
    globalThis.fetch = async () => new Response('', { status: 404 });
    await seedExample();
    loadLocal();
    assert.equal(S.people.size, 0);
  });
});

test('gallery backs follow their front: converted, kept, or dropped alone when not found', async () => {
  const { convertPhotos, keptMedia } = await import('../js/services/storage.js');
  const p = { photo: 'photos/a.jpg', media: [{ id: 'm', photo: 'photos/front.jpg', back: 'photos/back.jpg' }, { id: 'n', photo: 'photos/only.jpg' }] };
  const out = await convertPhotos(p, async (x) => x.replace('photos/', 'data:'));
  assert.deepEqual(out.media, [{ id: 'm', photo: 'data:front.jpg', back: 'data:back.jpg' }, { id: 'n', photo: 'data:only.jpg' }]);
  assert.equal(p.media[0].back, 'photos/back.jpg', 'the record itself is untouched');
  assert.deepEqual(keptMedia([{ id: 'm', photo: 'x', back: '' }, { id: 'n', photo: '', back: 'y' }, { id: 'o', photo: 'z', back: 'w' }]),
    [{ id: 'm', photo: 'x' }, { id: 'o', photo: 'z', back: 'w' }]);
});
