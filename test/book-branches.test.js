import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { S } from '../js/state.js';
import { bookChapters, branchOf, branchTimeline, directLine } from '../js/model/book-branches.js';
import { fullBookHTML } from '../js/ui/booklet.js';
import { loadTree, person } from './helpers.js';

/** Trois générations au-dessus de « moi », plus une tante et un enfant. */
function family() {
  loadTree([
    person('ffa', { sex: 'M', surname: 'Garnier', birthDate: '1850', deathDate: '1910' }),
    person('ff', { sex: 'M', surname: 'Garnier', fatherId: 'ffa', birthDate: '1885',
      media: [{ id: 'm1', photo: 'data:image/jpeg;base64,AA==', title: 'Mariage', tags: [] }] }),
    person('fm', { sex: 'F', surname: 'Garnier', maidenName: 'Vidal', birthDate: '1892' }),
    person('mf', { sex: 'M', surname: 'Mercier', birthDate: '1897' }),
    person('f', { sex: 'M', surname: 'Garnier', fatherId: 'ff', motherId: 'fm', birthDate: '1920' }),
    person('m', { sex: 'F', surname: 'Garnier', maidenName: 'Mercier', fatherId: 'mf', birthDate: '1926' }),
    person('me', { sex: 'M', surname: 'Garnier', fatherId: 'f', motherId: 'm', birthDate: '1956' }),
    person('aunt', { sex: 'F', surname: 'Garnier', fatherId: 'ff', motherId: 'fm', birthDate: '1922' }),
    person('kid', { fatherId: 'me', birthDate: '1990' }),
  ], [{ a: 'ff', b: 'fm', date: '1919' }]);
  S.focus = 'me';
}

describe('livre de famille complet', () => {
  test('lignée directe avec numéros Sosa, implexe au plus petit numéro', () => {
    loadTree([
      person('gp'),
      person('f', { fatherId: 'gp' }),
      person('m', { fatherId: 'gp' }),
      person('a', { fatherId: 'f', motherId: 'm' }),
      person('x'),
    ]);
    assert.deepEqual(directLine('a'), [{ id: 'a', sosa: 1 }, { id: 'f', sosa: 2 }, { id: 'm', sosa: 3 }, { id: 'gp', sosa: 4 }]);
  });

  test('branche d’un numéro Sosa : le grand-parent dont il descend', () => {
    assert.deepEqual([1, 2, 3, 4, 7, 8, 9, 10, 15, 16, 31, 32, 63].map(branchOf), [1, 2, 3, 4, 7, 4, 4, 5, 7, 4, 7, 4, 7]);
  });

  test('chapitres : la personne et ses proches, une branche par grand-parent, puis les autres', () => {
    family();
    const chapters = bookChapters('me');
    assert.deepEqual(chapters.map((c) => c.title),
      ['La personne centrale et ses proches', 'Branche GARNIER', 'Branche VIDAL', 'Branche MERCIER', 'Les autres personnes de l’arbre']);
    assert.deepEqual(chapters.map((c) => c.people.map((x) => x.id)), [['me', 'f', 'm', 'kid'], ['ffa', 'ff'], ['fm'], ['mf'], ['aunt']]);
    assert.match(chapters[1].sub, /côté paternel, père du père · 1850 – 1885/);
    assert.equal(chapters[1].album.length, 1);
    assert.deepEqual(chapters[4].timeline, []); // pas de frise pour les autres
    assert.deepEqual(bookChapters(null), []);
  });

  test('frise : faits de la branche seulement, avec les repères historiques de la période', () => {
    family();
    const rows = branchTimeline(['ffa', 'ff']);
    assert.ok(rows.some((r) => r.kind === 'birth' && r.year === 1850));
    assert.ok(rows.some((r) => r.kind === 'union' && r.year === 1919));
    assert.ok(rows.some((r) => r.kind === 'history' && r.year === 1870));
    assert.ok(!rows.some((r) => r.year === 1920 && r.kind === 'birth')); // le père n'est pas de la branche
    assert.deepEqual(rows.map((r) => r.year), rows.map((r) => r.year).toSorted((a, b) => a - b));
  });

  test('frise : une union entre deux membres de la branche n’apparaît qu’une fois', () => {
    family();
    const rows = branchTimeline(['ffa', 'ff', 'fm']).filter((r) => r.kind === 'union');
    assert.equal(rows.length, 1);
  });

  test('chaque bloc de frise et d’album est un seul élément, pour être mesuré', async () => {
    family();
    const out = await fullBookHTML('Famille GARNIER');
    for (const cls of ['bk-timeline', 'bk-album']) {
      assert.match(out, new RegExp(`<div class="bk-block">(<h3 class="bk-sub">[^<]*</h3>)?<(table|div) class="${cls}"`));
    }
  });

  test('pages : couverture, sommaire des branches, frise et album', async () => {
    family();
    const out = await fullBookHTML('Famille GARNIER');
    assert.match(out, /Livre de famille/);
    assert.match(out, /<ol class="bk-toc">.*Branche GARNIER.*Branche MERCIER/s);
    assert.match(out, /class="bk-timeline"/);
    assert.match(out, /class="bk-album".*Mariage/s);
  });
});
