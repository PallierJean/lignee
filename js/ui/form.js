/** Formulaire d'ajout et de modification d'une personne. */
import { S } from '../state.js';
import { narrow } from '../config.js';
import { esc } from '../utils/dom.js';
import { t, getLang } from '../i18n.js';
import { longDate } from '../utils/dates.js';
import { placeUses, parsePlace, formatPlace } from '../model/places.js';
import { DEPARTMENTS, departmentName, departmentCode } from '../model/departments.js';
import { COUNTRIES, countryName, isFrance } from '../model/countries.js';
import { loadCommunes, cityDepartments, departmentsText } from '../model/communes.js';
import {
  P, fullName, lifeYears, cmpName, avatarOf, photoSrc, birthSurname, SITUATIONS, DATED_SITUATIONS, situationLabel, situationNoneLabel,
  EVENT_TYPES, SOURCE_KINDS, UNION_TYPES, UNION_ENDS, REMARRIAGE_CAUSES, eventLabel, isDead, partnersOf, isMinor, UNION_AGE,
} from '../model/people.js';

const TITLE_PREFIX = {
  father: 'f.fatherOf',
  mother: 'f.motherOf',
  child: 'f.childOf',
  spouse: 'f.spouseOf',
  sibling: 'f.siblingOf',
};

const SEXES = [['M', 'f.sexM'], ['F', 'f.sexF'], ['U', 'f.sexU']];

/**
 * Date d'un champ du formulaire : en toutes lettres quand elle est reconnue (« 01/01/1900 »,
 * reportée de l'INSEE ou saisie ainsi, s'affiche « 01 Janvier 1900 »), sinon telle que saisie.
 */
const dateValue = (s) => longDate(s || '');

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
    : `<img class="photo avatar" id="f-avatar" src="${esc(avatar)}" alt="">`;
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
  return `<option value="">${esc(situationNoneLabel(d.sex))}</option>` + SITUATIONS
    .map(([code]) => `<option value="${code}"${d.situation === code ? ' selected' : ''}>${esc(situationLabel(code, d.sex))}</option>`)
    .join('');
}

/** Conjoint décédé d'un veuvage : les autres conjoints du couple, les morts seulement s'il y en a. */
function formerOptions(e, u) {
  const ids = new Set([...(e.id ? partnersOf(e.id) : []), ...partnersOf(u.other)].map((x) => x.id));
  ids.delete(e.id);
  ids.delete(u.other);
  const dead = [...ids].filter((k) => isDead(P(k)));
  const shown = new Set(dead.length ? dead : ids);
  if (u.formerId) shown.add(u.formerId);
  return personOptions(u.formerId, new Set([...S.people.keys()].filter((k) => !shown.has(k))));
}

/** Lieu en quatre champs : ville, pays (France par défaut), lieu-dit et département ; `id` en préfixe (« f-bplace-city »). */
export function placeFields(id, value) {
  const pl = parsePlace(value);
  pl.country = pl.country || countryLabel('France');
  // Sous le département, son nom d'après le numéro (mis à jour à la saisie, voir events.js)
  const extra = (k) => (k === 'dept' ? `<small class="dept-name" id="${id}-deptname">${esc(departmentName(pl.dept))}</small>` : '');
  const field = (k, cls = '') => `<label class="fld${cls}"><span>${t('f.place_' + k)}</span>`
    + `<input id="${id}-${k}" value="${esc(pl[k])}" list="dl-place-${k}">${extra(k)}</label>`;
  return `<div class="place3">${field('city', ' city')}${field('country')}${field('hamlet')}${field('dept')}</div>`;
}

/** Nom d'un pays dans la langue de l'interface (les lieux gardent le nom saisi). */
function countryLabel(fr) {
  const row = COUNTRIES.find(([name]) => name === fr);
  return row && getLang() === 'en' ? row[1] : fr;
}

/** Vrai si le pays du lieu `id` (préfixe de placeFields) est la France, ou vide. */
const inFrance = (id) => isFrance((document.getElementById(id + '-country') || {}).value);

/** Texte sous le département `id` (préfixe de placeFields) : son nom, ou l'écart avec la ville. */
export function departmentHint(id) {
  const value = (k) => (document.getElementById(id + '-' + k) || {}).value || '';
  const name = departmentName(value('dept'));
  if (!inFrance(id)) return name;
  const expected = cityDepartments(value('city'));
  const code = departmentCode(value('dept'));
  if (code && expected.length && !expected.includes(code)) return t('pl.deptConflict', value('city').trim(), departmentsText(expected));
  return name;
}

/**
 * La ville prime : quand elle n'existe que dans un département, celui-ci est rempli ou corrigé.
 * Dans plusieurs départements, le texte sous le champ les cite, sans rien changer.
 */
export async function departmentFromCity(id) {
  await loadCommunes();
  const city = document.getElementById(id + '-city');
  const dept = document.getElementById(id + '-dept');
  const label = document.getElementById(id + '-deptname');
  if (!city || !dept || !label) return;
  if (!inFrance(id)) {
    label.textContent = departmentHint(id); // à l'étranger, la ville ne dit rien du département
    return;
  }
  const expected = cityDepartments(city.value);
  if (expected.length === 1 && departmentCode(dept.value) !== expected[0]) {
    dept.value = expected[0];
    label.textContent = `${departmentName(expected[0])} · ${t('pl.fromCity')}`;
  } else if (expected.length > 1 && !expected.includes(departmentCode(dept.value))) {
    label.textContent = t('pl.severalDepts', departmentsText(expected));
  } else label.textContent = departmentHint(id);
}

/** Lieu saisi dans les quatre champs de placeFields(), en un seul texte (la France n'y est pas écrite). */
export function placeValue(id) {
  const part = (k) => {
    const el = document.getElementById(id + '-' + k);
    return el ? el.value : '';
  };
  // Un pays connu est écrit en français, comme les autres lieux de l'arbre
  const country = countryName(part('country')) || part('country');
  return formatPlace({ hamlet: part('hamlet'), city: part('city'), dept: part('dept'), country });
}

/** Lignes d'événements du formulaire. */
function eventRows(e) {
  return e.events.map((x, i) => (x.removed ? '' : `
    <div class="urow">
      <div class="row2">
        <label class="fld"><span>${t('f.eventType')}</span><select id="ev-type-${i}">${EVENT_TYPES.map((c) => `<option value="${c}"${x.type === c ? ' selected' : ''}>${esc(t('ev.' + c))}</option>`).join('')}</select></label>
        <label class="fld"><span>${t('f.date')}</span><input id="ev-date-${i}" value="${esc(dateValue(x.date))}"></label>
      </div>
      ${placeFields('ev-place-' + i, x.place)}
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
          <label class="fld"><span>${t('f.date')}</span><input id="med-date-${i}" value="${esc(dateValue(x.date))}"></label>
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

  // Suggestions de saisie : parties des lieux et noms déjà utilisés
  const parts = { hamlet: new Set(), city: new Set(), dept: new Set() };
  for (const { name } of placeUses()) {
    const pl = parsePlace(name);
    for (const k of Object.keys(parts)) if (pl[k]) parts[k].add(pl[k]);
  }
  const surnames = new Set();
  for (const p of S.people.values()) {
    if (p.surname) surnames.add(p.surname.trim());
    if (p.maidenName) surnames.add(p.maidenName.trim());
  }

  const unionRows = e.unions.map((u, i) => (u.removed ? '' : `
    <div class="urow">
      <div class="uname"><b>×</b>${esc(fullName(P(u.other)))}</div>
      <label class="fld"><span>${t('f.unionType')}</span><select id="u-type-${i}"><option value="">${t('f.unionTypeNone')}</option>${UNION_TYPES.map((c) => `<option value="${c}"${u.type === c ? ' selected' : ''}>${esc(t('ut.' + c))}</option>`).join('')}</select></label>
      <div class="row2" id="u-cause-row-${i}"${u.type === 'remarried' ? '' : ' hidden'}>
        <label class="fld"><span>${t('f.unionCause')}</span><select id="u-cause-${i}"><option value="">${t('f.unionCauseNone')}</option>${REMARRIAGE_CAUSES.map((c) => `<option value="${c}"${u.cause === c ? ' selected' : ''}>${esc(t('urc.' + c))}</option>`).join('')}</select></label>
        <label class="fld" id="u-former-row-${i}"${u.cause === 'widowed' ? '' : ' hidden'}><span>${t('f.unionFormer')}</span><select id="u-former-${i}"><option value="">${t('f.unionFormerNone')}</option>${formerOptions(e, u)}</select></label>
      </div>
      <label class="fld"><span>${t('f.unionDate')}</span><input id="u-date-${i}" value="${esc(dateValue(u.date))}" placeholder="18/09/1923"></label>
      ${placeFields('u-place-' + i, u.place)}
      <div class="row2">
        <label class="fld"><span>${t('f.unionEnd')}</span><select id="u-end-${i}"><option value="">${t('f.unionOngoing')}</option>${UNION_ENDS.map((c) => `<option value="${c}"${u.end === c ? ' selected' : ''}>${esc(t('ue.' + c))}</option>`).join('')}</select></label>
        <label class="fld"><span>${t('f.unionEndDate')}</span><input id="u-enddate-${i}" value="${esc(dateValue(u.endDate))}"></label>
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
    <label class="fld"><span>${t('f.date')}</span><input id="f-bdate" value="${esc(dateValue(d.birthDate))}" placeholder="${t('f.bdatePlaceholder')}"></label>
    ${placeFields('f-bplace', d.birthPlace)}

    <div class="gt"><b>†</b>${t('death')}</div>
    <label class="fld"><span>${t('f.date')}</span><input id="f-ddate" value="${esc(dateValue(d.deathDate))}" placeholder="${t('f.ddatePlaceholder')}"></label>
    ${placeFields('f-dplace', d.deathPlace)}
    <label class="check"><input type="checkbox" id="f-deceased"${d.deceased ? ' checked' : ''}> ${t('f.deceased')}</label>
    <label class="fld"><span>${t('f.occupation')}</span><input id="f-occ" value="${esc(d.occupation)}"></label>
    <div class="row2">
      <label class="fld"><span>${t('situation')}</span><select id="f-situ">${situationOptions(d)}</select></label>
      <label class="fld" id="f-situdate-row"${DATED_SITUATIONS.has(d.situation) ? '' : ' hidden'}><span>${t('f.situDate')}</span><input id="f-situdate" value="${esc(dateValue(d.situationDate))}" placeholder="${t('f.situDatePlaceholder')}"></label>
    </div>

    <div class="gt">${t('parents')}</div>
    <div class="row2">
      <label class="fld"><span>${t('father')}</span><select id="f-father"><option value="">${t('f.fatherUnknown')}</option>${personOptions(d.fatherId, self)}</select></label>
      <label class="fld"><span>${t('mother')}</span><select id="f-mother"><option value="">${t('f.motherUnknown')}</option>${personOptions(d.motherId, self)}</select></label>
    </div>

    <div class="gt"><b>×</b>${t('unions')}</div>
    ${unionRows}
    ${isMinor(d, undefined, UNION_AGE) ? '' : `<div class="fld pick">
      <span id="f-spouse-lbl">${t('f.addUnion')}</span>
      <input id="f-spouse" aria-labelledby="f-spouse-lbl" type="search" placeholder="${t('f.addUnionPlaceholder')}" autocomplete="off" spellcheck="false"
        role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="f-spouseList">
      <ul class="find-list" id="f-spouseList" role="listbox" aria-label="${t('find.list')}" hidden></ul>
    </div>`}
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
      ${e.id ? `<button class="btn quiet f-del" type="button" data-act="form-delete-ask">${t('delete')}</button>` : ''}
    </div>
    ${e.id ? `<div class="confirm" id="f-delconfirm" hidden><p>${esc(t('deleteAsk', fullName(P(e.id))))}</p>`
      + `<button class="btn danger" type="button" data-act="delete-yes" data-id="${esc(e.id)}">${t('delete')}</button>`
      + `<button class="btn" type="button" data-act="form-delete-no">${t('cancel')}</button></div>` : ''}
    ${['hamlet', 'city'].map((k) => `<datalist id="dl-place-${k}">${[...parts[k]].sort().map((x) => `<option value="${esc(x)}"></option>`).join('')}</datalist>`).join('')}
    <datalist id="dl-place-country">${COUNTRIES.map(([fr, en]) => `<option value="${esc(getLang() === 'en' ? en : fr)}"></option>`).join('')}</datalist>
    <datalist id="dl-place-dept">${[...parts.dept].filter((x) => !departmentName(x)).sort().map((x) => `<option value="${esc(x)}"></option>`).join('')}${Object.entries(DEPARTMENTS).map(([code, name]) => `<option value="${code}" label="${esc(name)}"></option>`).join('')}</datalist>
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
  // Date affichée en toutes lettres (dateValue) : la saisie d'origine reste si elle désigne le même jour
  const date = (id, before) => {
    const v = value(id);
    return dateValue(v) === dateValue(before) ? before : v;
  };
  d.given = value('f-given');
  d.surname = value('f-surname');
  d.maidenName = value('f-maiden');
  d.birthDate = date('f-bdate', d.birthDate);
  d.birthPlace = placeValue('f-bplace');
  d.deathDate = date('f-ddate', d.deathDate);
  d.deathPlace = placeValue('f-dplace');
  d.occupation = value('f-occ');
  d.situation = value('f-situ');
  d.situationDate = date('f-situdate', d.situationDate);
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
      u.date = date('u-date-' + i, u.date);
      u.place = placeValue('u-place-' + i);
      u.type = document.getElementById('u-type-' + i).value;
      u.end = document.getElementById('u-end-' + i).value;
      u.endDate = date('u-enddate-' + i, u.endDate);
      u.cause = value('u-cause-' + i);
      u.formerId = value('u-former-' + i);
    }
  });
  e.events.forEach((x, i) => {
    if (x.removed || !document.getElementById('ev-date-' + i)) return;
    x.type = value('ev-type-' + i);
    x.date = date('ev-date-' + i, x.date);
    x.place = placeValue('ev-place-' + i);
    x.note = value('ev-note-' + i);
  });
  e.media.forEach((x, i) => {
    if (x.removed || !document.getElementById('med-title-' + i)) return;
    x.title = value('med-title-' + i);
    x.date = date('med-date-' + i, x.date);
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
