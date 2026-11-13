import assert from 'node:assert/strict';
import { describe, test, beforeEach } from 'node:test';
import { S } from '../js/state.js';
import { draftIssues, DRAFT_ID } from '../js/model/draft-checks.js';
import { loadTree, person, resetApp } from './helpers.js';

const draft = (fields) => ({ given: '', surname: '', maidenName: '', sex: 'U', birthDate: '', deathDate: '', fatherId: '', motherId: '', ...fields });
const codes = (e) => draftIssues(e, new Date(2026, 0, 1)).map((x) => x.code);

describe('cohérence d’une fiche pas encore enregistrée', () => {
  beforeEach(() => {
    resetApp();
    loadTree([
      person('m', { given: 'Marc', surname: 'Bertin', sex: 'M', birthDate: '1961' }),
      person('v', { given: 'Lucie', surname: 'Morel', sex: 'F', birthDate: '1961' }),
      person('s', { given: 'Sophie', surname: 'Bertin', sex: 'F', birthDate: '28 juillet 1992', fatherId: 'm', motherId: 'v' }),
    ], [{ a: 'm', b: 'v' }]);
  });

  test('un enfant qui ne porte pas le nom de son père, né avant lui', () => {
    const e = { id: null, rel: 'child', of: 'm', draft: draft({ given: 'Jean', surname: 'Bertain', sex: 'M', birthDate: '1950', fatherId: 'm', motherId: 'v' }), unions: [] };
    const found = draftIssues(e, new Date(2026, 0, 1));
    assert.ok(found.some((x) => x.code === 'nameNotFather' && x.ids[0] === DRAFT_ID));
    assert.ok(found.some((x) => x.code === 'parentYounger'));
    assert.equal(found[0].level, 'error', 'les erreurs d’abord');
  });

  test('un père ajouté plus jeune que son enfant : vu comme s’il était déjà relié', () => {
    const e = { id: null, rel: 'father', of: 's', draft: draft({ given: 'Paul', surname: 'Bertin', sex: 'M', birthDate: '2000' }), unions: [] };
    assert.ok(codes(e).includes('parentYounger'));
  });

  test('une personne déjà dans l’arbre, et une date coupée', () => {
    const e = { id: null, rel: 'child', of: 'm', draft: draft({ given: 'Sophie', surname: 'Bertin', sex: 'F', birthDate: '28', fatherId: 'm', motherId: 'v' }), unions: [] };
    const c = codes(e);
    assert.ok(c.includes('duplicate'), c.join());
    assert.ok(c.includes('notADate'));
  });

  test('une fiche juste : rien à dire, et l’arbre reste tel quel', () => {
    const before = S.people;
    const e = { id: null, rel: 'child', of: 'm', draft: draft({ given: 'Jean', surname: 'Bertin', sex: 'M', birthDate: '10 décembre 1995', fatherId: 'm', motherId: 'v' }), unions: [] };
    assert.deepEqual(codes(e), []);
    assert.equal(S.people, before);
    assert.equal(S.people.size, 3);
  });

  test('une union avant la naissance', () => {
    const e = { id: null, rel: 'spouse', of: 'm', draft: draft({ given: 'Anne', surname: 'Roux', sex: 'F', birthDate: '1970' }), unions: [{ uid: null, other: 'm', type: 'married', date: '1960', place: '' }] };
    assert.ok(codes(e).includes('unionBeforeBirth'));
  });
});
