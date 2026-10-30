/** Onglet « Analyse » : lien de parenté, cohérence, statistiques, éphémérides. */
import { S } from '../state.js';
import { $, esc } from '../utils/dom.js';
import { t, getLang } from '../i18n.js';
import { P, fullName, lifeYears, eventLabel, allMedia } from '../model/people.js';
import { relationship } from '../model/kinship.js';
import { findIssues } from '../model/checks.js';
import { treeStats } from '../model/stats.js';
import { datesOfDay, datesOfMonth } from '../model/ephemerides.js';
import { findDuplicates } from '../model/duplicates.js';
import { timelineOf } from '../model/timeline.js';
import { personOptions } from './form.js';
import { mapView, locateMissing } from './places.js';
import { mediaGrid } from './fiche.js';

const VIEWS = [['kin', 'an.kin'], ['checks', 'an.checks'], ['dups', 'an.dups'], ['stats', 'an.stats'],
  ['cal', 'an.cal'], ['time', 'an.time'], ['map', 'an.map'], ['gallery', 'an.gallery']];

const name = (id) => esc(fullName(P(id)));
const decimal = (x) => t('decimal', x.toFixed(1));

/** Bouton vers une personne : sa fiche s'ouvre en fenêtre, la liste reste en place. */
const personLink = (id) => `<button class="link" type="button" data-act="person-open" data-id="${esc(id)}">${name(id)}</button>`;

/* ---------- Lien de parenté ---------- */

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

/* ---------- Cohérence ---------- */

function issueHTML(x) {
  const names = x.code === 'cycle' ? x.ids.map(name).join(' → ') : name(x.ids[0]);
  const other = x.ids[1] && x.code !== 'cycle' ? name(x.ids[1]) : '';
  const detail = x.n && x.n.type ? eventLabel(x.n) : x.n;
  return `<li class="chk ${x.level}"><p>${t('chk.' + x.code, names, other, typeof detail === 'string' ? esc(detail) : detail)}</p>`
    + `<div class="chk-people">${x.ids.map(personLink).join('')}</div></li>`;
}

function checksView() {
  const issues = findIssues();
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

/* ---------- Statistiques ---------- */

function bars(rows) {
  const max = Math.max(...rows.map((r) => r.n), 1);
  return '<div class="bars">' + rows.map((r) => '<div class="bar-row">'
    + `<span class="bl" title="${esc(r.name)}">${esc(r.name)}</span>`
    + `<span class="bt"><i style="width:${(r.n / max) * 100}%"></i></span><span class="bv">${r.n}</span></div>`).join('') + '</div>';
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
        + `<span class="bt" title="${t('percent', Math.round(r.pct * 10) / 10)}"><i style="width:${r.pct}%"></i></span>`
        + `<span class="bv">${t('stat.completeRow', r.found, r.expected)}</span></div>`).join('')
      + `</div><p class="hint an-hint">${t('stat.completeHint', name(S.focus))}</p></section>`;
  }
  return html;
}

/* ---------- Éphémérides ---------- */

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

/* ---------- Doublons ---------- */

function dupsView() {
  const pairs = findDuplicates(S.dupIgnored);
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

/* ---------- Frise ---------- */

const TIME_SYMBOLS = { birth: '°', union: '×', death: '†', event: '•', history: '' };

function timeView() {
  if (!P(S.focus)) return `<p class="nofocus">${t('fiche.pick')}</p>`;
  const rows = timelineOf(S.focus, S.timeFamily);
  const seg = [[false, 'time.person'], [true, 'time.family']].map(([family, label]) => `<button type="button" data-act="time-scope" data-family="${family}" aria-pressed="${S.timeFamily === family}">${t(label)}</button>`).join('');
  const head = `<div class="seg an-scope" role="group">${seg}</div><p class="hint an-hint">${name(S.focus)}</p>`;
  if (!rows.length) return head + `<p class="unknown">${t('time.empty')}</p>`;
  const row = (r) => `<li class="tl ${r.kind === 'history' ? 'hist' : ''}"><span class="tl-y">${r.year}</span>`
    + `<span class="tl-s" aria-hidden="true">${TIME_SYMBOLS[r.kind]}</span>`
    + `<span class="tl-l">${r.id ? `<button class="link" type="button" data-act="person-open" data-id="${esc(r.id)}">${esc(r.label)}</button>` : esc(r.label)}</span></li>`;
  return head + `<ol class="tls">${rows.map(row).join('')}</ol>`;
}

/* ---------- Galerie ---------- */

function galleryView() {
  const items = allMedia();
  return items.length ? mediaGrid(items) : `<p class="nofocus">${t('med.empty')}</p>`;
}

/* ---------- Rendu ---------- */

export const startLocate = () => locateMissing(renderAnalyse);

export function renderAnalyse() {
  const count = S.people.size ? findIssues().length : 0;
  $('#anCount').textContent = count ? String(count) : '';
  if (S.tab !== 'analyse') return;
  if (!S.people.size) {
    $('#paneAnalyse').innerHTML = `<p class="nofocus">${t('an.empty')}</p>`;
    return;
  }
  if (!S.kinA && P(S.focus)) S.kinA = S.focus;
  const seg = VIEWS.map(([view, label]) => `<button type="button" data-act="analyse-view" data-view="${view}" aria-pressed="${S.analyse === view}">${t(label)}</button>`).join('');
  const body = {
    kin: kinView, checks: checksView, dups: dupsView, stats: statsView, cal: calView, time: timeView, map: mapView, gallery: galleryView,
  }[S.analyse]();
  $('#paneAnalyse').innerHTML = `<div class="seg an-views" role="group" aria-label="${t('an.views')}" lang="${getLang()}">${seg}</div>${body}`;
}
