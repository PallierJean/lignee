import assert from 'node:assert/strict';
import { test, describe, before, after, beforeEach } from 'node:test';
import { mkdtemp, rm, readdir, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { S, services, loadPrefs, savePrefs, treeName } from '../js/state.js';
import { createServer } from '../server.js';
import {
  loadFile, loadLocal, seedExample, saveLocal, opSet, opUpdate, opDelete, openTree, createTree, renameTree, deleteTree, storePhoto, storePhotos,
  buildPortableBackup, withRetry, subscribe, beginAction, commitAction, undoAction,
} from '../js/services/storage.js';
import { PREF_KEY, TREES_KEY, TREE_KEY } from '../js/config.js';
import { loadTree, person, resetApp } from './helpers.js';

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
    assert.equal(await storePhotos(), 1);
    const p = S.people.get('b');
    assert.ok(p.sources[0].photo.startsWith('photos/'));
    assert.ok(p.media[0].photo.startsWith('photos/'));
    await saveLocal();
    const portable = JSON.parse(await buildPortableBackup()).people.find((x) => x.id === 'b');
    assert.ok(portable.photo.startsWith('data:image'));
    assert.ok(portable.media[0].photo.startsWith('data:image'));
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
    savePrefs();
    S.up = 3;
    S.fan = false;
    S.focus = null;
    loadPrefs();
    assert.deepEqual([S.up, S.fan, S.focus], [6, true, 'a']);
  });

  test('stockage illisible ou plein', () => {
    localStorage.setItem(PREF_KEY, '{ pas du json');
    loadPrefs();
    localStorage.setItem(TREES_KEY, '{ pas du json');
    loadLocal();
    assert.ok(S.trees.size >= 1);
    const set = localStorage.setItem;
    localStorage.setItem = () => { throw new Error('plein'); };
    saveLocal();
    assert.match(el('toast').textContent, /refuse/);
    savePrefs();
    localStorage.setItem = set;
  });
});

describe('base en ligne', () => {
  /** Fausse base : collections en mémoire, abonnements relancés à chaque écriture. */
  function fakeDb() {
    const data = { people: new Map(), unions: new Map(), trees: new Map() };
    const subs = {};
    const emit = (c) => (subs[c] || []).forEach((fn) => fn({ docs: [...data[c]].map(([id, d]) => ({ id, data: () => d })) }));
    return {
      data,
      emit,
      collection: (c) => ({
        doc: (id) => ({
          set: async (d) => { data[c].set(id, d); emit(c); },
          update: async (p) => { data[c].set(id, { ...data[c].get(id), ...p }); emit(c); },
          delete: async () => { data[c].delete(id); emit(c); },
        }),
        onSnapshot: (fn, err) => { (subs[c] = subs[c] || []).push(fn); subs['err' + c] = err; fn({ docs: [] }); },
      }),
      fail: (c, e) => subs['err' + c](e),
    };
  }

  beforeEach(() => {
    resetApp();
    S.mode = 'db';
    S.loadedP = S.loadedU = S.loadedT = false;
    services.db = fakeDb();
    subscribe();
  });

  test('écritures et synchronisation, par arbre', async () => {
    assert.ok(S.trees.has('principal'));
    await opSet('people', 'a', { given: 'Ana' });
    await opUpdate('people', 'a', { surname: 'Roux' });
    assert.equal(S.people.get('a').surname, 'Roux');
    assert.equal(services.db.data.people.get('a').tree, 'principal');
    const id = await createTree('Autre');
    await openTree(id);
    assert.equal(S.people.size, 0);
    await opSet('people', 'b', { given: 'Bob' });
    await renameTree(id, 'Nouveau');
    await openTree('principal');
    assert.ok(S.people.has('a') && !S.people.has('b'));
    await deleteTree(id);
    assert.ok(!services.db.data.people.has('b'));
    await opDelete('people', 'a');
    assert.equal(S.people.size, 0);
  });

  test('annuler réécrit les documents touchés', async () => {
    await opSet('people', 'a', { given: 'Ana' });
    beginAction('hist.delete');
    await opDelete('people', 'a');
    commitAction();
    await undoAction();
    assert.equal(S.people.get('a').given, 'Ana');
    assert.ok(services.db.data.people.has('a'));
  });

  test('erreurs d’écriture : réessai, droits, quota, message', async () => {
    let n = 0;
    assert.equal(await withRetry(async () => {
      if (n++ === 0) throw { code: 'unavailable' };
      return 'ok';
    }), 'ok');
    await assert.rejects(withRetry(async () => { throw { code: 'invalid_argument' }; }));
    assert.equal(S.canWrite, false);
    S.canWrite = true;
    await assert.rejects(withRetry(async () => { throw { code: 'quota_exceeded' }; }));
    assert.match(el('toast').textContent, /pleine/);
    await assert.rejects(withRetry(async () => { throw { code: 'revoked' }; }));
    assert.equal(S.canWrite, false);
    await assert.rejects(withRetry(async () => { throw new Error('x'); }));
    assert.match(el('toast').textContent, /échoué/);
  });

  test('abonnement révoqué : lecture seule', () => {
    services.db.fail('people', { code: 'revoked' });
    assert.equal(S.canWrite, false);
  });
});

describe('famille d’exemple à la première visite', () => {
  const nativeFetch = globalThis.fetch;
  const family = JSON.stringify({ format: 'lignee', name: 'Famille Bertrand (exemple)', people: [{ id: 'e1', given: 'Louis', example: true }], unions: [{ id: 'u1', a: 'e1' }] });

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
