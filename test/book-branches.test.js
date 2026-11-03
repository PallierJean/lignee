import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { S } from '../js/state.js';
import { bookChapters, branchOf, branchTimeline } from '../js/model/book-branches.js';
import { fullBookHTML } from '../js/ui/booklet.js';
import { loadTree, person } from './helpers.js';

/** Trois générations au-dessus de « moi », plus une tante et un enfant. */
function family() {
  loadTree([
    person('ffa', { sex: 'M', surname: 'Pallier', birthDate: '1850', deathDate: '1910' }),
    person('ff', { sex: 'M', surname: 'Pallier', fatherId: 'ffa', birthDate: '1885',
      media: [{ id: 'm1', photo: 'data:image/jpeg;base64,AA==', title: 'Mariage', tags: [] }] }),
    person('fm', { sex: 'F', surname: 'Pallier', maidenName: 'Planchon', birthDate: '1892' }),
    person('mf', { sex: 'M', surname: 'Bourrel', birthDate: '1897' }),
    person('f', { sex: 'M', surname: 'Pallier', fatherId: 'ff', motherId: 'fm', birthDate: '1920' }),
    person('m', { sex: 'F', surname: 'Pallier', maidenName: 'Bourrel', fatherId: 'mf', birthDate: '1926' }),
    person('me', { sex: 'M', surname: 'Pallier', fatherId: 'f', motherId: 'm', birthDate: '1956' }),
    person('aunt', { sex: 'F', surname: 'Pallier', fatherId: 'ff', motherId: 'fm', birthDate: '1922' }),
    person('kid', { fatherId: 'me', birthDate: '1990' }),
  ], [{ a: 'ff', b: 'fm', date: '1919' }]);
  S.focus = 'me';
}

describe('livre de famille complet', () => {
  test('branche d’un numéro Sosa : le grand-parent dont il descend', () => {
    assert.deepEqual([1, 2, 3, 4, 7, 8, 9, 10, 15, 16, 31, 32, 63].map(branchOf), [1, 2, 3, 4, 7, 4, 4, 5, 7, 4, 7, 4, 7]);
  });

  test('chapitres : la personne et ses proches, une branche par grand-parent, puis les autres', () => {
    family();
    const chapters = bookChapters('me');
    assert.deepEqual(chapters.map((c) => c.title),
      ['La personne centrale et ses proches', 'Branche PALLIER', 'Branche PLANCHON', 'Branche BOURREL', 'Les autres personnes de l’arbre']);
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

  test('pages : couverture, sommaire des branches, frise et album', async () => {
    family();
    const out = await fullBookHTML('Famille PALLIER');
    assert.match(out, /Livre de famille/);
    assert.match(out, /<ol class="bk-toc">.*Branche PALLIER.*Branche BOURREL/s);
    assert.match(out, /class="bk-timeline"/);
    assert.match(out, /class="bk-album".*Mariage/s);
  });
});
