import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { placeUses, placesByDepartment, migrations, cityOf, cityUses } from '../js/model/places.js';
import { knownPlaces, locatePlaces } from '../js/services/geocode.js';
import { GEO_KEY } from '../js/config.js';
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
    assert.deepEqual(migrations(), [{ from: 'Lyon', to: 'Paris', n: 2 }]);
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
    assert.deepEqual(migrations(), [{ from: 'Orgnac-sur-Vézère (19)', to: 'Brive-la-Gaillarde (19)', n: 1 }], 'd’un lieu-dit à l’autre de la même commune : pas de migration');
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
      asked.push(decodeURIComponent(url.split('q=')[1]));
      return { ok: true, json: async () => (url.includes('Lyon') ? [{ lat: '45.7', lon: '4.8' }] : []) };
    };
    assert.equal(await locatePlaces(['Lyon'], () => {}), 1);
    await locatePlaces(['Nulle-Part'], () => {});
    assert.deepEqual(Object.fromEntries(knownPlaces()), { Lyon: { lat: 45.7, lon: 4.8 }, 'Nulle-Part': null });
    assert.deepEqual(asked, ['Lyon, France', 'Nulle-Part, France'], 'un lieu sans pays est cherché en France');
    await locatePlaces(['Bruxelles, Belgique'], () => {});
    assert.equal(asked.at(-1), 'Bruxelles, Belgique');
    globalThis.fetch = async () => ({ ok: false, status: 429 });
    await assert.rejects(locatePlaces(['Paris'], () => {}));
  });
});
