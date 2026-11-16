import assert from 'node:assert/strict';
import { test, describe, beforeEach, afterEach } from 'node:test';
import { S } from '../js/state.js';
import { loadLocal, saveLocal, opSet, opUpdate, opDelete, createTree, deleteTree } from '../js/services/storage.js';
import { forgetBrowserStore, NEARLY_FULL } from '../js/services/storage/local.js';
import { TREES_KEY, TREE_KEY } from '../js/config.js';
import { resetApp } from './helpers.js';

const el = (id) => document.getElementById(id);

/**
 * IndexedDB in memory: the few calls of storage/local.js (open, one store, put, delete, getAll,
 * getAllKeys), with events fired later as in a browser. `full` refuses writes as a full disk does;
 * `blocked` refuses the opening.
 */
function fakeIndexedDB() {
  const stores = new Map();
  const fake = { stores, full: false, blocked: false, opens: 0 };
  const later = (fn) => setTimeout(fn, 0);
  const request = (run) => {
    const req = {};
    later(() => {
      try {
        req.result = run();
        if (req.onsuccess) req.onsuccess();
      } catch (e) {
        req.error = e;
        if (req.onerror) req.onerror();
      }
    });
    return req;
  };
  const database = {
    transaction(name, mode) {
      const data = stores.get(name);
      const staged = new Map(data);
      const tx = { error: null };
      let failed = false;
      const write = (fn) => request(() => {
        if (mode !== 'readwrite') throw new Error('read-only transaction');
        if (fake.full) {
          failed = true;
          tx.error = Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
          throw tx.error;
        }
        return fn();
      });
      tx.objectStore = () => ({
        put: (value, key) => write(() => { staged.set(key, structuredClone(value)); return key; }),
        delete: (key) => write(() => { staged.delete(key); }),
        getAll: () => request(() => [...data.values()].map((v) => structuredClone(v))),
        getAllKeys: () => request(() => [...data.keys()]),
      });
      setTimeout(() => {
        if (failed) return tx.onabort && tx.onabort();
        data.clear();
        for (const [k, v] of staged) data.set(k, v);
        if (tx.oncomplete) tx.oncomplete();
      }, 5);
      return tx;
    },
  };
  fake.open = () => {
    fake.opens++;
    const req = {};
    later(() => {
      if (fake.blocked) {
        req.error = new Error('blocked');
        return req.onerror();
      }
      if (!stores.size) {
        req.result = { createObjectStore: (name) => stores.set(name, new Map()) };
        req.onupgradeneeded();
      }
      req.result = database;
      req.onsuccess();
    });
    return req;
  };
  return fake;
}

describe('arbres du navigateur dans IndexedDB', () => {
  let idb;

  beforeEach(() => {
    resetApp();
    idb = fakeIndexedDB();
    globalThis.indexedDB = idb;
    forgetBrowserStore();
  });

  afterEach(() => {
    delete globalThis.indexedDB;
    forgetBrowserStore();
  });

  /** A new page: the database is opened and read again. */
  async function reload() {
    forgetBrowserStore();
    S.people = new Map();
    S.trees = new Map();
    await loadLocal();
  }

  test('an older tree left in localStorage moves to IndexedDB at opening', async () => {
    localStorage.setItem(TREES_KEY, JSON.stringify([{ id: 'principal', name: 'Mon arbre', createdAt: 0 }]));
    localStorage.setItem(TREE_KEY + 'principal', JSON.stringify({ people: { a: { given: 'Ana' } } }));
    await loadLocal();
    assert.equal(S.people.get('a').given, 'Ana');
    assert.equal(localStorage.getItem(TREE_KEY + 'principal'), null, 'localStorage freed');
    assert.equal(idb.stores.get('trees').get('principal').people.a.given, 'Ana');
    assert.ok(localStorage.getItem(TREES_KEY), 'the list of trees stays in localStorage');
    await reload();
    assert.equal(S.people.get('a').given, 'Ana');
  });

  test('a tree far beyond what localStorage takes is saved, and found again', async () => {
    await loadLocal();
    const set = localStorage.setItem;
    localStorage.setItem = function (k, v) {
      if (k.startsWith(TREE_KEY)) throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
      return set.call(this, k, v);
    };
    try {
      const photo = 'data:image/jpeg;base64,' + 'A'.repeat(NEARLY_FULL * 2);
      await opSet('people', 'p', { given: 'Paul', photo });
      el('toast').textContent = '';
      await opUpdate('people', 'p', { surname: 'ROUX' });
      assert.equal(el('toast').textContent, '', 'neither error nor « bientôt plein »');
    } finally {
      localStorage.setItem = set;
    }
    await reload();
    assert.equal(S.people.get('p').surname, 'ROUX');
    assert.equal(S.people.get('p').photo.length, 23 + NEARLY_FULL * 2);
  });

  test('disk full: not saved, the change is undone in memory and after a reload', async () => {
    await loadLocal();
    await opSet('people', 'kept', { given: 'Kept' });
    idb.full = true;
    await assert.rejects(opSet('people', 'lost', { given: 'Lost' }));
    await assert.rejects(opUpdate('people', 'kept', { given: 'Changed' }));
    await assert.rejects(opDelete('people', 'kept'));
    assert.match(el('toast').textContent, /plus de place/);
    assert.equal(S.people.has('lost'), false);
    assert.equal(S.people.get('kept').given, 'Kept');
    idb.full = false;
    await reload();
    assert.equal(S.people.get('kept').given, 'Kept');
    assert.equal(S.people.has('lost'), false);
  });

  test('IndexedDB blocked: localStorage, as before', async () => {
    idb.blocked = true;
    await loadLocal();
    await opSet('people', 'a', { given: 'Ana' });
    assert.ok(JSON.parse(localStorage.getItem(TREE_KEY + 'principal')).people.a);
    assert.equal(idb.stores.size, 0);
  });

  test('opened once; trees created and deleted', async () => {
    await loadLocal();
    await loadLocal();
    assert.equal(idb.opens, 1);
    await opSet('people', 'a', { given: 'Ana' });
    const id = await createTree('Autre');
    S.tree = id;
    S.people = new Map([['b', { given: 'Bob' }]]);
    await saveLocal();
    assert.ok(idb.stores.get('trees').has(id));
    await deleteTree(id);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(idb.stores.get('trees').has(id), false);
    await reload();
    assert.deepEqual([...S.trees.keys()], ['principal']);
    assert.equal(S.people.get('a').given, 'Ana');
  });
});
