import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { yearOf, splitQualifier, shortDate, longDate, fullDate, dateParts, isImpossibleDate } from '../js/utils/dates.js';
import { setLang } from '../js/i18n.js';

afterEach(() => setLang('fr'));

describe('yearOf', () => {
  test('trouve l’année dans toutes les formes saisies', () => {
    assert.equal(yearOf('12/03/1932'), 1932);
    assert.equal(yearOf('03/1932'), 1932);
    assert.equal(yearOf('vers 1850'), 1850);
    assert.equal(yearOf('after 1790'), 1790);
  });
  test('null sans année', () => {
    assert.equal(yearOf(''), null);
    assert.equal(yearOf(undefined), null);
    assert.equal(yearOf('12/03'), null);
  });
});

describe('splitQualifier', () => {
  for (const [input, q] of [
    ['vers 1850', 'abt'], ['env. 1850', 'abt'], ['about 1850', 'abt'], ['circa 1850', 'abt'], ['~1850', 'abt'],
    ['avant 1901', 'bef'], ['av. 1901', 'bef'], ['before 1901', 'bef'], ['BEF 1901', 'bef'],
    ['après 1790', 'aft'], ['apres 1790', 'aft'], ['after 1790', 'aft'],
  ]) {
    test(`« ${input} » -> ${q}`, () => {
      const r = splitQualifier(input);
      assert.equal(r.q, q);
      assert.match(r.rest, /^\d{4}$/);
    });
  }
  test('sans préfixe', () => {
    assert.deepEqual(splitQualifier('  12/03/1932 '), { q: '', rest: '12/03/1932' });
    assert.deepEqual(splitQualifier(null), { q: '', rest: '' });
  });
});

describe('fullDate', () => {
  test('décompose jj/mm/aaaa', () => {
    assert.deepEqual(fullDate('5/3/1932'), { y: 1932, m: 3, d: 5 });
  });
  test('null pour une date partielle, précédée d’un préfixe ou impossible', () => {
    assert.equal(fullDate('03/1932'), null);
    assert.equal(fullDate('vers 1932'), null);
    assert.equal(fullDate('vers 12/03/1932'), null);
    assert.equal(fullDate('31/04/1932'), null);
  });
});

describe('dateParts et isImpossibleDate', () => {
  test('dates reconnues', () => {
    assert.deepEqual(dateParts('vers 12/03/1932'), { q: 'abt', y: 1932, m: 3, d: 12 });
    assert.deepEqual(dateParts('03/1932'), { q: '', y: 1932, m: 3 });
    assert.deepEqual(dateParts('1932'), { q: '', y: 1932 });
    assert.deepEqual(dateParts('29/02/2000'), { q: '', y: 2000, m: 2, d: 29 });
  });
  test('jours et mois qui n’existent pas', () => {
    for (const s of ['31/02/1900', '29/02/1900', '31/04/1932', '00/01/1900', '32/01/1900', '13/1900', '00/1900', '01/13/1900', 'avant 30/02/1901']) {
      assert.equal(dateParts(s), null, s);
      assert.ok(isImpossibleDate(s), s);
    }
  });
  test('texte libre : pas une date reconnue, mais pas impossible non plus', () => {
    for (const s of ['', 'printemps 1944', 'entre 1850 et 1860', '1er mai 1900']) {
      assert.equal(isImpossibleDate(s), false, s);
    }
    assert.equal(dateParts('printemps 1944'), null);
  });
});

describe('shortDate et longDate', () => {
  test('en français', () => {
    assert.equal(shortDate('12/03/1932'), '1932');
    assert.equal(shortDate('vers 1850'), 'v. 1850');
    assert.equal(longDate('12/03/1932'), '12 Mars 1932');
    assert.equal(longDate('01/05/1900'), '01 Mai 1900');
    assert.equal(longDate('03/1932'), 'Mars 1932');
    assert.equal(longDate('vers 1850'), 'vers 1850');
    assert.equal(longDate('avant 01/05/1900'), 'avant 01 Mai 1900');
  });
  test('en anglais, quelle que soit la langue de saisie', () => {
    setLang('en');
    assert.equal(shortDate('vers 1850'), 'c. 1850');
    assert.match(longDate('12/03/1932'), /March/);
    assert.match(longDate('vers 1850'), /^about 1850$/i);
  });
  test('texte libre et dates impossibles affichés tels que saisis', () => {
    assert.equal(longDate('printemps 1944'), 'printemps 1944');
    assert.equal(longDate('31/02/1900'), '31/02/1900');
    assert.equal(longDate('13/1900'), '13/1900');
    assert.equal(shortDate(''), '');
  });
});

describe('dates en toutes lettres', () => {
  test('format d’affichage demandé', () => {
    assert.equal(longDate('04/08/1961'), '04 Août 1961');
  });

  test('toutes les écritures donnent la même date', () => {
    for (const d of ['04 Août 1961', '4 aout 1961', '04 AOUT 1961', '04 Aout 1961', '4 August 1961']) {
      assert.deepEqual(dateParts(d), { q: '', y: 1961, m: 8, d: 4 }, d);
      assert.equal(longDate(d), '04 Août 1961');
    }
    assert.deepEqual(dateParts('Mars 1961'), { q: '', y: 1961, m: 3 });
    assert.deepEqual(dateParts('vers 5 Mai 1906'), { q: 'abt', y: 1906, m: 5, d: 5 });
    assert.equal(longDate('13 Fevrier 1855'), '13 Février 1855');
  });

  test('mois mal écrits, jours impossibles et doubles dates : texte libre, tel quel', () => {
    for (const d of ['12 Javier 1950', '31 Février 1900', '19/29 Octobre 1861', '22 avril/aout 1869', 'printemps 1944']) {
      assert.equal(dateParts(d), null, d);
      assert.equal(longDate(d), d);
    }
  });
});

test('date en toutes lettres impossible : signalée', () => {
  assert.equal(isImpossibleDate('31 Février 1900'), true);
  assert.equal(isImpossibleDate('12 Javier 1950'), false); // mois inconnu : texte libre
  assert.equal(isImpossibleDate('28 Février 1900'), false);
});
