import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { findIssues, findCycles } from '../js/model/checks.js';
import { example, loadTree, person } from './helpers.js';

const NOW = new Date(2026, 9, 30);
const codes = () => findIssues(NOW).map((x) => x.code);

describe('vérification de cohérence', () => {
  test('famille d’exemple : rien à signaler', () => {
    const ex = example();
    loadTree(ex.people, ex.unions);
    assert.deepEqual(codes(), []);
  });

  test('enfant né après le décès de sa mère, mère de 8 ans', () => {
    loadTree([
      person('m', { sex: 'F', birthDate: '1900', deathDate: '1950' }),
      person('a', { motherId: 'm', birthDate: '1908' }),
      person('b', { motherId: 'm', birthDate: '1952' }),
    ]);
    const found = findIssues(NOW);
    assert.ok(found.some((x) => x.code === 'parentTooYoung' && x.n === 8 && x.ids[0] === 'a'));
    assert.ok(found.some((x) => x.code === 'bornAfterDeath' && x.ids[0] === 'b'));
  });

  test('un père peut mourir avant la naissance, pas plus d’un an avant', () => {
    loadTree([
      person('f', { sex: 'M', birthDate: '01/01/1900', deathDate: '01/03/1930' }),
      person('a', { fatherId: 'f', birthDate: '01/10/1930' }),
      person('b', { fatherId: 'f', birthDate: '01/06/1932' }),
    ]);
    assert.deepEqual(findIssues(NOW).map((x) => [x.code, x.ids[0]]), [['bornAfterDeath', 'b']]);
  });

  test('décès à 130 ans, décès avant la naissance, date impossible, date future', () => {
    loadTree([
      person('a', { birthDate: '1700', deathDate: '1830' }),
      person('b', { birthDate: '1900', deathDate: '1850' }),
      person('c', { birthDate: '31/02/1900' }),
      person('d', { birthDate: '2932' }),
    ]);
    assert.deepEqual(codes().sort(), ['badDate', 'deathBeforeBirth', 'future', 'tooOld']);
  });

  test('dates imprécises : seul ce qui est certain est signalé', () => {
    loadTree([
      person('m', { sex: 'F', birthDate: 'vers 1900', deceased: true }),
      person('a', { motherId: 'm', birthDate: 'vers 1912' }), // écart possible : 2 à 22 ans
      person('b', { birthDate: 'avant 1900', deathDate: '1880' }),
      person('c', { birthDate: 'printemps 1900', deathDate: '1800' }), // texte libre
    ]);
    assert.deepEqual(codes(), []);
  });

  test('boucle de parenté, soi-même comme parent', () => {
    loadTree([person('a', { fatherId: 'b' }), person('b', { motherId: 'c' }), person('c', { fatherId: 'a' }), person('d', { fatherId: 'd' })]);
    assert.deepEqual(findCycles().map((c) => c.slice().sort()), [['a', 'b', 'c'], ['d']]);
  });

  test('sexe des parents, filiation trop serrée sur deux générations', () => {
    loadTree([
      person('gp', { sex: 'M', birthDate: '1932', deceased: true }),
      person('p', { sex: 'M', fatherId: 'gp', deceased: true }),
      person('c', { sex: 'M', fatherId: 'p', motherId: 'm', birthDate: '1964' }),
      person('m', { sex: 'M', deceased: true }),
      person('w', { sex: 'F', deceased: true }),
      person('k', { motherId: 'gp', fatherId: 'w', birthDate: '1990' }),
    ]);
    const found = findIssues(NOW).map((x) => [x.code, x.ids[0], x.ids[1], x.n]);
    assert.deepEqual(found.filter((x) => ['fatherSex', 'motherSex'].includes(x[0])).sort(),
      [['fatherSex', 'k', 'w', undefined], ['motherSex', 'c', 'm', undefined], ['motherSex', 'k', 'gp', undefined]]);
    assert.ok(found.some((x) => x[0] === 'twoGensTooClose' && x[1] === 'c' && x[2] === 'gp' && x[3] === 32));
  });

  test('deux générations à 34 ans ou plus : rien à signaler', () => {
    loadTree([
      person('gp', { sex: 'M', birthDate: '1930', deceased: true }),
      person('p', { sex: 'M', fatherId: 'gp', deceased: true }),
      person('c', { sex: 'M', fatherId: 'p', birthDate: '1964' }),
    ]);
    assert.deepEqual(codes(), []);
  });

  test('parent non rattaché : l’unique conjoint du parent connu', () => {
    loadTree([
      person('f', { sex: 'M', deceased: true }),
      person('w', { sex: 'F', deceased: true }),
      person('c', { fatherId: 'f' }),
      person('m', { sex: 'F', deceased: true }),
      person('d', { motherId: 'm' }),
      person('h1', { sex: 'M', deceased: true }),
      person('h2', { sex: 'M', deceased: true }),
      person('e', { motherId: 'x' }),
    ], [{ a: 'f', b: 'w' }, { a: 'm', b: 'h1' }, { a: 'm', b: 'h2' }]);
    const found = findIssues(NOW).map((x) => [x.code, ...x.ids]);
    assert.deepEqual(found, [['motherMissing', 'c', 'w', 'f']]); // m a deux conjoints : pas de supposition
  });

  test('marié sans conjoint ; « en couple » sans conjoint n’est pas signalé', () => {
    loadTree([
      person('a', { situation: 'married', deceased: true }),
      person('b', { situation: 'widowed', deceased: true }),
      person('c', { situation: 'cohabiting' }),
      person('d', { situation: 'single' }),
      person('e', { situation: 'married', deceased: true }),
      person('f', { deceased: true }),
    ], [{ a: 'e', b: 'f' }]);
    assert.deepEqual(findIssues(NOW).map((x) => x.ids[0]).sort(), ['a', 'b']);
  });

  test('vivant de plus de 110 ans : d’après sa naissance, ou celle de son premier enfant', () => {
    loadTree([
      person('a', { birthDate: '1900' }),
      person('b', { birthDate: '1930' }),
      person('m', { sex: 'F' }),
      person('k', { motherId: 'm', birthDate: '1787', deceased: true }),
      person('n', { sex: 'F' }),
      person('j', { motherId: 'n', birthDate: '1990' }),
    ]);
    const found = findIssues(NOW).filter((x) => x.code === 'livingTooOld').map((x) => [x.ids[0], x.n]);
    assert.deepEqual(found, [['a', 125], ['m', 250]]);
  });

  test('nom de naissance différent de celui du père', () => {
    loadTree([
      person('f', { sex: 'M', surname: 'Durand', deceased: true }),
      person('a', { sex: 'M', surname: 'Martin', fatherId: 'f' }),
      person('b', { sex: 'M', surname: 'DURAND', fatherId: 'f' }),
      person('c', { sex: 'F', surname: 'Roux', maidenName: 'Durand', fatherId: 'f' }),
      person('d', { sex: 'F', surname: 'Roux', fatherId: 'f' }), // mariée sans nom de jeune fille : pas de conclusion
      person('h', { sex: 'M', surname: 'Roux', deceased: true }),
      person('e', { sex: 'F', surname: 'Petit', fatherId: 'f' }),
      // Double nom : celui du père et celui de naissance de la mère, dans un sens ou dans l'autre
      person('m', { sex: 'F', surname: 'Durand', maidenName: 'Moreau', deceased: true }),
      person('g', { sex: 'M', surname: 'Durand Moreau', fatherId: 'f', motherId: 'm' }),
      person('i', { sex: 'M', surname: 'Moreau-Durand', fatherId: 'f', motherId: 'm' }),
      person('j', { sex: 'M', surname: 'Durand--Moreau', fatherId: 'f', motherId: 'm' }),
      person('k', { sex: 'M', surname: 'Durand Martin', fatherId: 'f', motherId: 'm' }),
      person('l', { sex: 'M', surname: 'Durand Moreau', fatherId: 'f' }), // mère inconnue : rien ne justifie le double nom
      // Mère mariée sans nom de jeune fille saisi : son nom de naissance est celui de son père
      person('gp', { sex: 'M', surname: 'Blanc', deceased: true }),
      person('m2', { sex: 'F', surname: 'Durand', fatherId: 'gp', deceased: true }),
      person('n', { sex: 'M', surname: 'Durand Blanc', fatherId: 'f', motherId: 'm2' }),
    ], [{ a: 'd', b: 'h' }, { a: 'f', b: 'm' }, { a: 'f', b: 'm2' }]);
    const found = findIssues(NOW).filter((x) => x.code === 'nameNotFather').map((x) => [x.ids[0], x.n]);
    assert.deepEqual(found, [['a', 'Martin'], ['e', 'Petit'], ['k', 'Durand Martin'], ['l', 'Durand Moreau']]);
  });

  test('unions et événements', () => {
    loadTree([
      person('a', {
        birthDate: '1900', deathDate: '1950', events: [
          { id: 'e1', type: 'baptism', date: '1890' },
          { id: 'e2', type: 'census', date: '1960' },
          { id: 'e3', type: 'burial', date: '1940' },
          { id: 'e4', type: 'burial', date: '1951' },
        ],
      }),
      person('b', { birthDate: '1900' }),
    ], [{ a: 'a', b: 'b', date: '1955' }, { a: 'a', b: 'b', date: '1905' }]);
    const found = codes();
    for (const c of ['eventBeforeBirth', 'eventAfterDeath', 'burialBeforeDeath', 'unionAfterDeath', 'unionTooYoung']) assert.ok(found.includes(c), c);
    assert.equal(found.filter((c) => c === 'burialBeforeDeath').length, 1);
  });
});

describe('checks kept in memory', () => {
  test('computed again only when the data, the day or the language change', async () => {
    const { currentIssues } = await import('../js/model/checks.js');
    const { opUpdate } = await import('../js/services/storage.js');
    const { setLang, getLang } = await import('../js/i18n.js');
    const { S } = await import('../js/state.js');
    loadTree([person('a', { given: 'Ana', birthDate: '1900', deathDate: '1850' })], []);
    S.mode = 'local';
    const first = currentIssues();
    assert.ok(first.length);
    assert.equal(currentIssues(), first, 'same result, not computed again');
    await opUpdate('people', 'a', { deathDate: '1950' });
    const second = currentIssues();
    assert.notEqual(second, first);
    assert.equal(second.length, 0);
    assert.notEqual(currentIssues(new Date(2000, 0, 2)), second, 'another day');
    const lang = getLang();
    const before = currentIssues();
    setLang(lang === 'fr' ? 'en' : 'fr');
    assert.notEqual(currentIssues(), before, 'another language');
    setLang(lang);
  });
});
