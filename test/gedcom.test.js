import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { toGedDate, fromGedDate, buildGedcom, parseGedcom } from '../js/services/gedcom.js';
import { example, loadTree, person } from './helpers.js';

const FIELDS = ['given', 'surname', 'maidenName', 'sex', 'birthDate', 'birthPlace', 'deathDate', 'deathPlace',
  'occupation', 'situation', 'situationDate', 'notes'];

/** Export puis import : personnes indexées par nom complet. */
function roundTrip() {
  const { people, unions } = parseGedcom(buildGedcom());
  const byId = new Map(people.map((p) => [p.id, p.data]));
  return { people: people.map((p) => p.data), unions: unions.map((u) => u.data), byId };
}
const key = (p) => (p.given + '|' + p.surname).toUpperCase();

describe('dates GEDCOM', () => {
  for (const [lignee, ged] of [
    ['12/03/1932', '12 MAR 1932'],
    ['03/1932', 'MAR 1932'],
    ['1932', '1932'],
    ['vers 1850', 'ABT 1850'],
    ['about 1850', 'ABT 1850'],
    ['avant 1901', 'BEF 1901'],
    ['après 1790', 'AFT 1790'],
    ['après 12/03/1790', 'AFT 12 MAR 1790'],
  ]) {
    test(`« ${lignee} » -> « ${ged} »`, () => assert.equal(toGedDate(lignee), ged));
  }

  test('relecture vers le format de saisie français', () => {
    assert.equal(fromGedDate('2 MAR 1932'), '02/03/1932');
    assert.equal(fromGedDate('MAR 1932'), '03/1932');
    assert.equal(fromGedDate('ABT 1850'), 'vers 1850');
    assert.equal(fromGedDate('EST 1850'), 'vers 1850');
    assert.equal(fromGedDate('BEF 1901'), 'avant 1901');
    assert.equal(fromGedDate('aft 1790'), 'après 1790');
    assert.equal(fromGedDate('BET 1850 AND 1860'), 'BET 1850 AND 1860'); // inconnu : gardé tel quel
  });

  test('aller-retour sans perte des dates complètes', () => {
    for (const d of ['12/03/1932', '03/1932', '1932', 'vers 1850', 'avant 1901', 'après 1790']) {
      assert.equal(fromGedDate(toGedDate(d)), d);
    }
  });

  test('texte libre et dates impossibles : date-phrase GEDCOM', () => {
    assert.equal(toGedDate('13/1900'), '(13/1900)');
    assert.equal(toGedDate('31/02/1900'), '(31/02/1900)');
    assert.equal(toGedDate('29/02/1900'), '(29/02/1900)'); // 1900 n'est pas bissextile
    assert.equal(toGedDate('29/02/2000'), '29 FEB 2000');
    assert.equal(toGedDate('vers printemps 1944'), '(vers printemps 1944)');
    assert.equal(toGedDate('entre 1850 (ou 1851)'), '(entre 1850 [ou 1851])');
  });

  test('date-phrase et date interprétée relues', () => {
    assert.equal(fromGedDate('(printemps 1944)'), 'printemps 1944');
    assert.equal(fromGedDate('INT 1850 (vers le milieu du siècle)'), '1850');
    assert.equal(fromGedDate('INT ABT MAR 1850 (texte)'), 'vers 03/1850');
    for (const d of ['31/02/1900', 'printemps 1944', 'vers printemps 1944']) assert.equal(fromGedDate(toGedDate(d)), d);
  });
});

describe('export GEDCOM', () => {
  test('en-tête 5.5.1 UTF-8, fins de ligne CRLF, TRLR final', () => {
    loadTree([person('p1', { given: 'Jean', surname: 'Martin', sex: 'M' })]);
    const ged = buildGedcom();
    assert.match(ged, /^0 HEAD\r\n/);
    assert.match(ged, /2 VERS 5\.5\.1/);
    assert.match(ged, /1 CHAR UTF-8/);
    assert.ok(ged.endsWith('0 TRLR\r\n'));
    assert.ok(!/[^\r]\n/.test(ged), 'toutes les fins de ligne sont CRLF');
  });

  test('nom de jeune fille en premier NAME, nom d’usage en TYPE married', () => {
    loadTree([person('p1', { given: 'Marguerite', surname: 'Dupont', maidenName: 'Faure', sex: 'F' })]);
    const ged = buildGedcom();
    const names = ged.match(/1 NAME .*/g);
    assert.deepEqual(names, ['1 NAME Marguerite /Faure/', '1 NAME Marguerite /Dupont/']);
    assert.match(ged, /1 NAME Marguerite \/Dupont\/\r\n2 TYPE married/);
  });

  test('@ doublés dans les valeurs', () => {
    loadTree([person('p1', { given: 'Jean', occupation: 'a@b' })]);
    assert.match(buildGedcom(), /1 OCCU a@@b/);
  });

  test('décès sans date ni lieu : DEAT Y', () => {
    loadTree([person('p1', { given: 'Jean', deceased: true })]);
    assert.match(buildGedcom(), /1 DEAT Y/);
  });

  describe('notes longues coupées en lignes CONC', () => {
    const notes = [
      'x'.repeat(600),
      ('Mot ' + 'é'.repeat(9) + ' ').repeat(80), // accents : 2 octets chacun
      'a@'.repeat(300),
      '🌳'.repeat(150) + '\n' + 'Deuxième ligne. '.repeat(40),
      ' '.repeat(400) + 'fin',
    ];
    for (const [i, note] of notes.entries()) {
      test(`cas ${i + 1} : aucune ligne de plus de 255 octets, texte relu à l’identique`, () => {
        loadTree([person('p1', { given: 'Jean', notes: note })]);
        const ged = buildGedcom();
        const longest = Math.max(...ged.split('\r\n').map((l) => Buffer.byteLength(l)));
        assert.ok(longest <= 255, `ligne de ${longest} octets`);
        assert.match(ged, /\r\n2 CONC /);
        assert.equal(parseGedcom(ged).people[0].data.notes, note.trim());
      });
    }

    test('pas de coupure à côté d’une espace ni dans un @@', () => {
      loadTree([person('p1', { given: 'Jean', notes: ('mot ' + 'a@b ').repeat(100) })]);
      const lines = buildGedcom().split('\r\n');
      lines.forEach((l, i) => {
        if (!lines[i + 1] || !lines[i + 1].startsWith('2 CONC ')) return;
        const next = lines[i + 1].slice(7);
        assert.ok(!l.endsWith(' ') && !next.startsWith(' '), 'coupure sur une espace');
        assert.ok(!(l.endsWith('@') && next.startsWith('@')), 'coupure dans un @@');
      });
    });

    test('note courte : une seule ligne', () => {
      loadTree([person('p1', { given: 'Jean', notes: 'Courte' })]);
      assert.ok(!buildGedcom().includes('CONC'));
    });
  });
});

describe('aller-retour export / import', () => {
  test('famille d’exemple : personnes, filiations et unions identiques', () => {
    const ex = example();
    loadTree(ex.people, ex.unions);
    const { people, unions, byId } = roundTrip();
    assert.equal(people.length, ex.people.length);
    assert.equal(unions.length, ex.unions.length);

    const exById = new Map(ex.people.map((p) => [p.id, p]));
    const got = new Map(people.map((p) => [key(p), p]));
    for (const p of ex.people) {
      const q = got.get(key(p));
      assert.ok(q, `${p.given} ${p.surname} retrouvé`);
      for (const f of FIELDS) assert.equal(q[f] || '', p[f] || '', `${p.given} ${p.surname} : ${f}`);
      for (const f of ['fatherId', 'motherId']) {
        const want = p[f] ? key(exById.get(p[f])) : null;
        const have = q[f] ? key(byId.get(q[f])) : null;
        assert.equal(have, want, `${p.given} ${p.surname} : ${f}`);
      }
    }

    const pair = (a, b) => [a, b].sort().join(' + ');
    const unionKeys = (list, find) => list.map((u) => pair(key(find(u.a)), key(find(u.b))) + ' ' + u.date + ' ' + u.place).sort();
    assert.deepEqual(unionKeys(unions, (id) => byId.get(id)), unionKeys(ex.unions, (id) => exById.get(id)));
  });

  test('notes sur plusieurs lignes, @, situation familiale et nom de jeune fille', () => {
    const notes = 'Ligne 1\nLigne 2 avec un @\n\nLigne 4';
    loadTree([person('p1', {
      given: 'Simone', surname: 'Bertrand', maidenName: 'Roux', sex: 'F',
      situation: 'married', situationDate: '18/09/1956', notes,
    })]);
    const [p] = roundTrip().people;
    assert.equal(p.notes, notes);
    assert.equal(p.surname, 'Bertrand');
    assert.equal(p.maidenName, 'Roux');
    assert.equal(p.situation, 'married');
    assert.equal(p.situationDate, '18/09/1956');
  });
});

describe('import de fichiers d’autres logiciels', () => {
  const GED = [
    '0 HEAD', '1 CHAR UTF-8',
    '0 @I1@ INDI', '1 NAME Pierre /Durand/', '1 SEX M', '1 CHR', '2 DATE 5 JAN 1820', '2 PLAC Lyon',
    '1 BURI', '2 DATE 1890',
    '0 @I2@ INDI', '1 NAME Marie /Petit/', '2 _MARNM Durand', '1 SEX F',
    '0 @I3@ INDI', '1 NAME Paul /Durand/', '1 SEX M', '1 NOTE Début', '2 CONC  suite', '2 CONT ligne 2',
    '0 @I4@ INDI', '1 NAME Inconnu', '1 _SITU marié', // situation inconnue de Lignée : ignorée
    '0 @F1@ FAM', '1 HUSB @I1@', '1 WIFE @I2@', '1 MARR', '2 DATE ABT 1845', '1 CHIL @I3@',
    '0 TRLR',
  ].join('\n');

  test('baptême et inhumation gardés comme événements, _MARNM, CONC / CONT', () => {
    const { people, unions } = parseGedcom('﻿' + GED);
    const [pierre, marie, paul, inconnu] = people;
    assert.equal(pierre.data.birthDate, '');
    assert.equal(pierre.data.deathDate, '');
    assert.equal(pierre.data.deceased, true);
    const [baptism, burial] = pierre.data.events;
    assert.equal(baptism.type, 'baptism');
    assert.equal(baptism.date, '05/01/1820');
    assert.equal(baptism.place, 'Lyon');
    assert.equal(burial.type, 'burial');
    assert.equal(burial.date, '1890');
    assert.equal(marie.data.surname, 'Durand');
    assert.equal(marie.data.maidenName, 'Petit');
    assert.equal(paul.data.notes, 'Début suite\nligne 2');
    assert.equal(paul.data.fatherId, pierre.id);
    assert.equal(paul.data.motherId, marie.id);
    assert.equal(inconnu.data.given, 'Inconnu');
    assert.equal(inconnu.data.situation, '');
    assert.equal(inconnu.data.sex, 'U');
    assert.equal(unions.length, 1);
    assert.equal(unions[0].data.date, 'vers 1845');
  });

  test('lignes invalides et niveaux orphelins ignorés', () => {
    const { people } = parseGedcom('n’importe quoi\n2 NAME orphelin\n0 @I1@ INDI\n1 NAME A /B/\n');
    assert.equal(people.length, 1);
    assert.equal(people[0].data.surname, 'B');
  });

  test('sources : fiches SOUR, citation en ligne, PAGE, NOTE, mariage porté par un conjoint', () => {
    const { people, unions } = parseGedcom([
      '0 @S1@ SOUR', '1 TITL Registre de Lyon',
      '0 @I1@ INDI', '1 NAME A /B/', '1 SEX M', '1 BIRT', '2 DATE 1820', '2 SOUR @S1@', '3 PAGE vue 12', '3 NOTE Lu',
      '1 DEAT', '2 SOUR Souvenir de famille', '1 OCCU Tisserand', '1 OCCU Maire', '2 DATE 1860',
      '1 EVEN', '2 TYPE Service militaire', '2 DATE 1840',
      '0 @I2@ INDI', '1 NAME C /D/', '1 SEX F',
      '0 @F1@ FAM', '1 HUSB @I1@', '1 WIFE @I2@', '1 MARR', '2 SOUR @S1@', '3 PAGE vue 40',
      '0 TRLR',
    ].join('\n'));
    const p = people[0].data;
    assert.equal(p.occupation, 'Tisserand');
    assert.deepEqual(p.events.map((e) => [e.type, e.note, e.label]), [['occupation', 'Maire', undefined], ['other', '', 'Service militaire']]);
    const [birth, death, marriage] = p.sources;
    assert.deepEqual([birth.fact, birth.title, birth.ref, birth.note], ['birth', 'Registre de Lyon', 'vue 12', 'Lu']);
    assert.deepEqual([death.fact, death.title], ['death', 'Souvenir de famille']);
    assert.deepEqual([marriage.fact, marriage.ref], ['union:' + unions[0].id, 'vue 40']);
  });
});

describe('événements et sources à l’aller-retour', () => {
  test('tout est relu, sources rattachées au bon fait', () => {
    const events = [
      { id: 'e_1', type: 'baptism', date: '14/03/1932', place: 'Lyon', note: 'Parrain : Jean' },
      { id: 'e_2', type: 'occupation', date: '1960', place: '', note: 'Ajusteur' },
      { id: 'e_3', type: 'other', label: 'Service militaire', date: '1952', place: '', note: '' },
    ];
    const src = (id, fact, extra) => ({ id, fact, kind: 'birth', title: '', place: 'AD Rhône', ref: '', note: '', ...extra });
    loadTree([
      person('p1', {
        given: 'Jean', sex: 'M', birthDate: '12/03/1932', events, sources: [
          src('s1', 'birth', { ref: '3 E 1, vue 2', note: 'Transcription' }),
          src('s2', 'e_1', { kind: 'baptism', title: 'Registre paroissial' }),
          src('s3', '', { kind: 'family' }),
          src('s4', 'union:u1', { kind: 'marriage' }),
        ],
      }),
      person('p2', { given: 'Anne', sex: 'F' }),
    ], [{ id: 'u1', a: 'p1', b: 'p2', date: '1956' }]);
    const ged = buildGedcom();
    assert.match(ged, /1 BAPM\r\n2 DATE 14 MAR 1932/);
    assert.match(ged, /1 OCCU Ajusteur\r\n2 DATE 1960/);
    assert.match(ged, /1 EVEN\r\n2 TYPE Service militaire/);
    assert.ok(Math.max(...ged.split('\r\n').map((l) => Buffer.byteLength(l))) <= 255);

    const { people, unions } = parseGedcom(ged);
    const p = people.find((x) => x.data.given === 'Jean').data;
    const got = new Map(p.events.map((e) => [e.type, e]));
    assert.equal(got.get('baptism').note, 'Parrain : Jean');
    assert.equal(got.get('occupation').note, 'Ajusteur');
    assert.equal(got.get('other').label, 'Service militaire');
    const by = (fact) => p.sources.find((x) => x.fact === fact);
    assert.deepEqual([by('birth').kind, by('birth').place, by('birth').ref, by('birth').note, by('birth').title],
      ['birth', 'AD Rhône', '3 E 1, vue 2', 'Transcription', '']);
    assert.equal(by(got.get('baptism').id).title, 'Registre paroissial');
    assert.equal(by('').kind, 'family');
    assert.equal(by('union:' + unions[0].id).kind, 'marriage');
  });
});

describe('type d’union', () => {
  test('aller-retour, y compris sans date', () => {
    loadTree([person('a', { given: 'A', sex: 'M' }), person('b', { given: 'B', sex: 'F' })], [{ id: 'u1', a: 'a', b: 'b', type: 'pacs' }]);
    const ged = buildGedcom();
    assert.match(ged, /1 MARR\r\n2 TYPE Pacs\r\n2 _UTYPE pacs/);
    assert.equal(parseGedcom(ged).unions[0].data.type, 'pacs');
  });

  test('déduit du TYPE des autres logiciels', () => {
    const type = (t) => parseGedcom(['0 @I1@ INDI', '1 NAME A /B/', '0 @I2@ INDI', '1 NAME C /D/', '0 @F1@ FAM', '1 HUSB @I1@', '1 WIFE @I2@', '1 MARR', ...(t ? ['2 TYPE ' + t] : [])].join('\n')).unions[0].data.type;
    assert.equal(type('Religious'), 'religious');
    assert.equal(type('Mariage civil'), 'married');
    assert.equal(type('Concubinage'), 'cohabiting');
    assert.equal(type('Fiançailles'), 'other');
    assert.equal(type(''), '');
  });
});
