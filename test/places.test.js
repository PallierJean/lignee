import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { placeUses, migrations } from '../js/model/places.js';
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
    assert.deepEqual(asked, ['Lyon', 'Nulle-Part']);
    globalThis.fetch = async () => ({ ok: false, status: 429 });
    await assert.rejects(locatePlaces(['Paris'], () => {}));
  });
});
