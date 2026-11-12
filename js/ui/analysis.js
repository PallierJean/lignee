/** "Analysis" tab: kinship, consistency, statistics, anniversaries. */
import { S } from '../state.js';
import { $, esc, setHTML } from '../utils/dom.js';
import { t, getLang } from '../i18n.js';
import { P, fullName, lifeYears, eventLabel, allMedia, sourcesOf, factLabel, photoSrc, SOURCE_KINDS, surname, maiden, given } from '../model/people.js';
import { relationship } from '../model/kinship.js';
import { currentIssues } from '../model/checks.js';
import { treeStats } from '../model/stats.js';
import { datesOfDay, datesOfMonth } from '../model/ephemerides.js';
import { findDuplicates } from '../model/duplicates.js';
import { ignoredPairs } from '../services/dup-ignore.js';
import { timelineOf } from '../model/timeline.js';
import { personOptions, placeFields, placeValue } from './form.js';
import { mapView, locateMissing } from './places.js';
import { placesByDepartment, parsePlace } from '../model/places.js';
import {
  loadCommunes, communesLoaded, placeDepartmentIssue, departmentsText, loadCommuneChanges, communeChangesLoaded, currentCommune,
  officialCommune, cityDepartments,
} from '../model/communes.js';
import { mediaGrid, addMediaTile } from './record.js';
import { readLink, readText, unread, batchState } from './reading.js';
import { toast } from './toast.js';
import { downloadBlob, fileBase } from './transfer.js';
import { buildActsCsv } from '../services/csv.js';
import { findTownHall, townHallSearchUrl, findArchives, archivesSearchUrl } from '../services/town-hall.js';
import { departmentName } from '../model/departments.js';
import { CC_KEY } from '../config.js';
import { sleep, norm } from '../utils/helpers.js';
import { longDate, dateParts } from '../utils/dates.js';
import {
  inseeQuery, inseeSignature, deathDifferences, actDateText, actPlace, deathActsByCommune, recordDeathAct, hasDeathDocument,
} from '../model/insee.js';
import {
  inseeAvailable, inseePending, inseeResults, inseeMatch, checkInsee, forgetInsee, inseeStatus, inseeRegister, inseeAuth,
} from '../services/insee.js';
import { sourcesOfPerson } from '../model/sources.js';

const VIEWS = [['kin', 'an.kin'], ['checks', 'an.checks'], ['dups', 'an.dups'], ['insee', 'an.insee'], ['acts', 'an.acts'], ['stats', 'an.stats'],
  ['cal', 'an.cal'], ['time', 'an.time'], ['places', 'an.places'], ['map', 'an.map'], ['gallery', 'an.gallery'], ['sources', 'an.sources']];

const name = (id) => esc(fullName(P(id)));
const decimal = (x) => t('decimal', x.toFixed(1));

/** Button to a person: their record opens in a dialog, the list stays in place. */
const personLink = (id) => `<button class="link" type="button" data-act="person-open" data-id="${esc(id)}">${name(id)}</button>`;

/* ---------- Kinship ---------- */

function kinResult() {
  const { kinA: a, kinB: b } = S;
  if (!P(a) || !P(b)) return `<p class="nofocus">${t('kin.hint')}</p>`;
  const r = relationship(a, b);
  const sex = P(a).sex;
  let text = t('kin.none');
  let extra = '';
  if (r.type === 'same') text = t('kin.same');
  if (r.type === 'spouse') text = t('kin.spouse', name(a), name(b), sex);
  if (r.type === 'blood') {
    text = t('kin.is', name(a), t('kin.term', r.da, r.db, sex, r.half), name(b), sex);
    const names = r.ancestors.map(name).join(' × ');
    extra = `<p>${t('kin.ancestors', names, r.ancestors.length)}</p>`
      + (r.da && r.db ? `<p class="hint">${t('kin.gens', r.da, r.db)}</p>` : '');
  }
  if (r.type === 'alliance') {
    const viaSex = P(r.via).sex;
    const { da, db, half } = r.blood;
    text = r.viaSide === 'a'
      ? t('kin.viaA', name(a), name(r.via), name(b), t('kin.term', da, db, viaSex, half), sex, viaSex)
      : t('kin.viaB', name(a), name(r.via), name(b), t('kin.term', da, db, sex, half), sex, viaSex);
    extra = `<p class="hint">${t('kin.alliance')}</p>`;
  }
  const button = r.path.length > 1 && !S.kinShow
    ? `<button class="btn small" type="button" data-act="kin-show">${t('kin.show')}</button>` : '';
  const hide = S.kinShow ? `<button class="btn small" type="button" data-act="kin-hide">${t('kin.hide')}</button>` : '';
  return `<div class="kin-result"><p class="kin-text">${text}</p>${extra}`
    + (button || hide ? `<div class="row-btns">${button}${hide}</div>` : '') + '</div>';
}

function kinView() {
  const select = (id, label, value) => `<label class="fld"><span>${t(label)}</span>`
    + `<select id="${id}"><option value="">${t('kin.pick')}</option>${personOptions(value)}</select></label>`;
  return `<div class="an-form">${select('kinA', 'kin.first', S.kinA)}${select('kinB', 'kin.second', S.kinB)}</div>${kinResult()}`;
}

/* ---------- Consistency ---------- */

function issueHTML(x) {
  const names = x.code === 'cycle' ? x.ids.map(name).join(' → ') : name(x.ids[0]);
  const other = x.ids[1] && x.code !== 'cycle' ? name(x.ids[1]) : '';
  const detail = x.n && x.n.type ? eventLabel(x.n) : x.n;
  return `<li class="chk ${x.level}"><p>${t('chk.' + x.code, names, other, typeof detail === 'string' ? esc(detail) : detail)}</p>`
    + `<div class="chk-people">${x.ids.map(personLink).join('')}</div></li>`;
}

function checksView() {
  const issues = currentIssues();
  if (!issues.length) return `<p class="okmsg an-ok">✓ ${t('chk.none')}</p><p class="hint an-hint">${t('chk.scope')}</p>`;
  const part = (level, sym) => {
    const list = issues.filter((x) => x.level === level);
    return list.length
      ? `<section class="rel"><h3><span aria-hidden="true">${sym}</span> ${t('chk.' + level)} <span class="n">${list.length}</span></h3>`
        + `<ul class="chks">${list.map(issueHTML).join('')}</ul></section>`
      : '';
  };
  return part('error', '✕') + part('warn', '!') + `<p class="hint an-hint">${t('chk.scope')}</p>`;
}

/* ---------- Places ---------- */

/** Places cited, by department, city and locality, with their usage count; each is fixed everywhere at once. */
function placesView() {
  const uses = placesByDepartment();
  if (!uses.length) return `<p class="nofocus">${t('map.empty')}</p>`;
  if (!communesLoaded()) loadCommunes().then(renderAnalysis); // cities' departments, then redraw
  const rows = uses.map((u, i) => {
    // Department contradicting the city: flagged, and already fixed in the fields when the city is unique
    const issue = placeDepartmentIssue(u.name);
    const city = parsePlace(u.name).city;
    const warn = issue ? `<p class="hint">${esc(issue.fixed ? t('pl.deptFix', city, departmentsText(issue.expected)) : t('pl.deptConflict', city, departmentsText(issue.expected)))}</p>` : '';
    return `<li class="chk place-row${issue ? ' warn' : ''}"><p><b>${esc(u.name)}</b> <span class="n">${t('pl.uses', u.n)}</span></p>${warn}`
    + (S.canWrite
      ? `${placeFields('pl-' + i, (issue && issue.fixed) || u.name)}<div class="row-btns"><button class="btn small" type="button" data-act="place-rename" data-i="${i}" data-from="${esc(u.name)}">${t('pl.rename')}</button></div>`
      : '') + '</li>';
  }).join('');
  return `<p class="hint an-hint">${t('pl.hint')}</p><ul class="chks">${rows}</ul>`;
}

/** New text entered for the place on row `i`. */
export const placeRowValue = (i) => placeValue('pl-' + i);

/* ---------- INSEE deaths ---------- */

let inseeBusy = null; // { done, total } during a check

const actDay = (s) => esc(longDate(actDateText(s)));

/** A record on one line: first names, surname, birth, death, number. */
function actLine(a) {
  const where = (l) => esc(actPlace(l));
  return t('ins.act', esc(a.first.join(' ')), esc(a.last), actDay(a.birthDate), where(a.birth), actDay(a.deathDate), where(a.death), esc(a.certificate));
}

function diffLine(id, x, k) {
  const shown = (v) => (x.field.endsWith('Date') ? esc(longDate(v)) : esc(v));
  // Full first names are added to the record's: nothing to strike out
  const values = x.field === 'deceased' ? ''
    : `${x.tree && x.field !== 'given' ? `<s>${shown(x.tree)}</s> → ` : ''}<b>${shown(x.insee)}</b>`;
  const apply = x.patch && S.canWrite
    ? ` <button class="btn small" type="button" data-act="insee-apply" data-id="${esc(id)}" data-i="${k}">${t('ins.apply')}</button>` : '';
  return `<li>${t('ins.f.' + x.field)}${values ? ' : ' + values : ''}${apply}</li>`;
}

function inseeRow(id, m, diffs) {
  const p = P(id);
  const level = `<span class="n">${t('ins.' + m.level)}${m.others ? ' · ' + t('ins.others', m.others) : ''}</span>`;
  const all = S.canWrite && diffs.filter((x) => x.patch).length > 1
    ? `<button class="btn small" type="button" data-act="insee-apply" data-id="${esc(id)}">${t('ins.applyAll')}</button>` : '';
  // Lead: the user can confirm it, its differences then become reportable
  const confirm = m.level === 'lead'
    ? `<button class="btn small" type="button" data-act="insee-confirm" data-id="${esc(id)}">${t('ins.confirm', p.sex === 'F')}</button>` : '';
  return `<li class="chk${diffs.some((x) => x.kind === 'fix') ? '' : ' info'}"><p>${personLink(id)} <small>${esc(lifeYears(p))}</small> ${level}</p>`
    + (diffs.length ? `<ul class="ins-diffs">${diffs.map((x, k) => diffLine(id, x, k)).join('')}</ul>` : '')
    + `<p class="hint">${actLine(m.act)}</p>`
    + `<div class="row-btns">${confirm}${all}<button class="btn small quiet" type="button" data-act="insee-ignore" data-id="${esc(id)}">${t('ins.ignore')}</button></div></li>`;
}

/** Feature of the local version: matchID refuses calls coming from a web page. */
const inseeLocal = () => `<section class="rel ins-local"><h3>${t('ins.localTitle')}</h3><p>${t('ins.localWhat')}</p>`
  + `<ol class="ins-steps">${t('ins.localSteps').map((x) => `<li>${x}</li>`).join('')}</ol>`
  + `<p class="hint an-hint">${t('ins.localWhy')}</p></section>`;

function inseeView() {
  if (!inseeAvailable()) return inseeLocal();
  const pending = inseePending();
  const results = inseeResults();
  const groups = { fix: [], add: [], leads: [] };
  const same = []; // matching records: full civil-registry first names and record number, for reference
  for (const id of S.people.keys()) {
    const entry = results[id];
    if (!entry || entry.ignored || entry.sig !== inseeSignature(inseeQuery(id))) continue;
    const m = inseeMatch(id);
    if (!m) continue;
    const diffs = m.level === 'lead' ? [] : deathDifferences(id, m.act);
    if (m.level === 'lead') groups.leads.push(inseeRow(id, m, diffs));
    else if (diffs.some((x) => x.kind === 'fix')) groups.fix.push(inseeRow(id, m, diffs));
    else if (diffs.some((x) => x.patch)) groups.add.push(inseeRow(id, m, diffs));
    else same.push(`<li>${personLink(id)} <small>${esc(lifeYears(P(id)))}</small><br><small class="hint">${actLine(m.act)}</small></li>`);
  }
  let html = `<p class="hint an-hint">${t('ins.scope')}</p>` + loginBlock();
  if (inseeBusy) html += `<p class="hint an-hint">${t('ins.progress', inseeBusy.done, inseeBusy.total)}</p>`;
  else if (pending.length) html += `<div class="row-btns reg-tools"><button class="btn small" type="button" data-act="insee-check">${t('ins.check', pending.length)}</button></div>`;
  html += `<p class="hint an-hint">${t('ins.privacy')}</p>`;
  const part = (key, sym) => (groups[key].length
    ? `<section class="rel"><h3><span aria-hidden="true">${sym}</span> ${t('ins.' + key)} <span class="n">${groups[key].length}</span></h3><ul class="chks">${groups[key].join('')}</ul></section>` : '');
  html += part('fix', '!') + part('add', '+') + part('leads', '?');
  if (same.length) html += `<details class="ins-same"><summary class="okmsg">✓ ${t('ins.same', same.length)}</summary><ul class="ins-diffs">${same.join('')}</ul></details>`;
  if (Object.keys(results).length && !inseeBusy) {
    html += `<div class="row-btns reg-tools"><button class="btn small quiet" type="button" data-act="insee-forget">${t('ins.forget')}</button></div>`;
  }
  return html;
}

/* ---------- Death certificates to request ---------- */

/** Records verified by INSEE (sure, likely or confirmed) with a certificate number, grouped by town of death. */
function actGroups() {
  const results = inseeResults();
  const rows = [];
  for (const id of S.people.keys()) {
    if (hasDeathDocument(P(id))) continue; // certificate already in hand
    const entry = results[id];
    if (!entry || entry.ignored || entry.sig !== inseeSignature(inseeQuery(id))) continue;
    const m = inseeMatch(id);
    if (m && m.level !== 'lead' && m.act.certificate) rows.push({ id, act: m.act });
  }
  // Deaths before 1970, which INSEE can't have: from the records, without a number
  const unique = (city) => {
    const depts = cityDepartments(city);
    return depts.length === 1 ? depts[0] : '';
  };
  const known = new Set(rows.map((r) => r.id));
  for (const [id, p] of S.people) {
    const act = !known.has(id) && !hasDeathDocument(p) && recordDeathAct(p, unique);
    if (act) rows.push({ id, act });
  }
  return deathActsByCommune(rows, (death) => currentCommune(death.city, death.dept));
}

/** A certificate in plain text, as written in a request to the town hall; `former`: town of death if since merged. */
const bornOf = (a) => longDate(a.record ? a.birthText : actDateText(a.birthDate));
const diedOf = (a) => longDate(a.record ? a.deathText : actDateText(a.deathDate));
/** "le 05 Juin 1940", or "en 1930" / "en Mars 1930" when the day isn't known (record dates). */
const onDate = (text) => (text ? t(dateParts(text) && dateParts(text).d ? 'acts.on' : 'acts.in', longDate(text)) : '');
const actRequestLine = (a, former) => (a.record
  ? t('acts.lineOld', a.last, a.first.join(' '), onDate(a.birthText), onDate(a.deathText), former, a.married)
  : t('acts.line', a.last, a.first.join(' '), bornOf(a), diedOf(a), a.certificate, former));

/** Who receives group `g`'s request: its town hall, or its department's archives (deaths before 1800). */
const groupTitle = (g) => (g.archives ? t('acts.archivesOf', g.place) : g.place || t('acts.unknown'));
/** Key of group `g` among the contacts looked up: a department's archives aren't a town named like it. */
const hallKey = (g) => (g.archives ? 'archives|' : '') + g.place;
/** Whether the directory can be searched for group `g`'s recipient. */
const canLookUp = (g) => g.archives || Boolean(g.city && g.dept);
/** Directory search page for group `g`'s recipient, when it isn't found automatically. */
const searchUrl = (g, found) => (g.archives ? archivesSearchUrl(departmentName(g.dept)) : townHallSearchUrl(found.city || g.city));

function actsView() {
  if (!inseeAvailable()) return inseeLocal();
  if (!communeChangesLoaded()) loadCommuneChanges().then(renderAnalysis); // today's communes, then redraw
  if (!communesLoaded()) loadCommunes().then(renderAnalysis); // departments of places written without one
  const groups = actGroups();
  const obtained = [...S.people.values()].filter(hasDeathDocument).length;
  const obtainedHint = obtained ? `<p class="hint an-hint">${t('acts.obtained', obtained)}</p>` : '';
  if (!groups.length) return `<p class="nofocus">${t('acts.none')}</p>${obtainedHint}`;
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  const old = groups.reduce((n, g) => n + g.rows.filter((r) => r.act.record).length, 0);
  const archives = groups.filter((g) => g.archives);
  return `<p class="hint an-hint">${t('acts.hint', total, groups.length - archives.length)}</p>`
    + (old ? `<p class="hint an-hint">${t('acts.oldHint', old)}</p>` : '')
    + obtainedHint
    + (archives.length ? `<p class="hint an-hint">${t('acts.archivesHint', archives.reduce((n, g) => n + g.rows.length, 0), archives.length)}</p>` : '')
    + `<label class="fld acts-cc"><span>${t('acts.cc')}</span><input type="email" id="actsCc" autocomplete="email" value="${esc(ccEmail())}" placeholder="${t('acts.ccPlaceholder')}"></label>`
    + `<p class="hint an-hint">${t('acts.ccHint')}</p>`
    + `<div class="row-btns reg-tools"><button class="btn small" type="button" data-act="acts-copy">${t('acts.copyAll')}</button>`
    + (hallsToFind(groups).length && !hallsBusy ? `<button class="btn small primary" type="button" data-act="acts-halls">${t('acts.findAll')}</button>` : '')
    + `<button class="btn small" type="button" data-act="acts-csv">${t('acts.csv')}</button></div>`
    + (hallsBusy ? `<p class="hint an-hint">${t('acts.hallsProgress', hallsBusy.done, hallsBusy.total)}</p>` : '')
    + readyBlock(groups)
    + groups.map((g, i) => {
      const rows = g.rows.map(({ id, act, former }) => `<li>${personLink(id)} <small>${act.record
        ? t('acts.rowOld', esc(onDate(act.deathText)), esc(former)) : t('acts.row', actDay(act.deathDate), esc(act.certificate), esc(former))}</small></li>`).join('');
      return `<section class="rel acts-town"><h3>${esc(groupTitle(g))} <span class="n">${g.rows.length}</span></h3>`
        + (g.former.length ? `<p class="hint an-hint">${t('acts.former', esc(g.former.join(', ')))}</p>` : '')
        + `<ul class="ins-diffs">${rows}</ul>`
        + `<div class="row-btns"><button class="btn small" type="button" data-act="acts-copy" data-i="${i}">${t('acts.copy')}</button>`
        + (canLookUp(g) && !halls.has(hallKey(g)) ? `<button class="btn small" type="button" data-act="acts-hall" data-i="${i}">${t(g.archives ? 'acts.findArchives' : 'acts.findHall')}</button>` : '')
        + `</div>${hallBlock(g)}</section>`;
    }).join('');
}

/* Town halls looked up in the service-public.fr directory: place -> { busy } | { hall } | { none } | { error } */
const halls = new Map();
const HALL_PAUSE = 300; // ms between two directory searches, to stay a light user

const EMAIL = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;

/** The user's address, copied on every request (kept in this browser), or ''. */
function ccEmail() {
  try {
    const cc = localStorage.getItem(CC_KEY) || '';
    return EMAIL.test(cc) ? cc : '';
  } catch (e) {
    return '';
  }
}

/** Saves the address to copy on requests; an empty field forgets it. */
export function setActsCc(value) {
  const cc = String(value || '').trim();
  if (cc && !EMAIL.test(cc)) {
    toast(t('acts.ccInvalid'), true);
    return;
  }
  try {
    if (cc) localStorage.setItem(CC_KEY, cc);
    else localStorage.removeItem(CC_KEY);
  } catch (e) {
    /* storage unavailable: the address only lasts until the page is reloaded */
  }
  renderAnalysis();
}

/** Prefilled e-mail asking the town hall or archives of group `g` for its certificates, with the user's address in copy. */
function mailTo(email, g) {
  const lines = g.rows.map(({ act, former }) => '- ' + actRequestLine(act, former)).join('\n');
  const body = (g.archives ? t('acts.mailBodyArchives', g.place, lines) : t('acts.mailBody', g.place, lines, g.rows.some((r) => r.act.record))).replace(/\n/g, '\r\n');
  const subject = t(g.archives ? 'acts.mailSubjectArchives' : 'acts.mailSubject');
  const cc = ccEmail();
  return `mailto:${email}?subject=${encodeURIComponent(subject)}${cc ? '&cc=' + encodeURIComponent(cc) : ''}&body=${encodeURIComponent(body)}`;
}

/** What was found for the town hall of group `g`: contact details and prefilled e-mail. */
function hallBlock(g) {
  const found = halls.get(hallKey(g));
  if (!found) return '';
  if (found.busy) return `<p class="hint an-hint">${t('acts.hallBusy')}</p>`;
  const search = `<a href="${esc(searchUrl(g, found))}" target="_blank" rel="noopener noreferrer">${t('acts.hallSearch')}</a>`;
  if (found.error) return `<p class="hint an-hint">${t('acts.hallError')} ${search}</p>`;
  if (found.none) return `<p class="hint an-hint">${t(g.archives ? 'acts.archivesNone' : 'acts.hallNone')} ${search}</p>`;
  const { hall } = found;
  const link = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  const details = [
    hall.email && esc(hall.email), hall.phone && esc(hall.phone), hall.form && link(hall.form, t('acts.hallForm')), hall.site && link(hall.site, t('acts.hallSite')),
  ].filter(Boolean).join(' · ');
  return `<p class="hint an-hint">${esc(hall.name)}${details ? ' : ' + details : ''} <small>(${t('acts.hallSource')})</small></p>`
    + (hall.email ? `<div class="row-btns"><a class="btn small primary" href="${esc(mailTo(hall.email, g))}">${t('acts.mail')}</a></div>`
      : `<p class="hint an-hint">${t('acts.hallNoEmail')}</p>`);
}

/** Looks group `g`'s town hall (or department archives) up in the service-public.fr directory and keeps what was found. */
async function lookUpHall(g) {
  const city = g.archives ? '' : officialCommune(g.city, g.dept);
  try {
    const hall = await (g.archives ? findArchives(g.dept) : findTownHall(city, g.dept));
    halls.set(hallKey(g), hall ? { hall } : { none: true, city });
  } catch (e) {
    halls.set(hallKey(g), { error: true, city });
  }
}

/** Looks up the town hall of group `i` in the service-public.fr directory, then shows how to write to it. */
export async function findActsHall(i) {
  await Promise.all([loadCommunes(), loadCommuneChanges()]);
  const g = actGroups()[i];
  if (!g || !canLookUp(g)) return;
  halls.set(hallKey(g), { busy: true });
  renderAnalysis();
  await lookUpHall(g);
  renderAnalysis();
}

let hallsBusy = null; // { done, total } while every town hall is being looked up

/** Town halls still to look up: French towns not found yet, or whose search failed. */
const hallsToFind = (groups) => groups.filter((g) => canLookUp(g) && (!halls.has(hallKey(g)) || halls.get(hallKey(g)).error));

/** One click for every request: looks up all the town halls, one after the other. */
export async function findAllActsHalls() {
  if (hallsBusy) return;
  await Promise.all([loadCommunes(), loadCommuneChanges()]);
  const todo = hallsToFind(actGroups());
  if (!todo.length) return;
  hallsBusy = { done: 0, total: todo.length };
  for (const g of todo) halls.set(hallKey(g), { busy: true });
  renderAnalysis();
  for (const g of todo) {
    await lookUpHall(g);
    hallsBusy.done++;
    renderAnalysis();
    await sleep(HALL_PAUSE);
  }
  hallsBusy = null;
  renderAnalysis();
}

/** Requests ready to send: one link per town hall found with an e-mail; the others to do by hand. */
function readyBlock(groups) {
  const ready = [];
  const manual = [];
  for (const g of groups) {
    const found = halls.get(hallKey(g));
    if (!found || found.busy) continue;
    if (found.hall && found.hall.email) {
      ready.push(`<li><a href="${esc(mailTo(found.hall.email, g))}">${t(g.archives ? 'acts.writeToArchives' : 'acts.writeTo', esc(g.place))}</a> <small>${t('acts.count', g.rows.length)}</small></li>`);
    } else {
      // No e-mail: the town's contact form, its website, or else a search of the directory
      const hall = found.hall || {};
      const [url, label] = hall.form ? [hall.form, t('acts.hallForm')] : hall.site ? [hall.site, t('acts.hallSite')]
        : [searchUrl(g, found), t('acts.hallSearch')];
      manual.push(`<li>${esc(groupTitle(g))} : <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a> <small>${t('acts.count', g.rows.length)}</small></li>`);
    }
  }
  if (!ready.length && !manual.length) return '';
  return `<section class="rel acts-ready"><h3>${t('acts.ready')} <span class="n">${ready.length}</span></h3>`
    + (ready.length ? `<p class="hint an-hint">${t('acts.readyHint')}</p><ul class="ins-diffs">${ready.join('')}</ul>` : '')
    + (manual.length ? `<p class="hint an-hint">${t('acts.manual')}</p><ul class="ins-diffs">${manual.join('')}</ul>` : '')
    + '</section>';
}

/** Forgets the town halls found (tests). */
export const resetActsHalls = () => {
  halls.clear();
  hallsBusy = null;
};

/** A town's list: its town hall, then one line per certificate. */
const townText = (g) => [g.archives ? groupTitle(g) : t('acts.townHall', g.place || t('acts.unknown')), ...g.rows.map(({ act, former }) => '- ' + actRequestLine(act, former))].join('\n');

/**
 * Copies the list of town `i`, ready to paste into a request to its town hall; without `i`,
 * the lists of every town, one after the other.
 */
export async function copyActs(i) {
  await Promise.all([loadCommunes(), loadCommuneChanges()]);
  const groups = actGroups();
  const chosen = i === undefined ? groups : groups.slice(i, i + 1);
  if (!chosen.length) return;
  try {
    await navigator.clipboard.writeText(chosen.map(townText).join('\n\n'));
    toast(i === undefined ? t('acts.copiedAll', groups.length) : t('acts.copied', groupTitle(chosen[0])));
  } catch (e) {
    toast(t('acts.copyFailed'), true);
  }
}

/** Downloads every certificate to request as a CSV file, for a spreadsheet. */
export async function exportActsCsv() {
  await Promise.all([loadCommunes(), loadCommuneChanges()]);
  const groups = actGroups();
  if (!groups.length) return;
  const name = `${fileBase()}-${t('acts.fileSuffix')}.csv`;
  downloadBlob(name, buildActsCsv(groups, { born: bornOf, died: diedOf }), 'text/csv;charset=utf-8');
  toast(t('acts.saved', name));
}

/** Checks new or modified records, then redraws the view. */
export async function startInsee() {
  if (inseeBusy) return;
  const people = inseePending();
  if (!people.length) return;
  inseeBusy = { done: 0, total: people.length };
  renderAnalysis();
  try {
    await checkInsee(people, (done, total) => {
      inseeBusy = { done, total };
      if (S.tab === 'analysis' && S.analysis === 'insee') renderAnalysis();
    });
  } catch (e) {
    if (e.login) login = { ...login, needed: true };
    toast(e.login ? t('ins.loginNeeded') : t('ins.failed', e.message), true);
  }
  inseeBusy = null;
  renderAnalysis();
}

/* Signing in to matchID: without an account, it only accepts a few searches */

let login = { status: null, asked: false, needed: false, email: '', sent: false, busy: false };

/** Sign-in block: connection status, or address then code received by e-mail. */
function loginBlock() {
  if (!login.asked) {
    login.asked = true;
    inseeStatus().then((s) => {
      login.status = s;
      if (S.tab === 'analysis' && S.analysis === 'insee') renderAnalysis();
    }, () => {});
  }
  const s = login.status;
  if (s && s.connected) {
    return `<p class="hint an-hint">${t('ins.connected', esc(s.user), s.expires ? esc(new Date(s.expires).toLocaleDateString(t('locale'))) : '')}</p>`;
  }
  if (!s && !login.needed) return '';
  const off = login.busy ? ' disabled' : '';
  const form = login.sent
    ? `<label class="fld"><span>${t('ins.code', esc(login.email))}</span><input id="insCode" autocomplete="one-time-code" inputmode="text"${off}></label>`
      + `<div class="row-btns"><button class="btn small" type="button" data-act="insee-auth"${off}>${t('ins.validate')}</button>`
      + `<button class="btn small quiet" type="button" data-act="insee-restart-login"${off}>${t('ins.otherEmail')}</button></div>`
    : `<label class="fld"><span>${t('ins.email')}</span><input id="insEmail" type="email" autocomplete="email" value="${esc(login.email)}"${off}></label>`
      + `<div class="row-btns"><button class="btn small" type="button" data-act="insee-register"${off}>${t('ins.sendCode')}</button></div>`;
  return `<section class="rel ins-login${login.needed ? ' warn' : ''}"><h3>${t('ins.loginTitle')}</h3><p class="hint an-hint">${t('ins.loginHint')}</p>${form}</section>`;
}

async function loginStep(run) {
  login.busy = true;
  renderAnalysis();
  try {
    await run();
  } catch (e) {
    toast(t('ins.loginFailed', e.message), true);
  }
  login.busy = false;
  renderAnalysis();
}

/** Asks matchID to send a code to the address entered. */
export function inseeSendCode() {
  const email = String(($('#insEmail') || {}).value || '').trim();
  if (!email) return;
  return loginStep(async () => {
    await inseeRegister(email);
    login = { ...login, email, sent: true };
    toast(t('ins.codeSent', email));
  });
}

/** Validates the code received: the check can resume. */
export function inseeSendAuth() {
  const code = String(($('#insCode') || {}).value || '').trim();
  if (!code) return;
  return loginStep(async () => {
    login.status = await inseeAuth(login.email, code);
    login = { ...login, needed: false, sent: false };
    toast(t('ins.loggedIn'));
  });
}

/** Goes back to entering the address. */
export function inseeOtherEmail() {
  login = { ...login, sent: false };
  renderAnalysis();
}

/** Forgets the checks: every record will be checked again. */
export function restartInsee() {
  forgetInsee();
  renderAnalysis();
}

/* ---------- Statistics ---------- */

function bars(rows) {
  const max = Math.max(...rows.map((r) => r.n), 1);
  return '<div class="bars">' + rows.map((r) => '<div class="bar-row">'
    + `<span class="bl" title="${esc(r.name)}">${esc(r.name)}</span>`
    + `<span class="bt"><i data-style="width:${(r.n / max) * 100}%"></i></span><span class="bv">${r.n}</span></div>`).join('') + '</div>';
}

function statsView() {
  const st = treeStats();
  const fact = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  const overview = [
    [t('stat.people'), st.people], [t('stat.unions'), st.unions], [t('stat.men'), st.sexes.M], [t('stat.women'), st.sexes.F],
    ...(st.sexes.U ? [[t('stat.unknown'), st.sexes.U]] : []), [t('stat.living'), st.living],
  ];
  const long = st.longevity;
  const longRows = [[t('stat.longAll'), long.all], [t('stat.men'), long.M], [t('stat.women'), long.F]]
    .filter(([, v]) => v !== null).map(([label, v]) => fact(label, t('about', decimal(v))));

  let html = `<section class="rel"><h3>${t('stat.overview')}</h3><dl class="facts">${overview.map(([a, b]) => fact(a, b)).join('')}</dl></section>`;
  if (st.surnames.length) html += `<section class="rel"><h3>${t('stat.surnames')}</h3>${bars(st.surnames)}</section>`;
  if (st.places.length) html += `<section class="rel"><h3>${t('stat.places')}</h3>${bars(st.places)}</section>`;
  html += `<section class="rel"><h3>${t('stat.longevity')}</h3>`
    + (long.n
      ? `<dl class="facts">${longRows.join('')}</dl><p class="hint an-hint">${t('stat.longN', long.n)}<br>${t('stat.oldest', personLink(long.oldest.id), long.oldest.age)}</p>`
      : `<p class="unknown">${t('stat.noLong')}</p>`) + '</section>';
  html += `<section class="rel"><h3>${t('stat.gens')}</h3><dl class="facts">`
    + st.generations.map((g) => fact(t('stat.gen', g.gen), t('stat.genLine', g.people, g.parents ? decimal(g.children / g.parents) : ''))).join('')
    + `</dl><p class="hint an-hint">${t('stat.gensHint')}</p></section>`;
  if (st.completeness.length) {
    html += `<section class="rel"><h3>${t('stat.complete')}</h3><div class="bars">`
      + st.completeness.map((r) => `<div class="bar-row"><span class="bl">${t('stat.gen', r.gen)}</span>`
        + `<span class="bt" title="${t('percent', Math.round(r.pct * 10) / 10)}"><i data-style="width:${r.pct}%"></i></span>`
        + `<span class="bv">${t('stat.completeRow', r.found, r.expected)}</span></div>`).join('')
      + `</div><p class="hint an-hint">${t('stat.completeHint', name(S.focus))}</p></section>`;
  }
  return html;
}

/* ---------- Anniversaries ---------- */

const SYMBOLS = { birth: '°', union: '×', death: '†' };

function dateRow(x, withDay) {
  const year = new Date().getFullYear();
  const ago = year - x.y > 0 ? t('cal.ago', year - x.y) : '';
  const day = withDay ? `<span class="cal-day">${x.d || '—'}</span>` : '';
  const who = x.ids.map(name).join(' × ');
  return `<button class="reg-row cal-row" type="button" data-act="person-open" data-id="${esc(x.ids[0])}" title="${t('cal.' + x.kind)}${x.d ? '' : ' · ' + t('cal.noDay')}">`
    + `${day}<span class="cal-sym" aria-hidden="true">${SYMBOLS[x.kind]}</span><span class="nm">${who}</span>`
    + `<span class="y">${x.y}${ago ? ' · ' + ago : ''}</span></button>`;
}

function calView() {
  const now = new Date();
  const month = S.calMonth || now.getMonth() + 1;
  const months = t('months');
  const today = datesOfDay(now);
  const list = datesOfMonth(month);
  const title = (x) => now.toLocaleDateString(t('locale'), x);
  return `<section class="rel"><h3>${t('cal.today')} · ${esc(title({ day: 'numeric', month: 'long' }))}</h3>`
    + (today.length ? today.map((x) => dateRow(x, false)).join('') : `<p class="unknown">${t('cal.nothing')}</p>`) + '</section>'
    + '<section class="rel"><div class="cal-head">'
    + `<button class="zbtn" type="button" data-act="cal-month" data-d="-1" aria-label="${t('cal.prev')}">‹</button>`
    + `<h3>${esc(months[month - 1])}</h3>`
    + `<button class="zbtn" type="button" data-act="cal-month" data-d="1" aria-label="${t('cal.next')}">›</button></div>`
    + (list.length ? list.map((x) => dateRow(x, true)).join('') : `<p class="unknown">${t('cal.nothingMonth')}</p>`) + '</section>';
}

/* ---------- Duplicates ---------- */

function dupsView() {
  const pairs = findDuplicates(ignoredPairs());
  if (!pairs.length) return `<p class="okmsg an-ok">✓ ${t('dup.none')}</p><p class="hint an-hint">${t('dup.scope')}</p>`;
  const who = (id, n) => `<span><span class="tag-n">${n}</span> ${personLink(id)} <small>${esc(lifeYears(P(id)))}</small></span>`;
  const keep = (a, b, n) => (S.canWrite
    ? `<button class="btn small" type="button" data-act="dup-merge" data-keep="${esc(a)}" data-drop="${esc(b)}">${t('dup.keep', n)}</button>` : '');
  return `<p class="hint an-hint">${t('dup.scope')}</p><ul class="chks">` + pairs.map((x) => '<li class="chk">'
    + `<div class="dup-names">${who(x.a, 1)}${who(x.b, 2)}</div>`
    + `<p class="hint">${x.reasons.map((r) => t(r)).join(' · ')}</p>`
    + `<div class="row-btns">${keep(x.a, x.b, 1)}${keep(x.b, x.a, 2)}`
    + `<button class="btn small quiet" type="button" data-act="dup-ignore" data-key="${esc(x.key)}">${t('dup.ignore')}</button></div></li>`).join('') + '</ul>';
}

/* ---------- Timeline ---------- */

const TIME_SYMBOLS = { birth: '°', union: '×', death: '†', event: '•', history: '' };

function timeView() {
  if (!P(S.focus)) return `<p class="nofocus">${t('record.pick')}</p>`;
  const rows = timelineOf(S.focus, S.timeFamily);
  const seg = [[false, 'time.person'], [true, 'time.family']].map(([family, label]) => `<button type="button" data-act="time-scope" data-family="${family}" aria-pressed="${S.timeFamily === family}">${t(label)}</button>`).join('');
  const head = `<div class="seg an-scope" role="group">${seg}</div><p class="hint an-hint">${name(S.focus)}</p>`;
  if (!rows.length) return head + `<p class="unknown">${t('time.empty')}</p>`;
  const row = (r) => `<li class="tl ${r.kind === 'history' ? 'hist' : ''}"><span class="tl-y">${r.year}</span>`
    + `<span class="tl-s" aria-hidden="true">${TIME_SYMBOLS[r.kind]}</span>`
    + `<span class="tl-l">${r.id ? `<button class="link" type="button" data-act="person-open" data-id="${esc(r.id)}">${esc(r.label)}</button>` : esc(r.label)}</span></li>`;
  return head + `<ol class="tls">${rows.map(row).join('')}</ol>`;
}

/* ---------- Gallery ---------- */

/* ---------- Sources ---------- */

/**
 * Every document of the tree, once, with who cites it: [{ src, cites: [{ id, fact }] }], by kind
 * then title. A shared source is one entry; a record from before shared sources keeps its own.
 */
export function sourceLibrary() {
  const byKey = new Map();
  for (const [id, p] of S.people) {
    for (const x of sourcesOfPerson(id)) {
      const key = x.source || 'own:' + id + ':' + x.id;
      if (!byKey.has(key)) byKey.set(key, { src: x, cites: [] });
      byKey.get(key).cites.push({ id, fact: x.fact, role: x.role });
    }
  }
  const order = (k) => (SOURCE_KINDS.includes(k) ? SOURCE_KINDS.indexOf(k) : SOURCE_KINDS.length);
  // Within a kind, by the person cited: the name shown (surname, or else maiden name), then the
  // given name, people without a name last; then by title, numbers in order
  const nameKey = (id) => surname(P(id)) || maiden(P(id));
  const byName = (a, b) => {
    const [na, nb] = [nameKey(a.id), nameKey(b.id)];
    if (!na !== !nb) return na ? -1 : 1;
    return na.localeCompare(nb, t('locale')) || given(P(a.id)).localeCompare(given(P(b.id)), t('locale'));
  };
  const list = [...byKey.values()];
  for (const x of list) x.cites.sort(byName);
  return list.sort((a, b) => order(a.src.kind) - order(b.src.kind)
    || byName(a.cites[0], b.cites[0])
    || String(a.src.title || '').localeCompare(String(b.src.title || ''), t('locale'), { numeric: true }));
}

// Filters of the Sources view: kind ('' = all) and text (title, place, number, who cites it)
let libKind = '';
let libQuery = '';

const kindOf = (src) => (SOURCE_KINDS.includes(src.kind) ? src.kind : 'other');

function sourcesView() {
  const list = sourceLibrary();
  if (!list.length) return `<p class="nofocus">${t('lib.none')}</p>`;
  const shared = list.filter((x) => new Set(x.cites.map((c) => c.id)).size > 1).length;
  const kinds = SOURCE_KINDS.filter((k) => list.some((x) => kindOf(x.src) === k));
  // Reading on this computer every document not read yet, one after the other
  const batch = batchState();
  const todo = S.canWrite && !batch ? unread().length : 0;
  const reading = batch
    ? `<p class="rd-batch" role="status">${t('htr.batch', batch.done, batch.total)} <button class="link" type="button" data-act="read-stop">${t('htr.stop')}</button></p>`
    : todo ? `<p class="rd-batch"><button class="btn small" type="button" data-act="read-all">${t('htr.readAll', todo)}</button> <span class="hint">${t('htr.allHint')}</span></p>` : '';
  return `<p class="hint an-hint">${t('lib.hint', list.length, shared)}</p>${reading}`
    + `<div class="row2 lib-filters"><label class="fld"><span>${t('lib.kind')}</span><select id="lib-kind"><option value="">${t('lib.allKinds')}</option>`
    + kinds.map((k) => `<option value="${k}"${k === libKind ? ' selected' : ''}>${esc(t('src.' + k))}</option>`).join('') + '</select></label>'
    + `<label class="fld"><span>${t('lib.search')}</span><input id="lib-q" type="search" value="${esc(libQuery)}" placeholder="${t('lib.searchPlaceholder')}" autocomplete="off"></label></div>`
    + `<div id="libList">${libraryList(list)}</div>`;
}

/** Sets the Sources view's filters; the list alone is redrawn, the search field keeps the cursor. */
export function setLibraryFilter(kind, query) {
  if (kind !== undefined) libKind = kind;
  if (query !== undefined) libQuery = query;
  const el = document.getElementById('libList');
  if (el) el.innerHTML = libraryList(sourceLibrary());
}

/** One document of the Sources view: its thumbnail(s), what it is, and who cites it. */
function libraryItem({ src, cites }, kind) {
  const pic = photoSrc(src.photo);
  const what = [src.title, src.place, src.ref].filter(Boolean).map((x) => esc(String(x))).join(' · ') || `<span class="muted">${t('lib.untitled')}</span>`;
  const who = cites.map((c) => {
    const part = [factLabel(c.id, c.fact), c.role ? t('role.' + c.role) : ''].filter(Boolean).join(', ');
    return personLink(c.id) + (part ? ` <small>(${esc(part)})</small>` : '');
  }).join(', ');
  // The document, and its back if it has one: a click shows it full size, as on the record
  const back = pic && photoSrc(src.back);
  const name = esc(String(src.title || t('src.' + kind)));
  // Front and back share data-pair: enlarged, one switches to the other (ui/events.js)
  const pair = (side) => (back ? ` data-pair="${esc(src.source || src.id || name)}" data-side="${side}"` : '');
  const zoom = (url, label, side) => `<img class="lib-pic zoomable" src="${esc(url)}" alt="${label}" title="${t('lib.zoom')}" loading="lazy" data-act="photo-zoom"${pair(side)}>`;
  return `<li class="lib-item">${pic ? zoom(pic, name, 0) + (back ? zoom(back, `${name} (${t('med.back')})`, 1) : '') : '<span class="lib-pic none" aria-hidden="true"></span>'}`
    + `<div><p class="lib-what">${what}</p><p class="lib-who">${t('lib.citedBy')} ${who}</p>${readLink(src.source, S.sources.get(src.source))}</div></li>`;
}

/** Family a document is filed under: the name shown of the first person citing it, or '' (no name). */
const familyOf = ({ cites }) => (cites[0] ? surname(P(cites[0].id)) || maiden(P(cites[0].id)) : '');

function libraryList(all) {
  const q = norm(libQuery).trim();
  const text = ({ src, cites }) => norm([src.title, src.place, src.ref, src.note, readText(src), ...cites.map((c) => fullName(P(c.id)))].filter(Boolean).join(' '));
  const list = all.filter((x) => (!libKind || kindOf(x.src) === libKind) && (!q || text(x).includes(q)));
  if (!list.length) return `<p class="nofocus">${t('lib.noMatch')}</p>`;
  const kinds = [...new Set(list.map((x) => kindOf(x.src)))];
  return kinds.map((kind) => {
    const items = list.filter((x) => kindOf(x.src) === kind);
    // Within the kind, one group per family, its name and count above (the list is already in that order)
    const families = [...new Set(items.map(familyOf))];
    const groups = families.map((family) => {
      const members = items.filter((x) => familyOf(x) === family);
      return `<li class="lib-family"><h4>${esc(family || t('lib.noName'))} - ${t('lib.count', members.length)}</h4>`
        + `<ul class="lib-list">${members.map((x) => libraryItem(x, kind)).join('')}</ul></li>`;
    }).join('');
    return `<section class="rel lib-kind"><h3>${esc(t('src.' + kind))} <span class="n">${items.length}</span></h3><ul class="lib-families">${groups}</ul></section>`;
  }).join('');
}

/** Every image of the tree, the viewer going through them in this order as `group`. */
export function galleryHTML(group) {
  const items = allMedia();
  // First cell: add photos to the tree's gallery, identifying no one yet
  const lead = addMediaTile();
  if (!items.length) return `${lead ? mediaGrid([], group, lead) : ''}<p class="nofocus">${t('med.empty')}</p>`;
  return mediaGrid(items, group, lead);
}

const galleryView = () => galleryHTML('all');

/* ---------- Rendering ---------- */

export const startLocate = () => locateMissing(renderAnalysis);

export function renderAnalysis() {
  const count = S.people.size ? currentIssues().length : 0;
  $('#anCount').textContent = count ? String(count) : '';
  if (S.tab !== 'analysis') return;
  if (!S.people.size) {
    $('#paneAnalysis').innerHTML = `<p class="nofocus">${t('an.empty')}</p>`;
    return;
  }
  if (!S.kinA && P(S.focus)) S.kinA = S.focus;
  const seg = VIEWS.map(([view, label]) => `<button type="button" data-act="analysis-view" data-view="${view}" aria-pressed="${S.analysis === view}">${t(label)}</button>`).join('');
  const body = {
    kin: kinView, checks: checksView, places: placesView, dups: dupsView, insee: inseeView, acts: actsView, stats: statsView, cal: calView, time: timeView, map: mapView, gallery: galleryView, sources: sourcesView,
  }[S.analysis]();
  setHTML($('#paneAnalysis'), `<div class="seg an-views" role="group" aria-label="${t('an.views')}" lang="${getLang()}">${seg}</div>${body}`);
}
