import assert from 'node:assert/strict';
import { test, describe, beforeEach } from 'node:test';
import { S } from '../js/state.js';
import * as A from '../js/actions.js';
import { inseeQuery, inseeSignature, matchDeath, deathDifferences, actDateText, estimatedBirth } from '../js/model/insee.js';
import { inseePending, checkInsee, inseeResults, ignoreInsee, forgetInsee, resetInseeMemo } from '../js/services/insee.js';
import { resetHistory } from '../js/services/history.js';
import { renderAnalyse } from '../js/ui/analyse.js';
import { loadTree, person, resetApp, html } from './helpers.js';

/** Acte de décès fictif, au format renvoyé par server.js. */
const act = (fields = {}) => ({
  first: ['Lucien', 'Marcel'], last: 'Bertrand', sex: 'M',
  birthDate: '19200312', birth: { city: 'Tulle', dept: '19', country: 'France' },
  deathDate: '19950704', death: { city: 'Limoges', dept: '87', country: 'France' },
  certificate: '412', ...fields,
});

const lucien = (fields = {}) => person('l', {
  given: 'Lucien', surname: 'Bertrand', sex: 'M', birthDate: '12 Mars 1920', birthPlace: 'Tulle (19)', deceased: true, ...fields,
});

beforeEach(() => {
  resetApp();
  resetHistory();
  resetInseeMemo();
});

describe('INSEE : qui est vérifié, et avec quoi', () => {
  test('question envoyée : nom de naissance, premier prénom, sexe, naissance', () => {
    loadTree([
      lucien(),
      person('m', { given: 'Marie-Hélène Jeanne', surname: 'Bertrand', maidenName: 'Roche', sex: 'F', birthDate: 'vers 1930', deceased: true }),
      person('n', { given: 'Pierre (dit  Pierrot)', surname: 'Durand', sex: 'M', birthDate: 'Mars 1925', deceased: true }),
    ]);
    assert.deepEqual(inseeQuery('l'), { lastName: 'Bertrand', firstName: 'Lucien', sex: 'M', birthDate: '12/03/1920' });
    assert.deepEqual(inseeQuery('m'), { lastName: 'Roche', firstName: 'Marie-Hélène', sex: 'F', birthDate: '1925-1935' });
    assert.deepEqual(inseeQuery('n'), { lastName: 'Durand', firstName: 'Pierre', sex: 'M', birthDate: '1924-1926' });
    assert.equal(inseeSignature(inseeQuery('l')), 'Bertrand|Lucien|M|12/03/1920');
  });

  test('pas de question : mort avant 1970, trop ancien, vivant de moins de 75 ans, sans nom', () => {
    loadTree([
      lucien({ id: 'a', deathDate: '1968' }),
      person('b', { given: 'Jean', surname: 'Roche', sex: 'M', birthDate: '1850', deceased: true }),
      person('c', { given: 'Paul', surname: 'Roche', sex: 'M', birthDate: '1990' }),
      person('d', { given: 'Paul', surname: 'Roche', sex: 'M' }),
      person('e', { given: '', surname: 'Roche', sex: 'M', deceased: true }),
      person('f', { given: 'Anne', surname: 'Roche', sex: 'F', birthDate: '1940' }),
    ]);
    for (const id of ['a', 'b', 'c', 'd', 'e']) assert.equal(inseeQuery(id, 2026), null, id);
    assert.ok(inseeQuery('f', 2026), 'vivante de 86 ans : vérifiée');
  });

  test('naissance inconnue : estimée d’après la famille, les ancêtres lointains sont écartés', () => {
    loadTree([
      person('w', { given: 'Jeanne', surname: 'Roche', sex: 'F', deceased: true }),
      person('h', { given: 'Jean', surname: 'Roche', sex: 'M', birthDate: '1702', deceased: true }),
      person('k', { given: 'Léon', surname: 'Roche', sex: 'M', birthDate: '1935', fatherId: 'x', deceased: true }),
      person('x', { given: 'Louis', surname: 'Roche', sex: 'M', deceased: true }),
    ], [{ a: 'h', b: 'w', type: 'married' }]);
    assert.equal(estimatedBirth('w'), 1702);
    assert.equal(inseeQuery('w'), null);
    assert.equal(estimatedBirth('x'), 1907);
    assert.ok(inseeQuery('x'));
  });

  test('date de l’acte reportée telle qu’on la saisit', () => {
    assert.equal(actDateText('19721212'), '12/12/1972');
    assert.equal(actDateText('19720000'), '1972');
    assert.equal(actDateText(''), '');
  });
});

describe('INSEE : rapprochement et écarts', () => {
  test('naissance exacte identique : acte certain, rien à reporter quand tout concorde', () => {
    loadTree([lucien({ given: 'Lucien Marcel', deathDate: '04/07/1995', deathPlace: 'Limoges (87)' })]);
    const m = matchDeath('l', [act()]);
    assert.equal(m.level, 'sure');
    assert.deepEqual(deathDifferences('l', m.act), []);
  });

  test('écarts et compléments : décès contradictoire, lieu manquant, prénoms complets', () => {
    loadTree([lucien({ deathDate: '02/07/1995' })]);
    const m = matchDeath('l', [act()]);
    const diffs = deathDifferences('l', m.act);
    assert.deepEqual(diffs.map((x) => [x.field, x.kind]), [['given', 'add'], ['deathDate', 'fix'], ['deathPlace', 'add']]);
    assert.deepEqual(diffs[1].patch, { deathDate: '04/07/1995', deceased: true });
    assert.deepEqual(diffs[2].patch, { deathPlace: 'Limoges (87)' });
    assert.equal(diffs[0].patch, undefined, 'les prénoms ne sont que signalés');
  });

  test('marqué vivant mais décédé : signalé, et « Le » ou « St » ne font pas un écart de lieu', () => {
    loadTree([lucien({ deceased: false, birthDate: '12/03/1920', birthPlace: 'Le Palais-sur-Vienne (87)' })]);
    const m = matchDeath('l', [act({ birth: { city: 'Palais-sur-Vienne', dept: '87', country: 'France' } })]);
    const diffs = deathDifferences('l', m.act);
    assert.ok(!diffs.some((x) => x.field === 'birthPlace'));
    assert.ok(diffs.some((x) => x.field === 'deceased' && x.kind === 'fix'));
  });

  test('homonymes : sexe, prénom et naissance contraires écartés ; sans date, simple piste', () => {
    loadTree([lucien(), person('z', { given: 'Lucien', surname: 'Bertrand', sex: 'M', deceased: true })]);
    const others = [act({ sex: 'F' }), act({ first: ['Marcel'] }), act({ birthDate: '19210312' })];
    assert.equal(matchDeath('l', others), null);
    assert.equal(matchDeath('z', [act()]).level, 'lead');
    assert.equal(matchDeath('z', [act(), act({ birthDate: '19300101' }), act({ birthDate: '19400101' }), act({ birthDate: '19500101' })]), null);
  });

  test('deux actes aussi bons : pas de certitude', () => {
    loadTree([lucien({ birthDate: '1920' })]);
    assert.equal(matchDeath('l', [act(), act({ birthDate: '19201001', certificate: '9' })]).level, 'lead');
  });
});

describe('INSEE : vérification et vue', () => {
  const answer = (acts) => async (url) => ({ ok: true, json: async () => (url.includes('Bertrand') ? acts : []) });

  test('seules les fiches nouvelles ou modifiées sont revérifiées', async () => {
    S.mode = 'file';
    loadTree([lucien(), person('m', { given: 'Anne', surname: 'Roche', sex: 'F', birthDate: '1930', deceased: true })]);
    const asked = [];
    globalThis.fetch = async (url) => {
      asked.push(url);
      return answer([act()])(url);
    };
    assert.deepEqual(inseePending(), ['l', 'm']);
    await checkInsee(inseePending(), () => {});
    assert.equal(asked.length, 2);
    assert.match(asked[0], /^api\/insee\?lastName=Bertrand&firstName=Lucien&sex=M&birthDate=12%2F03%2F1920$/);
    assert.deepEqual(inseePending(), []);
    S.people.get('m').birthDate = '1931';
    assert.deepEqual(inseePending(), ['m']);
    resetInseeMemo(); // les résultats survivent au rechargement
    assert.equal(inseeResults().l.acts.length, 1);
    forgetInsee();
    assert.deepEqual(inseePending(), ['l', 'm']);
  });

  test('vue INSEE : écarts, report d’un clic, annulation, ignorer', async () => {
    S.mode = 'file';
    loadTree([lucien({ deathDate: '02/07/1995' })]);
    globalThis.fetch = answer([act()]);
    await checkInsee(inseePending(), () => {});
    A.setTab('analyse');
    A.setAnalyseView('insee');
    let out = html('paneAnalyse');
    assert.match(out, /Écarts avec l’INSEE/);
    assert.match(out, /acte certain/);
    assert.match(out, /acte n° 412/);
    assert.match(out, /<s>02 Juillet 1995<\/s> → <b>04 Juillet 1995<\/b>/);

    S.mode = 'local'; // enregistrement en mémoire du navigateur, sans serveur
    await A.applyInsee('l', 1);
    assert.equal(S.people.get('l').deathDate, '04/07/1995');
    assert.equal(S.people.get('l').deathPlace, undefined, 'un seul écart reporté');
    await A.applyInsee('l');
    assert.equal(S.people.get('l').deathPlace, 'Limoges (87)');
    await A.undo();
    assert.equal(S.people.get('l').deathPlace, undefined);

    S.mode = 'file';
    renderAnalyse();
    out = html('paneAnalyse');
    assert.match(out, /À compléter d’après l’INSEE/);
    assert.match(out, /Prénoms à l’état civil : <b>Lucien Marcel<\/b>/);

    S.mode = 'local';
    await A.applyInsee('l');
    S.mode = 'file';
    renderAnalyse();
    out = html('paneAnalyse');
    assert.doesNotMatch(out, /À compléter/, 'il ne reste que les prénoms, qui ne se reportent pas');
    assert.match(out, /1 fiche conforme à l’INSEE/);
    assert.match(out, /acte n° 412/);
    S.mode = 'local';
    await A.undo();
    S.mode = 'file';
    renderAnalyse();
    A.ignoreInseeOf('l');
    assert.doesNotMatch(html('paneAnalyse'), /À compléter/);
    assert.ok(inseeResults().l.ignored);
  });

  test('hors du mode fichier : la vue explique qu’il faut le serveur local', () => {
    loadTree([lucien()]);
    A.setTab('analyse');
    A.setAnalyseView('insee');
    assert.match(html('paneAnalyse'), /npm start/);
    ignoreInsee('absent'); // sans résultat : rien à faire
  });
});
