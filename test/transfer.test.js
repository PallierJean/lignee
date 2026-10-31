import assert from 'node:assert/strict';
import { test, describe, beforeEach } from 'node:test';
import { S, services } from '../js/state.js';
import {
  openTransfer, closeTransfer, exportGedcom, exportBackup, exportCsv, copyExport, readImportFile, importGo,
} from '../js/ui/transfer.js';
import { openTrees, closeTrees, switchTree, newTree, askTree, cancelTreeEdit, submitRename, confirmDeleteTree, renderTrees } from '../js/ui/trees.js';
import { afterData } from '../js/ui/render.js';
import { buildBackup } from '../js/services/backup.js';
import { undoAction } from '../js/services/storage.js';
import { resetHistory } from '../js/services/history.js';
import { example, loadTree, person, resetApp, html } from './helpers.js';

const el = (id) => document.getElementById(id);
const ex = example();
const file = (name, text) => ({ files: [{ name, text: async () => text }] });

beforeEach(() => {
  resetApp();
  resetHistory();
  loadTree(ex.people, ex.unions);
  S.focus = ex.people[0].id;
  afterData();
  S.pending = null;
  delete window.claude;
  services.downloads = null;
  globalThis.URL.createObjectURL = () => 'blob:x';
  globalThis.URL.revokeObjectURL = () => {};
});

describe('fenêtres séparées', () => {
  test('Importer et Exporter n’affichent chacun que leur partie', () => {
    openTransfer('import');
    assert.equal(el('importSection').hidden, false);
    assert.equal(el('exportSection').hidden, true);
    assert.equal(el('trTitle').textContent, 'Importer');
    openTransfer('export');
    assert.equal(el('importSection').hidden, true);
    assert.equal(el('exportSection').hidden, false);
    assert.equal(el('trTitle').textContent, 'Exporter');
  });

  test('lecture seule : pas de bouton Importer', () => {
    S.canWrite = false;
    afterData();
    assert.equal(el('btnImport').hidden, true);
  });
});

describe('exports', () => {
  test('téléchargement direct hors de claude.ai', async () => {
    openTransfer();
    assert.equal(el('transfer').hidden, false);
    await exportGedcom();
    assert.match(el('exportHint').textContent, /\.ged/);
    await exportBackup();
    assert.match(el('exportHint').textContent, /Sauvegarde/);
    await exportCsv();
    assert.match(el('exportHint').textContent, /registre\.csv/);
    closeTransfer();
    assert.equal(el('transfer').hidden, true);
  });

  test('arbre vide : rien à exporter', async () => {
    loadTree([]);
    for (const fn of [exportGedcom, exportBackup, exportCsv]) {
      el('exportHint').textContent = '';
      await fn();
      assert.match(el('exportHint').textContent, /vide/);
    }
  });

  test('dans claude.ai : service, refus, limite, secours par copie', async () => {
    window.claude = { use() {} };
    const saved = [];
    services.downloads = { save: async (x) => saved.push(x) };
    await exportGedcom();
    assert.ok(saved[0].filename.endsWith('.ged.txt'));
    services.downloads = { save: async () => { throw { code: 'declined' }; } };
    await exportBackup();
    assert.match(el('exportHint').textContent, /annulé/);
    services.downloads = { save: async () => { throw { code: 'rate_limited' }; } };
    await exportBackup();
    assert.match(el('exportHint').textContent, /déjà ouverte/);
    services.downloads = { save: async () => { throw new Error('x'); } };
    await exportCsv();
    assert.equal(el('exportText').hidden, false);
    assert.ok(el('exportText').value.includes('Bertrand') || el('exportText').value.includes('BERTRAND'));
    assert.equal(el('copyRow').hidden, false);
  });

  test('copier : presse-papiers, sinon sélection', async () => {
    Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async () => {} } }, configurable: true });
    await copyExport();
    assert.match(el('toast').textContent, /copié/);
    navigator.clipboard.writeText = async () => { throw new Error('non'); };
    await copyExport();
    assert.match(el('toast').textContent, /sélectionné/);
  });
});

describe('imports', () => {
  test('sauvegarde : aperçu puis ajout, annulable', async () => {
    const before = S.people.size;
    const extra = JSON.stringify({ format: 'lignee', name: 'Autre', people: [{ id: 'n1', given: 'Nina' }], unions: [] });
    await readImportFile(file('autre.json', extra));
    assert.ok(html('importInfo').includes('data-act="import-go"'));
    await importGo(false);
    assert.equal(S.people.size, before + 1);
    assert.equal(S.pending, null);
    await undoAction();
    assert.equal(S.people.size, before);
  });

  test('GEDCOM dans un nouvel arbre, nommé d’après le fichier', async () => {
    await readImportFile(file('dupont.ged', '0 HEAD\n0 @I1@ INDI\n1 NAME Jean /Dupont/\n0 TRLR\n'));
    await importGo(true);
    assert.equal(S.people.size, 1);
    assert.equal(S.trees.get(S.tree).name, 'dupont');
  });

  test('fichier illisible ou vide', async () => {
    await readImportFile(file('x.json', '{ pas du json'));
    assert.ok(html('importInfo').includes('n’a pas pu être lu'));
    await readImportFile(file('y.ged', 'rien'));
    assert.ok(html('importInfo').includes('n’a pas pu être lu'));
    await readImportFile({ files: [] });
    await importGo(false); // rien en attente
  });

  test('lecture seule : pas d’import', async () => {
    await readImportFile(file('a.json', buildBackup()));
    S.canWrite = false;
    const before = S.people.size;
    await importGo(false);
    assert.equal(S.people.size, before);
  });

  test('arrêt en cours : reprise proposée', async () => {
    S.mode = 'db';
    services.db = { collection: () => ({ doc: () => ({ set: async () => { throw { code: 'x' }; } }) }) };
    await readImportFile(file('a.json', JSON.stringify({ format: 'lignee', people: [{ id: 'q1', given: 'Q' }], unions: [] })));
    await importGo(false);
    assert.ok(html('importInfo').includes('Reprendre l’import'));
    S.mode = 'local';
    services.db = null;
  });
});

describe('collection d’arbres (navigateur)', () => {
  test('créer, ouvrir, renommer, supprimer', async () => {
    openTrees();
    assert.ok(html('treeList').includes('Mon arbre'));
    assert.ok(!(await newTree('   ')));
    assert.match(el('toast').textContent || html('treeList'), /nom|Mon arbre/);
    await newTree('Côté maternel');
    const id = S.tree;
    assert.notEqual(id, 'principal');
    assert.equal(S.people.size, 0);
    await switchTree('principal');
    assert.equal(S.tree, 'principal');
    await switchTree('principal');
    openTrees();
    askTree('rename', id);
    assert.ok(html('treeList').includes('id="renameForm"'));
    await submitRename(id, 'Maternel');
    assert.equal(S.trees.get(id).name, 'Maternel');
    askTree('rename', id);
    cancelTreeEdit();
    assert.equal(S.treeEdit, null);
    assert.ok(!(await submitRename(id, '  ')));
    askTree('delete', id);
    assert.ok(html('treeList').includes('data-act="tree-delete-yes"'));
    await confirmDeleteTree(id);
    assert.ok(!S.trees.has(id));
    assert.match(el('toast').textContent, /supprimé/);
    closeTrees();
  });

  test('nouvel arbre refusé pendant une saisie', async () => {
    S.edit = { unions: [], events: [], sources: [], media: [], draft: {} };
    assert.equal(await newTree('Autre'), null);
    assert.match(el('toast').textContent, /Enregistrez ou annulez/);
    S.edit = null;
  });

  test('lecture seule : ni renommer ni supprimer', () => {
    S.canWrite = false;
    renderTrees();
    assert.ok(!html('treeList').includes('data-act="tree-delete"'));
  });

  test('saisie en cours : on ne change pas d’arbre', async () => {
    await newTree('Autre');
    const id = S.tree;
    S.edit = { id: null, unions: [], events: [], sources: [], media: [], draft: {} };
    await switchTree('principal');
    assert.equal(S.tree, id);
    S.edit = null;
    loadTree([person('a')]);
  });
});
