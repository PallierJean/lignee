import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { personStory, personSources, bookSections, whenText } from '../js/model/narrative.js';
import { example, loadTree, person } from './helpers.js';

describe('livret', () => {
  test('récit accordé, dates et lieux rédigés', () => {
    loadTree([
      person('f', { given: 'Paul', surname: 'Roux', sex: 'M' }),
      person('a', {
        given: 'Anne', surname: 'Roux', sex: 'F', fatherId: 'f', birthDate: '12/03/1932', birthPlace: 'Lyon',
        deathDate: '1990', occupation: 'Institutrice', sources: [{ id: 's', kind: 'birth', fact: 'birth' }],
      }),
    ]);
    const text = personStory('a');
    assert.match(text, /^Anne est née le 12 Mars 1932 à Lyon, fille de Paul ROUX\./);
    assert.match(text, /Profession : Institutrice\./);
    assert.match(text, /Décédée en 1990, à environ 58 ans\./);
    assert.equal(personSources('a'), 'Sources : Acte de naissance.');
    assert.equal(whenText('vers 1850'), 'vers 1850');
    assert.equal(whenText('05 Octobre 1863'), 'le 05 Octobre 1863');
    assert.equal(whenText('Octobre 1863'), 'en Octobre 1863');
    assert.equal(whenText('printemps 1944 ?'), 'printemps 1944 ?');
    assert.equal(whenText('03/1932'), 'en Mars 1932');
  });

  test('fiche presque vide : pas de phrase qui répète le nom', () => {
    loadTree([person('a', { given: 'Pierre', surname: 'Roux', sex: 'M', deceased: true }), person('b', { given: 'Lou' })]);
    assert.equal(personStory('a'), 'Décédé.');
    assert.equal(personStory('b'), 'Aucune information renseignée pour l’instant.');
  });

  test('un couple reste groupé dans sa génération', () => {
    loadTree([
      person('a', { given: 'A', birthDate: '1800' }), person('c', { given: 'C', birthDate: '1801' }),
      person('b', { given: 'B', birthDate: '1810' }), person('k', { given: 'K', fatherId: 'a', motherId: 'b' }),
      person('k2', { given: 'K2', fatherId: 'c' }),
    ], [{ a: 'a', b: 'b' }]);
    assert.deepEqual(bookSections()[0].people.map((x) => x.id), ['a', 'b', 'c']);
  });

  test('sections : la génération la plus ancienne d’abord', () => {
    const ex = example();
    loadTree(ex.people, ex.unions);
    const sections = bookSections();
    assert.equal(sections.flatMap((s) => s.people).length, ex.people.length);
    assert.deepEqual(sections.map((s) => s.gen), sections.map((_, i) => i + 1));
  });
});
