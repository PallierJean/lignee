import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { S } from '../js/state.js';
import {
  opSet, opUpdate, opDelete, beginAction, commitAction, undoAction, redoAction, canUndo, canRedo,
} from '../js/services/storage.js';
import { resetHistory } from '../js/services/history.js';
import { loadTree, person } from './helpers.js';

describe('annuler / rétablir', () => {
  beforeEach(() => {
    S.mode = 'local';
    S.tree = 'test';
    resetHistory();
    loadTree([person('a', { given: 'Anne' }), person('b', { given: 'Paul', fatherId: 'a' })], [{ id: 'u', a: 'a', b: 'b' }]);
  });

  test('une action complète (fiche, liens, union) s’annule et se rétablit d’un seul coup', async () => {
    beginAction('hist.delete');
    await opUpdate('people', 'b', { fatherId: null });
    await opDelete('unions', 'u');
    await opDelete('people', 'a');
    commitAction();
    assert.ok(canUndo());

    await undoAction();
    assert.equal(S.people.get('a').given, 'Anne');
    assert.equal(S.people.get('b').fatherId, 'a');
    assert.ok(S.unions.has('u'));
    assert.ok(canRedo());

    await redoAction();
    assert.ok(!S.people.has('a'));
    assert.equal(S.people.get('b').fatherId, null);
    assert.ok(!S.unions.has('u'));
  });

  test('un ajout annulé disparaît ; une nouvelle action vide « rétablir »', async () => {
    beginAction('hist.add');
    await opSet('people', 'c', { given: 'Lou' });
    commitAction();
    await undoAction();
    assert.ok(!S.people.has('c'));
    beginAction('hist.edit');
    await opUpdate('people', 'a', { given: 'Annie' });
    commitAction();
    assert.ok(!canRedo());
  });

  test('l’annulation enregistre : le stockage suit', async () => {
    beginAction('hist.edit');
    await opUpdate('people', 'a', { given: 'Annie' });
    commitAction();
    await undoAction();
    assert.equal(JSON.parse(localStorage.getItem('lignee.tree.test')).people.a.given, 'Anne');
  });

  test('action sans effet : rien dans l’historique ; seuls les documents touchés sont rendus', async () => {
    beginAction('hist.edit');
    commitAction();
    assert.ok(!canUndo());
    beginAction('hist.edit');
    await opUpdate('people', 'a', { given: 'Annie' });
    commitAction();
    S.people.set('b', { ...S.people.get('b'), given: 'Modifié ailleurs' });
    await undoAction();
    assert.equal(S.people.get('b').given, 'Modifié ailleurs');
  });

  test('écritures hors action : non suivies', async () => {
    await opUpdate('people', 'a', { given: 'Annie' });
    assert.ok(!canUndo());
  });
});
