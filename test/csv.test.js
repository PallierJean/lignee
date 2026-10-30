import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { buildRegistreCsv } from '../js/services/csv.js';
import { loadTree, person } from './helpers.js';

describe('registre CSV', () => {
  test('BOM, en-tête, point-virgule, guillemets, formules neutralisées', () => {
    loadTree([
      person('a', { given: 'Jean; Paul', surname: 'Martin', sex: 'M', notes: 'dit "le grand"\nfin' }),
      person('b', { given: '=CMD()', surname: 'Martin', sex: 'F', fatherId: 'a' }),
    ]);
    const csv = buildRegistreCsv();
    assert.ok(csv.startsWith('﻿Nom de famille;Prénoms;'));
    assert.ok(csv.includes('"Jean; Paul"'));
    assert.ok(csv.includes('"dit ""le grand""\nfin"'));
    assert.ok(csv.includes("'=CMD()"));
    assert.ok(csv.includes('Jean; Paul MARTIN'));
    assert.equal(csv.split('\r\n').length, 4);
  });
});
