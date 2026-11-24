import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nameFolder, personFolder, photoFolders, folderOfRef, filedRef } from '../js/model/photo-folders.js';

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
  // A union's certificate goes to the couple, the husband named first even when second in the union
  const unions = new Map([['u', { a: 'a', b: 'b', citations: [{ source: 'mar' }] }], ['v', { a: 'e2', b: 'w', citations: [{ source: 'mar3' }] }]]);
  people.get('w').sex = 'M';
  const sources = new Map([['death', {}], ['birth', {}], ['mar', {}], ['mar2', {}], ['mar3', {}], ['alone', {}]]);
  const f = photoFolders({ people, unions, sources });
  assert.equal(f.source('death'), 'ROUX_Ana', 'la personne dont parle l’acte, pas le témoin cité avant');
  assert.equal(f.source('birth'), 'ROUX_Ana', 'seulement cité comme parent : chez lui');
  assert.equal(f.source('mar'), 'FAURE_Luc_X_ROUX_Ana', 'acte de mariage de l’union : dossier du couple, l’homme d’abord');
  assert.equal(f.source('mar2'), 'BLANC_Jules', 'cité par les deux époux : chez l’homme');
  assert.equal(f.source('mar3'), 'ROUX_Paul_X_VERT_Rose', 'l’homme d’abord, même nommé en second dans l’union');
  assert.equal(f.couple('u'), 'FAURE_Luc_X_ROUX_Ana');
  assert.equal(f.source('alone'), 'galerie');
  assert.equal(f.media(), 'galerie');
  assert.equal(f.person('a'), 'ROUX_Ana');
});

test('acte de mariage : l’union l’emporte sur une fiche qui le cite, un seul époux connu', () => {
  const people = new Map([
    ['h', { surname: 'Blanc', given: 'Jules', sex: 'M', citations: [{ source: 'm' }] }],
    ['f', { surname: 'Noir', given: 'Lise', sex: 'F' }],
  ]);
  const unions = new Map([['u', { a: 'f', b: 'h', citations: [{ source: 'm' }] }], ['v', { a: 'h', b: 'gone', citations: [{ source: 'n' }] }]]);
  const f = photoFolders({ people, unions, sources: new Map([['m', {}], ['n', {}]]) });
  assert.equal(f.source('m'), 'BLANC_Jules_X_NOIR_Lise');
  assert.equal(f.source('n'), 'BLANC_Jules', 'conjoint absent de l’arbre : chez l’autre seul');
});

test('dossier d’un chemin de photo', () => {
  assert.equal(folderOfRef('photos/DUPONT_Jean/x.jpg'), 'DUPONT_Jean');
  assert.equal(folderOfRef('photos/x.jpg'), '');
});

test('nom du fichier : celui de la personne du dossier, renommé avec elle', () => {
  const uuid = '0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d';
  assert.equal(filedRef(`photos/DUPONT_Jean/DUPONT-Jean-${uuid}.jpg`, 'DUPONT_Jean-Paul', 'DUPONT-Jean-Paul'), `photos/DUPONT_Jean-Paul/DUPONT-Jean-Paul-${uuid}.jpg`);
  assert.equal(filedRef(`photos/x/Acte-n-3-${uuid}.png`, 'galerie'), `photos/galerie/Acte-n-3-${uuid}.png`, 'sans nom : le fichier garde le sien');
  assert.equal(filedRef('photos/vieux.png', 'ROUX_Bob', 'ROUX-Bob'), 'photos/ROUX_Bob/vieux.png', 'un fichier mis à la main garde son nom');
  const people = new Map([['h', { surname: 'Blanc', given: 'Jules', sex: 'M', citations: [{ source: 'n' }] }], ['f', { surname: 'Noir', given: 'Lise', sex: 'F' }]]);
  const unions = new Map([['u', { a: 'h', b: 'f', citations: [{ source: 'm' }] }]]);
  const f = photoFolders({ people, unions, sources: new Map([['m', {}], ['n', { title: 'Acte n°3' }], ['g', {}]]) });
  assert.equal(f.label('person', 'f'), 'NOIR-Lise');
  assert.equal(f.label('source', 'n', `photos/BLANC_Jules/BLANC-Jul-${uuid}.jpg`), 'BLANC-Jules', 'un acte nommé d’après une personne : son nom d’aujourd’hui');
  assert.equal(f.label('source', 'n', `photos/BLANC_Jules/Acte-n-3-${uuid}.jpg`), '', 'nommé d’après sa source : gardé');
  assert.equal(f.label('source', 'm'), '', 'acte du couple : nom gardé');
  const long = 'Mariage de Pierre DUPONT dit Grandpré et Catherine FAURE célébré en l’église du bourg en 1689';
  const g = photoFolders({ people, unions, sources: new Map([['n', { title: long }]]) });
  const whole = long.replace(/[^\p{L}\p{M}\p{N}]+/gu, '-');
  assert.equal(g.label('source', 'n', `photos/BLANC_Jules/${whole}-${uuid}.jpg`), '', 'titre long entier (dépôt GitHub) : gardé');
  assert.equal(g.label('source', 'n', `photos/BLANC_Jules/${whole.slice(0, 80)}-${uuid}.jpg`), '', 'titre long coupé à 80 : gardé');
  assert.equal(f.label('source', 'g'), '', 'galerie : nom gardé');
  assert.equal(f.label('media', 'x'), '');
});
