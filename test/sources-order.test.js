import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inLifeOrder } from '../js/model/sources.js';

test('sources in the order of a life: birth, marriage, death, then the rest', () => {
  const docs = [
    { title: 'Recensement', kind: 'census' },
    { title: 'Décès', kind: 'death', fact: 'death' },
    { title: 'Mariage', kind: 'marriage', fact: 'union:u1' },
    { title: 'Sépulture', kind: 'burial' },
    { title: 'Baptême', kind: 'baptism' },
    { title: 'Naissance', kind: 'birth', fact: 'birth' },
    { title: 'Contrat', kind: 'marriage' },
  ];
  assert.deepEqual(inLifeOrder(docs).map((s) => s.title),
    ['Baptême', 'Naissance', 'Mariage', 'Contrat', 'Décès', 'Sépulture', 'Recensement']);
  assert.equal(docs[0].title, 'Recensement', 'the list given is left as it was');
  // The fact cited wins over the kind of the document
  assert.deepEqual(inLifeOrder([{ title: 'A', kind: 'other', fact: 'death' }, { title: 'B', kind: 'death', fact: 'birth' }]).map((s) => s.title), ['B', 'A']);
});
