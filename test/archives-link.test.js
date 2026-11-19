import assert from 'node:assert/strict';
import { test, describe, before, beforeEach, afterEach } from 'node:test';
import { loadCommunes, placeDepartment } from '../js/model/communes.js';
import { recordHTML, openArchives } from '../js/ui/record.js';
import { resetTownHalls } from '../js/services/town-hall.js';
import { loadTree, person, resetApp } from './helpers.js';

describe('archives départementales d’un lieu', () => {
  before(() => loadCommunes());

  test('département d’un lieu : celui qu’il indique, sinon celui de sa commune s’il est seul', () => {
    assert.equal(placeDepartment('Tulle (19)'), '19');
    assert.equal(placeDepartment('Tulle (Corrèze)'), '19');
    assert.equal(placeDepartment('le Bourg, Confolens'), '16');
    assert.equal(placeDepartment('Saint-Étienne'), '42');
    assert.equal(placeDepartment('Liège, Belgique'), '', 'à l’étranger : pas d’archives départementales');
    assert.equal(placeDepartment('Nulle-Part-sur-Rien'), '', 'commune inconnue');
    assert.equal(placeDepartment(''), '');
  });

  test('sur la fiche : un lien Archives après chaque lieu en France, aucun à l’étranger', () => {
    resetApp();
    loadTree([person('a', { given: 'Léon', surname: 'Martin', birthDate: '1880', birthPlace: 'Tulle (19)', deathPlace: 'Liège, Belgique', deceased: true })]);
    const out = recordHTML('a');
    assert.equal(out.match(/data-act="archives-open"/g).length, 1);
    assert.match(out, /data-act="archives-open" data-place="Tulle \(19\)"/);
    loadTree([person('b', { given: 'Rose', birthDate: '1880' })]);
    assert.doesNotMatch(recordHTML('b'), /archives-open/, 'sans lieu : pas de lien');
  });

  describe('ouverture du site des archives', () => {
    const nativeFetch = globalThis.fetch;
    const nativeOpen = window.open;
    let tab;
    let asked;
    beforeEach(() => {
      resetApp();
      resetTownHalls();
      asked = [];
      tab = { opener: 'page', closed: false, location: { href: 'about:blank' }, close() { this.closed = true; } };
      window.open = () => tab;
    });
    afterEach(() => {
      globalThis.fetch = nativeFetch;
      window.open = nativeOpen;
    });

    test('le site trouvé dans l’annuaire, seul le numéro du département envoyé', async () => {
      globalThis.fetch = async (url) => {
        asked.push(url);
        return { ok: true, json: async () => ({ results: [{ nom: 'Archives départementales de la Corrèze', site_internet: '[{"valeur": "https://archives.correze.fr"}]' }] }) };
      };
      await openArchives('Tulle (19)');
      assert.equal(tab.opener, null);
      assert.equal(tab.location.href, 'https://archives.correze.fr');
      const where = new URL(asked[0]).searchParams.get('where');
      assert.match(where, /startswith\(code_insee_commune, "19"\)/);
      assert.doesNotMatch(where, /Tulle/, 'la commune ne part pas');
    });

    test('annuaire sans site ou en panne : sa recherche des archives du département', async () => {
      globalThis.fetch = async () => ({ ok: false, status: 503 });
      await openArchives('Confolens');
      assert.equal(tab.location.href, 'https://lannuaire.service-public.fr/recherche?whoWhat=Archives%20d%C3%A9partementales&where=Charente');
    });

    test('département introuvable : onglet refermé et message', async () => {
      globalThis.fetch = async () => assert.fail('rien à demander');
      await openArchives('Nulle-Part-sur-Rien');
      assert.ok(tab.closed);
      assert.match(document.getElementById('toast').textContent, /Département inconnu pour « Nulle-Part-sur-Rien »/);
    });
  });
});
