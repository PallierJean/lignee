import assert from 'node:assert/strict';
import { test, describe, beforeEach } from 'node:test';
import { S } from '../js/state.js';
import * as A from '../js/actions.js';
import { resetHistory } from '../js/services/history.js';
import { recordBirthAct, recordMarriageAct, hasBirthDocument, hasMarriageDocument } from '../js/model/civil-acts.js';
import { renderAnalysis, copyActs, resetActsHalls, setActsType, askedPatches } from '../js/ui/analysis.js';
import { loadCommuneChanges } from '../js/model/communes.js';
import { loadTree, person, resetApp, html } from './helpers.js';

const NOW = new Date(2026, 10, 20);

describe('actes de naissance et de mariage à demander', () => {
  beforeEach(() => {
    resetApp();
    resetHistory();
    resetActsHalls();
  });

  test('naissance : date, commune en France, plus de 75 ans ; nom de naissance', () => {
    const rec = (fields) => recordBirthAct({ given: 'Marie Jeanne', surname: 'Durand', maidenName: 'Faure', sex: 'F', ...fields }, () => '87', NOW);
    assert.deepEqual(rec({ birthDate: '12/03/1900', birthPlace: 'Limoges' }), {
      type: 'birth', first: ['Marie', 'Jeanne'], last: 'Faure', married: 'Durand', sex: 'F',
      date: '19000312', dateText: '12/03/1900', place: { city: 'Limoges', dept: '87', country: '' }, certificate: '', record: true,
    });
    assert.equal(rec({ birthDate: '1951', birthPlace: 'Limoges' }), null, 'moins de 75 ans');
    assert.equal(rec({ birthDate: '1950', birthPlace: 'Limoges' }).date, '19500000', '75 ans passés');
    assert.ok(rec({ birthDate: '20/11/1951', birthPlace: 'Limoges' }), '75 ans ce jour');
    assert.equal(rec({ birthDate: '21/11/1951', birthPlace: 'Limoges' }), null, '75 ans demain');
    assert.equal(rec({ birthDate: 'vers 1900', birthPlace: 'Limoges' }), null, 'date incertaine');
    assert.equal(rec({ birthDate: '1900', birthPlace: 'Liège, Belgique' }), null, 'à l’étranger');
    assert.equal(rec({ birthDate: '1900', birthPlace: '' }), null, 'sans lieu');
  });

  test('mariage : les deux époux dans l’arbre, un mariage civil daté et situé', () => {
    loadTree([
      person('a', { given: 'Jean', surname: 'Roux', sex: 'M' }),
      person('b', { given: 'Anne', surname: 'Roux', maidenName: 'Petit', sex: 'F' }),
    ]);
    const u = (fields) => recordMarriageAct({ a: 'a', b: 'b', date: '04/05/1925', place: 'Tulle (19)', ...fields }, () => '', NOW);
    assert.deepEqual(u({ type: 'married' }), {
      type: 'marriage', first: ['Jean'], last: 'Roux', married: '', sex: 'M', spouseFirst: ['Anne'], spouseLast: 'Petit',
      date: '19250504', dateText: '04/05/1925', place: { city: 'Tulle', dept: '19', country: '' }, certificate: '', record: true,
    });
    assert.ok(u({}), 'sans type : un mariage');
    assert.equal(u({ type: 'pacs' }), null);
    assert.equal(u({ type: 'religious' }), null, 'le mariage religieux n’est pas en mairie');
    assert.equal(u({ b: 'x' }), null, 'époux absent');
    assert.equal(u({ date: '1960' }), null, 'moins de 75 ans');
  });

  test('déjà en main : la photo de l’acte dans une source', () => {
    loadTree([
      person('a', { given: 'Jean', sex: 'M', sources: [{ kind: 'birth', title: 'Acte', photo: 'data:image/png;base64,A' }] }),
      person('b', { given: 'Anne', sex: 'F', sources: [{ kind: 'marriage', title: 'Mariage', fact: 'union:u1', photo: 'data:image/png;base64,B' }] }),
      person('c', { given: 'Paul', sex: 'M', sources: [{ kind: 'birth', title: 'Acte sans photo' }] }),
    ], [{ id: 'u1', a: 'a', b: 'b', date: '1925', place: 'Tulle' }, { id: 'u2', a: 'a', b: 'c', date: '1930', place: 'Tulle' }]);
    assert.equal(hasBirthDocument(S.people.get('a')), true);
    assert.equal(hasBirthDocument(S.people.get('c')), false, 'sans photo');
    assert.equal(hasMarriageDocument('u1'), true, 'dans les sources d’un époux, pour cette union');
    assert.equal(hasMarriageDocument('u2'), false);
  });

  test('vue Actes : naissances et mariages par mairie, copiés, suivis dans la fiche ou l’union', async () => {
    S.mode = 'local'; // naissances et mariages : sans l'INSEE
    loadTree([
      person('a', { given: 'Jean', surname: 'Roux', sex: 'M', birthDate: '02/01/1900', birthPlace: 'Tulle (19)' }),
      person('b', { given: 'Anne', surname: 'Roux', maidenName: 'Petit', sex: 'F', birthDate: '1902', birthPlace: 'Limoges (87)' }),
      person('c', { given: 'Paul', surname: 'Roux', sex: 'M', birthDate: '1990', birthPlace: 'Tulle (19)' }),
    ], [{ id: 'u1', a: 'a', b: 'b', type: 'married', date: '04/05/1925', place: 'Tulle (19)' }]);
    A.setTab('analysis');
    A.setAnalysisView('acts');
    await loadCommuneChanges();
    setActsType('birth');
    let out = html('paneAnalysis');
    assert.match(out, /data-type="death" aria-pressed="false">Décès <span class="n">0<\/span>/);
    assert.match(out, /data-type="birth" aria-pressed="true">Naissances <span class="n">2<\/span>/);
    assert.match(out, /data-type="marriage" aria-pressed="false">Mariages <span class="n">1<\/span>/);
    assert.match(out, /2 actes de naissance à demander à 2 mairies/);
    assert.match(out, /Jean ROUX<\/button> <small>naissance le 02 Janvier 1900<\/small>/);
    assert.doesNotMatch(out, /Paul ROUX/, 'moins de 75 ans');
    let copied = null;
    Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async (x) => { copied = x; } } }, configurable: true });
    await copyActs();
    assert.match(copied, /Mairie de Tulle \(19\)\n- Roux Jean, né\(e\) le 02 Janvier 1900 \(numéro d’acte inconnu\)/);
    assert.match(copied, /Mairie de Limoges \(87\)\n- Petit Anne \(épouse Roux\), né\(e\) en 1902 \(numéro d’acte inconnu\)/);

    // Déjà demandé : dans la fiche, à part de l'acte de décès
    await A.setActRequests(askedPatches(0)); // Tulle (19), avant Limoges (87)
    assert.match(S.people.get('a').birthActAsked, /^\d{2}\/\d{2}\/\d{4}$/);
    assert.equal(S.people.get('b').birthActAsked, undefined);
    assert.equal(S.people.get('a').actAsked, undefined, 'l’acte de décès reste à part');

    setActsType('marriage');
    out = html('paneAnalysis');
    assert.match(out, /Jean ROUX<\/button> & <button[^>]*>Anne ROUX<\/button> <small>mariage le 04 Mai 1925<\/small>/);
    await copyActs();
    assert.equal(copied, 'Mairie de Tulle (19)\n- Mariage de Roux Jean et de Petit Anne, le 04 Mai 1925 (numéro d’acte inconnu)');
    await A.setActRequests(askedPatches(0));
    assert.match(S.unions.get('u1').actAsked, /^\d{2}\/\d{2}\/\d{4}$/, 'gardé dans l’union');
    assert.match(html('paneAnalysis'), /acts-town done/);
    await A.undo();
    assert.equal(S.unions.get('u1').actAsked, undefined);
    setActsType('death');
  });
});
