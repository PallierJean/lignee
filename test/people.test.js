import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  maiden, birthSurname, fullName, longName, surnameLine, situationLabel, situationText,
  childrenOf, partnersOf, siblingsOf, isDead, lifeYears, cardDates, ageInfo, matchesWords, queryWords,
  defaultFocus, isPhotoData, isPhotoFile,
} from '../js/model/people.js';
import { example, loadTree, person } from './helpers.js';

describe('noms', () => {
  const marguerite = person('p1', { given: 'Marguerite', surname: 'Dupont', maidenName: 'Faure', sex: 'F' });

  test('nom de jeune fille : seulement pour une femme, et s’il diffère', () => {
    assert.equal(maiden(marguerite), 'FAURE');
    assert.equal(maiden({ ...marguerite, sex: 'M' }), '');
    assert.equal(maiden({ ...marguerite, maidenName: 'dupont' }), '');
  });

  test('affichages', () => {
    assert.equal(fullName(marguerite), 'Marguerite DUPONT');
    assert.equal(longName(marguerite), 'Marguerite DUPONT née FAURE');
    assert.equal(surnameLine(marguerite), 'DUPONT née FAURE');
    assert.equal(fullName({ sex: 'F', maidenName: 'Faure' }), 'FAURE');
  });

  test('nom de naissance : celui du père, à défaut celui de naissance de la mère', () => {
    loadTree([
      person('f', { surname: 'Martin', sex: 'M' }),
      person('m', { surname: 'Martin', maidenName: 'Roux', sex: 'F' }),
    ]);
    assert.equal(birthSurname('f', 'm'), 'Martin');
    assert.equal(birthSurname(null, 'm'), 'Roux');
    assert.equal(birthSurname(null, null), '');
  });
});

describe('situation familiale', () => {
  test('libellé accordé au sexe', () => {
    assert.equal(situationLabel('married', 'F'), 'Mariée');
    assert.equal(situationLabel('married', 'M'), 'Marié');
    assert.match(situationLabel('married', 'U'), / \/ /);
    assert.equal(situationLabel('inconnu', 'F'), '');
  });
  test('date seulement pour mariage et pacs', () => {
    assert.equal(situationText({ situation: 'married', sex: 'F', situationDate: '12/03/1956' }), 'Mariée (12 Mars 1956)');
    assert.equal(situationText({ situation: 'divorced', sex: 'F', situationDate: '1970' }), situationLabel('divorced', 'F'));
  });
});

describe('dates de vie et âge', () => {
  test('décès déduit de la date, du lieu ou de la case', () => {
    assert.equal(isDead({ deathPlace: 'Lyon' }), true);
    assert.equal(isDead({ deceased: true }), true);
    assert.equal(isDead({ deathDate: '  ' }), false);
  });
  test('lignes de dates', () => {
    assert.equal(lifeYears({ birthDate: '1932', deathDate: 'vers 2004' }), '1932 – v. 2004');
    assert.equal(lifeYears({ birthDate: '1958' }), '° 1958');
    assert.equal(cardDates({ birthDate: '1900', deceased: true }), '° 1900  †');
  });
  test('âge au décès, exact ou approché', () => {
    assert.equal(ageInfo({ birthDate: '15/06/1900', deathDate: '14/06/1950' }).text, '49 ans');
    assert.equal(ageInfo({ birthDate: '15/06/1900', deathDate: '15/06/1950' }).text, '50 ans');
    assert.match(ageInfo({ birthDate: '1900', deathDate: '1950' }).text, /50/);
    assert.equal(ageInfo({ birthDate: '1900', deceased: true }), null);
  });
  test('pas d’âge pour un vivant de plus de 105 ans', () => {
    assert.equal(ageInfo({ birthDate: '1850' }), null);
  });
});

describe('recherche', () => {
  test('sans accents, tous les mots, dans n’importe quel ordre', () => {
    const p = { given: 'Léa', surname: 'Lefèvre', birthPlace: 'Saint-Étienne' };
    assert.ok(matchesWords(p, queryWords('lefevre LEA')));
    assert.ok(matchesWords(p, queryWords('etienne')));
    assert.ok(!matchesWords(p, queryWords('lea martin')));
    assert.ok(matchesWords(p, queryWords('   ')));
  });
});

describe('liens de parenté (famille d’exemple)', () => {
  const ex = example();

  test('enfants triés par naissance', () => {
    loadTree(ex.people, ex.unions);
    assert.deepEqual(childrenOf('p_ex_05'), ['p_ex_09', 'p_ex_11']);
    assert.deepEqual(childrenOf('p_ex_16'), []);
  });

  test('conjoints déclarés et déduits des enfants communs', () => {
    loadTree(ex.people, ex.unions);
    assert.deepEqual(partnersOf('p_ex_05').map((x) => x.id), ['p_ex_06']);
    assert.ok(partnersOf('p_ex_05')[0].uid, 'union déclarée');
    // Sans l'union, le couple est déduit des enfants
    loadTree(ex.people, ex.unions.filter((u) => u.id !== 'u_ex_03'));
    assert.deepEqual(partnersOf('p_ex_05'), [{ id: 'p_ex_06', uid: null }]);
  });

  test('fratrie et demi-frères', () => {
    const half = [...ex.people, person('x', { given: 'Demi', fatherId: 'p_ex_05', motherId: 'p_ex_08' })];
    loadTree(half, ex.unions);
    const sibs = siblingsOf('p_ex_09');
    assert.deepEqual(sibs.find((s) => s.id === 'p_ex_11'), { id: 'p_ex_11', half: '' });
    assert.equal(sibs.find((s) => s.id === 'x').half, 'même père');
    assert.deepEqual(siblingsOf('p_ex_01'), []);
  });

  test('personne centrée par défaut : la plus riche en ancêtres', () => {
    loadTree(ex.people, ex.unions);
    assert.equal(defaultFocus(), 'p_ex_12'); // Camille : 6 ancêtres connus, comme Thomas, mais plus jeune
  });

  test('un parent qui est lui-même n’est pas son propre enfant', () => {
    loadTree([person('a', { fatherId: 'a' })]);
    assert.deepEqual(childrenOf('a'), []);
  });
});

describe('photos', () => {
  test('formats reconnus', () => {
    assert.ok(isPhotoData('data:image/jpeg;base64,AAAA'));
    assert.ok(!isPhotoData('data:text/html;base64,AAAA'));
    assert.ok(isPhotoFile('photos/DUPONT-Jean-1.jpg'));
    assert.ok(!isPhotoFile('photos/../secret.jpg'));
    assert.ok(!isPhotoFile('photos/a.exe'));
  });
});
