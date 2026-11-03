import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { completeness, completenessReport, directLine, missingText } from '../js/model/completeness.js';
import { example, loadTree, person } from './helpers.js';
import { ficheHTML } from '../js/ui/fiche.js';

describe('complétude des fiches', () => {
  test('fiche complète d’une personne décédée', () => {
    loadTree([
      person('f'), person('m'),
      person('a', {
        fatherId: 'f', motherId: 'm', birthDate: '12/03/1900', birthPlace: 'Lyon', deathDate: '04/05/1980', deathPlace: 'Paris',
        sources: [{ id: 's1', fact: 'birth' }, { id: 's2', fact: 'death' }],
      }),
    ]);
    assert.deepEqual(completeness('a'), { score: 100, missing: [] });
    assert.equal(missingText(completeness('a')), '');
  });

  test('vivant : le décès ne compte pas ; une année seule compte pour moitié', () => {
    loadTree([person('a', { birthDate: '1990', birthPlace: 'Lyon' })]);
    // naissance 0,5 + lieu 1 sur 5 critères (date, lieu, père, mère, source)
    assert.deepEqual(completeness('a'), { score: 30, missing: ['birthDateDay', 'father', 'mother', 'birthSource'] });
    assert.equal(missingText(completeness('a')), 'Manque : jour de naissance, père, mère, source de la naissance');
  });

  test('fiche vide d’une personne décédée', () => {
    loadTree([person('a', { deceased: true })]);
    const c = completeness('a');
    assert.equal(c.score, 0);
    assert.equal(c.missing.length, 8);
    assert.equal(missingText(c), 'Rien n’est renseigné.');
    assert.match(ficheHTML('a'), /<dt>Complétude<\/dt><dd>0 %<small class="ev-note">Rien n’est renseigné.<\/small>/);
  });

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

  test('bilan : moyenne, critères, fiches les plus pauvres de la lignée', () => {
    const ex = example();
    loadTree(ex.people, ex.unions);
    const focus = ex.people.find((p) => p.given === 'Camille').id;
    const r = completenessReport(focus, 3);
    assert.ok(r.average > 0 && r.average <= 100);
    assert.equal(r.poorest.length, 3);
    assert.ok(r.poorest[0].score <= r.poorest[2].score);
    assert.equal(r.poorest.every((x) => x.sosa >= 1), true);
    assert.deepEqual(r.criteria.map((c) => c.key).slice(0, 2), ['birthDate', 'birthPlace']);
    assert.deepEqual(completenessReport(null).poorest, []);
  });
});
