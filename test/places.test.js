import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { placeUses, placesByDepartment, migrations, cityOf, cityUses, datedBirths } from '../js/model/places.js';
import { knownPlaces, locatePlaces, placeQuery, placesToLocate, placesToRelocate } from '../js/services/geocode.js';
import { GEO_KEY, GEO_OLD_KEY } from '../js/config.js';
import { loadTree, person } from './helpers.js';

describe('lieux', () => {
  test('usages et migrations entre générations', () => {
    loadTree([
      person('p', { birthPlace: 'Lyon', deathPlace: 'Paris' }),
      person('m', { birthPlace: 'Lyon' }),
      person('c', { birthPlace: 'Paris', fatherId: 'p', motherId: 'm' }),
      person('d', { birthPlace: 'Lyon', fatherId: 'p' }),
    ]);
    assert.deepEqual(placeUses().map((x) => [x.name, x.n]), [['Lyon', 3], ['Paris', 2]]);
    assert.deepEqual(migrations(), [{ from: 'Lyon', to: 'Paris', n: 2, years: [] }]);
  });

  test('migrations jusqu’à une année : celles des enfants nés avant', () => {
    loadTree([
      person('p', { birthDate: '1850', birthPlace: 'Tulle (19)' }),
      person('c', { birthDate: '12/03/1880', birthPlace: 'Brive-la-Gaillarde (19)', fatherId: 'p' }),
      person('d', { birthDate: '1910', birthPlace: 'Brive-la-Gaillarde (19)', fatherId: 'p' }),
      person('e', { birthPlace: 'Paris', fatherId: 'c' }),
    ]);
    assert.deepEqual(migrations(), [
      { from: 'Tulle (19)', to: 'Brive-la-Gaillarde (19)', n: 2, years: [1880, 1910] },
      { from: 'Brive-la-Gaillarde (19)', to: 'Paris', n: 1, years: [] },
    ]);
    assert.deepEqual(migrations(1899), [{ from: 'Tulle (19)', to: 'Brive-la-Gaillarde (19)', n: 1, years: [1880] }], 'sans année de naissance : pas sur la frise');
    assert.deepEqual(migrations(1849), []);
    assert.deepEqual(datedBirths().map((b) => [b.id, b.name, b.year]), [['p', 'Tulle (19)', 1850], ['c', 'Brive-la-Gaillarde (19)', 1880], ['d', 'Brive-la-Gaillarde (19)', 1910]]);
  });

  test('carte : communes seulement, lieux-dits réunis, migrations entre communes', () => {
    assert.equal(cityOf('Bourg, Masseret (19)'), 'Masseret (19)');
    assert.equal(cityOf('Masseret (19)'), 'Masseret (19)');
    assert.equal(cityOf('Kreuzberg, Berlin, Allemagne'), 'Berlin, Allemagne');
    assert.equal(cityOf('Belgique'), 'Belgique');
    loadTree([
      person('p', { birthPlace: 'Roussely, Orgnac-sur-Vézère (19)' }),
      person('c', { birthPlace: 'Bressouneix, Orgnac-sur-Vézère (19)', deathPlace: 'Brive-la-Gaillarde (19)', fatherId: 'p' }),
      person('d', { birthPlace: 'Orgnac-sur-Vézère (19)', fatherId: 'p' }),
      person('e', { birthPlace: 'Le Bourg, Brive-la-Gaillarde (19)', fatherId: 'c' }),
    ]);
    assert.deepEqual(cityUses().map((x) => [x.name, x.n, x.ids.size]), [['Orgnac-sur-Vézère (19)', 3, 3], ['Brive-la-Gaillarde (19)', 2, 2]]);
    assert.deepEqual(migrations(), [{ from: 'Orgnac-sur-Vézère (19)', to: 'Brive-la-Gaillarde (19)', n: 1, years: [] }], 'd’un lieu-dit à l’autre de la même commune : pas de migration');
    assert.equal(placeUses().length, 5, 'la vue Lieux garde les lieux-dits');
  });

  test('rangement par département, ville puis lieu-dit', () => {
    loadTree([
      person('a', { birthPlace: 'Roussely, Orgnac-sur-Vézère (19)', deathPlace: 'Limoges (87)' }),
      person('b', { birthPlace: 'Orgnac-sur-Vézère (19)', deathPlace: 'Ajaccio (2A)' }),
      person('c', { birthPlace: 'Bressouneix, Orgnac-sur-Vézère (19)', deathPlace: 'Brive-la-Gaillarde (Corrèze)' }),
      person('d', { birthPlace: 'Paris', deathPlace: 'Bastia (2B)' }),
      person('e', { birthPlace: 'Manosque (04)', deathPlace: 'Saint-Denis (974)' }),
      person('f', { birthPlace: 'Brest (29)', deathPlace: 'Limoges (87)' }),
      person('g', { birthPlace: 'Bruxelles, Belgique', deathPlace: 'Cologne, Allemagne' }),
    ]);
    assert.deepEqual(placesByDepartment().map((x) => x.name), [
      'Manosque (04)',
      'Brive-la-Gaillarde (Corrèze)',
      'Orgnac-sur-Vézère (19)',
      'Bressouneix, Orgnac-sur-Vézère (19)',
      'Roussely, Orgnac-sur-Vézère (19)',
      'Ajaccio (2A)',
      'Bastia (2B)',
      'Brest (29)',
      'Limoges (87)',
      'Saint-Denis (974)',
      'Paris',
      'Cologne, Allemagne',
      'Bruxelles, Belgique',
    ]);
  });

  test('localisation : cache, lieu introuvable, panne', async () => {
    localStorage.removeItem(GEO_KEY);
    const asked = [];
    globalThis.fetch = async (url) => {
      asked.push([decodeURIComponent(url.split('q=')[1]), url.includes('countrycodes=fr')]);
      return { ok: true, json: async () => (url.includes('Lyon') ? [{ lat: '45.7', lon: '4.8' }] : []) };
    };
    assert.equal(await locatePlaces(['Lyon'], () => {}), 1);
    await locatePlaces(['Nulle-Part'], () => {});
    assert.deepEqual(Object.fromEntries(knownPlaces()), { Lyon: { lat: 45.7, lon: 4.8 }, 'Nulle-Part': null });
    assert.deepEqual(asked, [['Lyon', true], ['Nulle-Part', true]], 'un lieu sans pays est cherché en France');
    await locatePlaces(['Bruxelles, Belgique'], () => {});
    assert.deepEqual(asked.at(-1), ['Bruxelles, Belgique', false]);
    globalThis.fetch = async () => ({ ok: false, status: 429 });
    await assert.rejects(locatePlaces(['Paris'], () => {}));
  });

  test('localisation : la commune est cherchée dans son département, un homonyme ailleurs est écarté', async () => {
    localStorage.removeItem(GEO_KEY);
    assert.equal(placeQuery('Troche (19)').q, 'Troche, Corrèze');
    assert.equal(placeQuery('Roussely, Orgnac-sur-Vézère (19)').q, 'Orgnac-sur-Vézère, Corrèze');
    const at = (lat, dept) => ({ lat: String(lat), lon: '1', address: { 'ISO3166-2-lvl6': 'FR-' + dept } });
    globalThis.fetch = async (url) => ({ ok: true, json: async () => (url.includes('Troche') ? [at(46, '69'), at(45.39, '19')] : [at(48, '75')]) });
    await locatePlaces(['Troche (19)', 'Brive-la-Gaillarde (19)'], () => {});
    assert.deepEqual(Object.fromEntries(knownPlaces()), { 'Troche (19)': { lat: 45.39, lon: 1 }, 'Brive-la-Gaillarde (19)': null });
  });

  test('localisation : les lieux trouvés avant ne sont plus affichés, ils sont à relocaliser, puis oubliés', () => {
    localStorage.setItem(GEO_OLD_KEY, JSON.stringify({ 'Troche (19)': { lat: 46, lon: 4.4 }, 'Tulle (19)': { lat: 45.27, lon: 1.77 } }));
    localStorage.setItem(GEO_KEY, JSON.stringify({ 'Tulle (19)': { lat: 45.267, lon: 1.77 } }));
    assert.equal(knownPlaces().has('Troche (19)'), false, 'position douteuse : pas sur la carte');
    assert.deepEqual(knownPlaces().get('Tulle (19)'), { lat: 45.267, lon: 1.77 });
    assert.deepEqual(placesToLocate(['Troche (19)', 'Tulle (19)', 'Ussel (19)']), ['Troche (19)', 'Ussel (19)']);
    assert.deepEqual(placesToRelocate(['Troche (19)', 'Tulle (19)', 'Ussel (19)']), ['Troche (19)'], 'Ussel n’a jamais été demandé');
    localStorage.setItem(GEO_KEY, JSON.stringify({ 'Tulle (19)': { lat: 45.267, lon: 1.77 }, 'Troche (19)': { lat: 45.39, lon: 1.44 } }));
    assert.deepEqual(placesToRelocate(['Troche (19)']), []);
    assert.equal(localStorage.getItem(GEO_OLD_KEY), null, 'tout est relocalisé : les anciennes positions sont oubliées');
  });
});
