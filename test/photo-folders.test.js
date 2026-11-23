import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nameFolder, personFolder, photoFolders, folderOfRef } from '../js/model/photo-folders.js';

test('dossier d’une personne : NOM_Prénom, l’année de naissance pour deux homonymes', () => {
  assert.equal(nameFolder({ surname: 'Dupont', given: 'Jean Pierre' }), 'DUPONT_Jean-Pierre');
  assert.equal(nameFolder({ maidenName: 'Faure', given: 'Marie' }), 'FAURE_Marie');
  assert.equal(nameFolder({}), '');
  const father = { surname: 'Dupont', given: 'Jean', birthDate: '1850' };
  const son = { surname: 'Dupont', given: 'Jean', birthDate: '1880-03-02' };
  const people = new Map([['f', father], ['s', son], ['x', {}]]);
  assert.equal(personFolder(father, people, 'f'), 'DUPONT_Jean_1850');
  assert.equal(personFolder(son, people, 's'), 'DUPONT_Jean_1880');
  assert.equal(personFolder({ surname: 'Roux', given: 'Ana' }, people), 'ROUX_Ana');
  assert.equal(personFolder({}, people, 'x'), 'sans-nom');
});

test('un acte va chez la personne dont il parle ; ce que personne ne cite, en galerie', () => {
  const people = new Map([
    ['w', { surname: 'Roux', given: 'Paul', citations: [{ source: 'death', role: 'witness' }] }],
    ['a', { surname: 'Roux', given: 'Ana', citations: [{ source: 'death' }, { source: 'birth', role: 'father' }] }],
    ['b', { surname: 'Faure', given: 'Luc' }],
  ]);
  people.get('b').sex = 'M';
  people.set('h', { surname: 'Blanc', given: 'Jules', sex: 'M', citations: [{ source: 'mar2' }] });
  people.set('e', { surname: 'Noir', given: 'Lise', sex: 'F', citations: [{ source: 'mar2' }] });
  people.set('e2', { surname: 'Vert', given: 'Rose', sex: 'F' });
  // The wife first in the union, then first to cite: the certificate still goes to the husband
  const unions = new Map([['u', { a: 'a', b: 'b', citations: [{ source: 'mar' }] }], ['v', { a: 'e2', b: 'w', citations: [{ source: 'mar3' }] }]]);
  people.get('w').sex = 'M';
  const sources = new Map([['death', {}], ['birth', {}], ['mar', {}], ['mar2', {}], ['mar3', {}], ['alone', {}]]);
  const f = photoFolders({ people, unions, sources });
  assert.equal(f.source('death'), 'ROUX_Ana', 'la personne dont parle l’acte, pas le témoin cité avant');
  assert.equal(f.source('birth'), 'ROUX_Ana', 'seulement cité comme parent : chez lui');
  assert.equal(f.source('mar'), 'FAURE_Luc', 'acte de mariage de l’union : chez l’homme, même cité en second');
  assert.equal(f.source('mar2'), 'BLANC_Jules', 'cité par les deux époux : chez l’homme');
  assert.equal(f.source('mar3'), 'ROUX_Paul', 'chez l’homme, même nommé en second dans l’union');
  assert.equal(f.source('alone'), 'galerie');
  assert.equal(f.media(), 'galerie');
  assert.equal(f.person('a'), 'ROUX_Ana');
});

test('dossier d’un chemin de photo', () => {
  assert.equal(folderOfRef('photos/DUPONT_Jean/x.jpg'), 'DUPONT_Jean');
  assert.equal(folderOfRef('photos/x.jpg'), '');
});
