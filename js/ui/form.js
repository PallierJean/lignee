/** Formulaire d'ajout et de modification d'une personne. */
import { S } from '../state.js';
import { narrow } from '../config.js';
import { esc } from '../utils/dom.js';
import { t } from '../i18n.js';
import { longDate } from '../utils/dates.js';
import {
  P, fullName, lifeYears, cmpName, avatarOf, photoSrc, birthSurname, SITUATIONS, DATED_SITUATIONS, situationLabel,
  EVENT_TYPES, SOURCE_KINDS, UNION_TYPES, UNION_ENDS, eventLabel,
} from '../model/people.js';

const TITLE_PREFIX = {
  father: 'f.fatherOf',
  mother: 'f.motherOf',
  child: 'f.childOf',
  spouse: 'f.spouseOf',
  sibling: 'f.siblingOf',
};

const SEXES = [['M', 'f.sexM'], ['F', 'f.sexF'], ['U', 'f.sexU']];

export function blankDraft() {
  return {
    given: '', surname: '', maidenName: '', sex: 'U',
    birthDate: '', birthPlace: '', deathDate: '', deathPlace: '', deceased: false,
    occupation: '', situation: '', situationDate: '', notes: '', fatherId: '', motherId: '', photo: '',
  };
}

/** Bloc photo du formulaire : aperçu, choix du fichier, retrait. */
function photoField(d) {
  // Sans photo : l'avatar du sexe choisi (mis à jour quand le sexe change, voir events.js)
  const avatar = avatarOf(d.sex);
  const preview = d.photo
    ? `<img class="photo" src="${esc(photoSrc(d.photo))}" alt="${t('f.photoChosen')}">`
    : `<img class="photo avatar" id="f-avatar" src="${esc(avatar)}" alt=""${avatar ? '' : ' hidden'}>`
      + `<div class="photo empty" id="f-avatar-empty" aria-hidden="true"${avatar ? ' hidden' : ''}></div>`;
  return `<div class="photofld">
      ${preview}
      <div class="photobtns">
        <label class="btn small"><input type="file" id="f-photo" accept="image/*" class="sr">${t(d.photo ? 'f.photoChange' : 'f.photoAdd')}</label>
        ${d.photo ? `<button class="link" type="button" data-act="photo-remove">${t('f.photoRemove')}</button>` : ''}
        <p class="hint">${t('f.photoHint')}</p>
      </div>
    </div>`;
}

/** Options d'une liste déroulante de personnes, triées par nom. */
export function personOptions(selected, exclude = new Set()) {
  return [...S.people]
    .filter(([k]) => !exclude.has(k))
    .sort((a, b) => cmpName(a[1], b[1]))
    .map(([k, p]) => {
      const years = lifeYears(p);
      return `<option value="${esc(k)}"${k === selected ? ' selected' : ''}>${esc(fullName(p))}${years ? ' (' + esc(years) + ')' : ''}</option>`;
    })
    .join('');
}

/** Options de la situation familiale, accordées au sexe choisi. */
export function situationOptions(d) {
  return SITUATIONS
    .map(([code]) => `<option value="${code}"${d.situation === code ? ' selected' : ''}>${esc(situationLabel(code, d.sex))}</option>`)
    .join('');
}

/** Lignes d'événements du formulaire. */
function eventRows(e) {
  return e.events.map((x, i) => (x.removed ? '' : `
    <div class="urow">
      <div class="row2">
        <label class="fld"><span>${t('f.eventType')}</span><select id="ev-type-${i}">${EVENT_TYPES.map((c) => `<option value="${c}"${x.type === c ? ' selected' : ''}>${esc(t('ev.' + c))}</option>`).join('')}</select></label>
        <label class="fld"><span>${t('f.date')}</span><input id="ev-date-${i}" value="${esc(x.date)}"></label>
      </div>
      <label class="fld"><span>${t('f.place')}</span><input id="ev-place-${i}" value="${esc(x.place)}" list="dl-places"></label>
      <label class="fld"><span>${t('f.eventNote')}</span><input id="ev-note-${i}" value="${esc(x.note)}"></label>
      <button class="link" type="button" data-act="ev-remove" data-i="${i}">${t('f.eventRemove')}</button>
    </div>`)).join('');
}

/** Faits qu'une source peut appuyer : naissance, décès, événements, unions enregistrées. */
function factOptions(e, selected) {
  const facts = [['', t('f.srcFactNone')], ['birth', t('birth')], ['death', t('death')]];
  for (const x of e.events) {
    if (!x.removed) facts.push([x.id, [eventLabel(x), longDate(x.date)].filter(Boolean).join(' · ')]);
  }
  for (const u of e.unions) {
    if (u.uid && !u.removed) facts.push(['union:' + u.uid, t('union') + ' · ' + fullName(P(u.other))]);
  }
  return facts.map(([v, label]) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(label)}</option>`).join('');
}

/** Galerie du formulaire : une ligne par image. */
function mediaRows(e) {
  return e.media.map((x, i) => (x.removed ? '' : `
    <div class="urow">
      <div class="photofld">
        <img class="photo" src="${esc(photoSrc(x.photo))}" alt="">
        <div class="an-form media-fields">
          <label class="fld"><span>${t('f.srcTitle')}</span><input id="med-title-${i}" value="${esc(x.title)}"></label>
          <label class="fld"><span>${t('f.date')}</span><input id="med-date-${i}" value="${esc(x.date)}"></label>
        </div>
      </div>
      <label class="fld"><span>${t('f.eventNote')}</span><input id="med-note-${i}" value="${esc(x.note)}"></label>
      <button class="link" type="button" data-act="med-remove" data-i="${i}">${t('f.medRemove')}</button>
    </div>`)).join('');
}

/** Lignes de sources du formulaire. */
function sourceRows(e) {
  return e.sources.map((x, i) => (x.removed ? '' : `
    <div class="urow">
      <div class="row2">
        <label class="fld"><span>${t('f.srcKind')}</span><select id="src-kind-${i}">${SOURCE_KINDS.map((c) => `<option value="${c}"${x.kind === c ? ' selected' : ''}>${esc(t('src.' + c))}</option>`).join('')}</select></label>
        <label class="fld"><span>${t('f.srcFact')}</span><select id="src-fact-${i}">${factOptions(e, x.fact)}</select></label>
      </div>
      <label class="fld"><span>${t('f.srcTitle')}</span><input id="src-title-${i}" value="${esc(x.title)}" placeholder="${t('f.srcTitlePlaceholder')}"></label>
      <div class="row2">
        <label class="fld"><span>${t('f.srcPlace')}</span><input id="src-place-${i}" value="${esc(x.place)}" placeholder="${t('f.srcPlacePlaceholder')}"></label>
        <label class="fld"><span>${t('f.srcRef')}</span><input id="src-ref-${i}" value="${esc(x.ref)}" placeholder="${t('f.srcRefPlaceholder')}"></label>
      </div>
      <label class="fld"><span>${t('f.srcNote')}</span><textarea id="src-note-${i}">${esc(x.note)}</textarea></label>
      <div class="photofld">
        ${x.photo ? `<img class="photo" src="${esc(photoSrc(x.photo))}" alt="${t('f.srcPhoto')}">` : ''}
        <div class="photobtns">
          <label class="btn small"><input type="file" accept="image/*" class="sr" data-src-photo="${i}">${t(x.photo ? 'f.srcPhotoChange' : 'f.srcPhotoAdd')}</label>
          ${x.photo ? `<button class="link" type="button" data-act="src-photo-remove" data-i="${i}">${t('f.photoRemove')}</button>` : ''}
        </div>
      </div>
      <button class="link" type="button" data-act="src-remove" data-i="${i}">${t('f.srcRemove')}</button>
    </div>`)).join('');
}

function leadText(e) {
  if (e.id) return fullName(P(e.id));
  if (e.rel === 'father' || e.rel === 'mother') return t('f.leadParent');
  if (e.rel === 'child') return t('f.leadChild');
  if (e.rel === 'sibling') {
    const o = P(e.of);
    return o && (o.fatherId || o.motherId)
      ? t('f.leadSibling')
      : t('f.leadSiblingNone');
  }
  if (e.rel === 'spouse') return t('f.leadSpouse');
  return t('f.leadNew');
}

export function formHTML() {
  const e = S.edit;
  const d = e.draft;
  const of = e.of ? P(e.of) : null;
  const title = e.id ? t('editFiche') : e.rel && of ? t(TITLE_PREFIX[e.rel]) + fullName(of) : t('f.new');
  const self = new Set(e.id ? [e.id] : []);
  // Nom déduit des parents : repère pour ne pas écraser un nom saisi à la main (voir events.js)
  const auto = esc(birthSurname(d.fatherId, d.motherId));

  // Suggestions de saisie : lieux et noms déjà utilisés
  const places = new Set();
  const surnames = new Set();
  for (const p of S.people.values()) {
    if (p.birthPlace) places.add(p.birthPlace.trim());
    if (p.deathPlace) places.add(p.deathPlace.trim());
    if (p.surname) surnames.add(p.surname.trim());
    if (p.maidenName) surnames.add(p.maidenName.trim());
  }
  for (const u of S.unions.values()) if (u.place) places.add(u.place.trim());

  const unionRows = e.unions.map((u, i) => (u.removed ? '' : `
    <div class="urow">
      <div class="uname"><b>×</b>${esc(fullName(P(u.other)))}</div>
      <label class="fld"><span>${t('f.unionType')}</span><select id="u-type-${i}"><option value="">${t('f.situNone')}</option>${UNION_TYPES.map((c) => `<option value="${c}"${u.type === c ? ' selected' : ''}>${esc(t('ut.' + c))}</option>`).join('')}</select></label>
      <div class="row2">
        <label class="fld"><span>${t('f.unionDate')}</span><input id="u-date-${i}" value="${esc(u.date)}" placeholder="18/09/1923"></label>
        <label class="fld"><span>${t('f.place')}</span><input id="u-place-${i}" value="${esc(u.place)}" list="dl-places"></label>
      </div>
      <div class="row2">
        <label class="fld"><span>${t('f.unionEnd')}</span><select id="u-end-${i}"><option value="">${t('f.unionOngoing')}</option>${UNION_ENDS.map((c) => `<option value="${c}"${u.end === c ? ' selected' : ''}>${esc(t('ue.' + c))}</option>`).join('')}</select></label>
        <label class="fld"><span>${t('f.unionEndDate')}</span><input id="u-enddate-${i}" value="${esc(u.endDate || '')}"></label>
      </div>
      <button class="link" type="button" data-act="u-remove" data-i="${i}">${t('f.unionRemove')}</button>
    </div>`)).join('');

  return `<form id="editForm" class="form" novalidate autocomplete="off">
    <div><h2>${esc(title)}</h2><p class="lead">${esc(leadText(e))}</p></div>
    ${e.error ? `<p class="err" role="alert">${esc(t(e.error))}</p>` : ''}

    ${photoField(d)}

    <div class="row2">
      <label class="fld"><span>${t('f.given')}</span><input id="f-given" value="${esc(d.given)}"></label>
      <label class="fld"><span>${t('f.surname')}</span><input id="f-surname" value="${esc(d.surname)}" data-auto="${auto}" list="dl-surnames"></label>
    </div>
    <fieldset class="fs">
      <legend>${t('f.sex')}</legend>
      <div class="sexseg">${SEXES.map(([v, label]) => `<label><input type="radio" name="f-sex" id="f-sex-${v}" value="${v}"${d.sex === v ? ' checked' : ''}><i class="sx ${v}"></i>${t(label)}</label>`).join('')}</div>
    </fieldset>
    <label class="fld" id="f-maiden-row"${d.sex === 'F' ? '' : ' hidden'}><span>${t('f.maiden')}</span><input id="f-maiden" value="${esc(d.maidenName)}" data-auto="${auto}" list="dl-surnames" placeholder="${t('f.maidenPlaceholder')}"></label>

    <div class="gt"><b>°</b>${t('birth')}</div>
    <div class="row2">
      <label class="fld"><span>${t('f.date')}</span><input id="f-bdate" value="${esc(d.birthDate)}" placeholder="${t('f.bdatePlaceholder')}"></label>
      <label class="fld"><span>${t('f.place')}</span><input id="f-bplace" value="${esc(d.birthPlace)}" list="dl-places"></label>
    </div>

    <div class="gt"><b>†</b>${t('death')}</div>
    <div class="row2">
      <label class="fld"><span>${t('f.date')}</span><input id="f-ddate" value="${esc(d.deathDate)}" placeholder="${t('f.ddatePlaceholder')}"></label>
      <label class="fld"><span>${t('f.place')}</span><input id="f-dplace" value="${esc(d.deathPlace)}" list="dl-places"></label>
    </div>
    <label class="check"><input type="checkbox" id="f-deceased"${d.deceased ? ' checked' : ''}> ${t('f.deceased')}</label>
    <label class="fld"><span>${t('f.occupation')}</span><input id="f-occ" value="${esc(d.occupation)}"></label>
    <div class="row2">
      <label class="fld"><span>${t('situation')}</span><select id="f-situ"><option value="">${t('f.situNone')}</option>${situationOptions(d)}</select></label>
      <label class="fld" id="f-situdate-row"${DATED_SITUATIONS.has(d.situation) ? '' : ' hidden'}><span>${t('f.situDate')}</span><input id="f-situdate" value="${esc(d.situationDate)}" placeholder="${t('f.situDatePlaceholder')}"></label>
    </div>

    <div class="gt">${t('parents')}</div>
    <div class="row2">
      <label class="fld"><span>${t('father')}</span><select id="f-father"><option value="">${t('f.fatherUnknown')}</option>${personOptions(d.fatherId, self)}</select></label>
      <label class="fld"><span>${t('mother')}</span><select id="f-mother"><option value="">${t('f.motherUnknown')}</option>${personOptions(d.motherId, self)}</select></label>
    </div>

    <div class="gt"><b>×</b>${t('unions')}</div>
    ${unionRows}
    <div class="fld pick">
      <span id="f-spouse-lbl">${t('f.addUnion')}</span>
      <input id="f-spouse" aria-labelledby="f-spouse-lbl" type="search" placeholder="${t('f.addUnionPlaceholder')}" autocomplete="off" spellcheck="false"
        role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="f-spouseList">
      <ul class="find-list" id="f-spouseList" role="listbox" aria-label="${t('find.list')}" hidden></ul>
    </div>
    <div class="gt">${t('events')}</div>
    ${eventRows(e)}
    <button class="addline" type="button" data-act="ev-add">+ ${t('f.addEvent')}</button>

    <div class="gt">${t('sources')}</div>
    ${sourceRows(e)}
    <button class="addline" type="button" data-act="src-add">+ ${t('f.addSource')}</button>

    <div class="gt">${t('media')}</div>
    ${mediaRows(e)}
    <label class="addline"><input type="file" id="f-media" accept="image/*" multiple class="sr">+ ${t('f.addMedia')}</label>

    <label class="fld"><span>${t('notes')}</span><textarea id="f-notes" placeholder="${t('f.notesPlaceholder')}">${esc(d.notes)}</textarea></label>

    <div class="form-actions">
      <button class="btn primary" type="submit" id="f-submit">${t('save')}</button>
      <button class="btn" type="button" data-act="cancel-edit">${t('cancel')}</button>
    </div>
    <datalist id="dl-places">${[...places].sort().map((x) => `<option value="${esc(x)}"></option>`).join('')}</datalist>
    <datalist id="dl-surnames">${[...surnames].sort().map((x) => `<option value="${esc(x)}"></option>`).join('')}</datalist>
  </form>`;
}

/** Recopie les valeurs saisies dans le brouillon S.edit (avant un nouveau rendu ou l'enregistrement). */
export function captureDraft() {
  const e = S.edit;
  if (!e || !document.getElementById('editForm')) return;
  const d = e.draft;
  const value = (id) => {
    const el = document.getElementById(id);
    return el ? el.value : '';
  };
  d.given = value('f-given');
  d.surname = value('f-surname');
  d.maidenName = value('f-maiden');
  d.birthDate = value('f-bdate');
  d.birthPlace = value('f-bplace');
  d.deathDate = value('f-ddate');
  d.deathPlace = value('f-dplace');
  d.occupation = value('f-occ');
  d.situation = value('f-situ');
  d.situationDate = value('f-situdate');
  d.notes = value('f-notes');
  d.fatherId = value('f-father');
  d.motherId = value('f-mother');
  const sex = document.querySelector('input[name="f-sex"]:checked');
  d.sex = sex ? sex.value : 'U';
  const deceased = document.getElementById('f-deceased');
  d.deceased = !!(deceased && deceased.checked);
  e.unions.forEach((u, i) => {
    if (u.removed) return;
    const dateInput = document.getElementById('u-date-' + i);
    if (dateInput) {
      u.date = dateInput.value;
      u.place = document.getElementById('u-place-' + i).value;
      u.type = document.getElementById('u-type-' + i).value;
      u.end = document.getElementById('u-end-' + i).value;
      u.endDate = document.getElementById('u-enddate-' + i).value;
    }
  });
  e.events.forEach((x, i) => {
    if (x.removed || !document.getElementById('ev-date-' + i)) return;
    x.type = value('ev-type-' + i);
    x.date = value('ev-date-' + i);
    x.place = value('ev-place-' + i);
    x.note = value('ev-note-' + i);
  });
  e.media.forEach((x, i) => {
    if (x.removed || !document.getElementById('med-title-' + i)) return;
    x.title = value('med-title-' + i);
    x.date = value('med-date-' + i);
    x.note = value('med-note-' + i);
  });
  e.sources.forEach((x, i) => {
    if (x.removed || !document.getElementById('src-kind-' + i)) return;
    x.kind = value('src-kind-' + i);
    x.fact = value('src-fact-' + i);
    x.title = value('src-title-' + i);
    x.place = value('src-place-' + i);
    x.ref = value('src-ref-' + i);
    x.note = value('src-note-' + i);
  });
}

export function focusFirstField() {
  setTimeout(() => {
    const el = document.getElementById('f-given');
    if (el) el.focus({ preventScroll: !narrow() });
  }, 30);
}
