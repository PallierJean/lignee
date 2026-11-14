/**
 * Fields that choose a person of the tree by searching as you type, with keyboard navigation
 * (arrows, Enter, Escape): "Add a union" in the form, the two people of the kinship view.
 * Each field `id` has its list `id + 'List'`.
 */
import { S } from '../state.js';
import { $, esc } from '../utils/dom.js';
import { P, longName, lifeYears } from '../model/people.js';
import { searchPeople } from './search.js';
import { t } from '../i18n.js';

const MAX = 12;

/** The fields: who is not suggested, and the action of a suggestion clicked. */
const FIELDS = {
  // The person and the spouses already in the form
  'f-spouse': { opt: 'sp-opt-', act: 'spouse-pick', exclude: () => {
    const e = S.edit;
    return new Set([...(e.id ? [e.id] : []), ...e.unions.filter((u) => !u.removed).map((u) => u.other)]);
  } },
  kinA: { opt: 'kinA-opt-', act: 'kin-pick', exclude: () => new Set() },
  kinB: { opt: 'kinB-opt-', act: 'kin-pick', exclude: () => new Set() },
};

// Per field: suggested ids, total found, suggestion selected with the keyboard
const state = new Map(Object.keys(FIELDS).map((id) => [id, { results: [], total: 0, active: -1 }]));

/** Is `id` one of these fields? */
export const isPersonPick = (id) => Object.hasOwn(FIELDS, id);

function renderList(id) {
  const input = $('#' + id);
  const list = $('#' + id + 'List');
  if (!input || !list) return;
  const { results, total, active } = state.get(id);
  const { opt, act } = FIELDS[id];
  const query = input.value.trim();
  const open = !!query && document.activeElement === input;
  list.hidden = !open;
  input.setAttribute('aria-expanded', String(open));
  if (!open) {
    input.removeAttribute('aria-activedescendant');
    return;
  }

  if (!results.length) {
    list.innerHTML = `<li class="find-none" role="presentation">${t('noMatch', esc(query))}</li>`;
    input.removeAttribute('aria-activedescendant');
    return;
  }

  list.innerHTML = results.map((pid, i) => {
    const p = P(pid);
    const place = p.birthPlace ? ' · ' + p.birthPlace : '';
    return `<li class="find-opt${i === active ? ' on' : ''}" role="option" id="${opt}${i}"`
      + ` aria-selected="${i === active}" data-act="${act}" data-field="${id}" data-id="${esc(pid)}">`
      + `<i class="sx ${esc(p.sex || 'U')}"></i>`
      + `<span class="fn">${esc(longName(p))}<span class="fp">${esc(place)}</span></span>`
      + `<span class="fy">${esc(lifeYears(p))}</span></li>`;
  }).join('')
    + (total > MAX
      ? `<li class="find-none" role="presentation">${t('spouse.more', total - MAX)}</li>`
      : '');
  if (active >= 0) input.setAttribute('aria-activedescendant', opt + active);
  else input.removeAttribute('aria-activedescendant');
}

/** Suggestions for what is typed in field `id`. */
export function onPickInput(id) {
  if (id === 'f-spouse' && !S.edit) return;
  const s = state.get(id);
  ({ ids: s.results, total: s.total } = searchPeople($('#' + id).value, MAX, FIELDS[id].exclude()));
  s.active = s.results.length ? 0 : -1;
  renderList(id);
}

export function closePick(id) {
  state.get(id).active = -1;
  renderList(id);
}

/** Keys in field `id`; `onPick(personId)`. Returns true if the key was handled. */
export function onPickKey(ev, id, onPick) {
  const s = state.get(id);
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    if (!s.results.length) return true;
    const step = ev.key === 'ArrowDown' ? 1 : -1;
    s.active = (s.active + step + s.results.length) % s.results.length;
    renderList(id);
    const el = document.getElementById(FIELDS[id].opt + s.active);
    if (el) el.scrollIntoView({ block: 'nearest' });
    return true;
  }
  // Enter must never save the form from this field
  if (ev.key === 'Enter') {
    if (s.active >= 0 && s.results[s.active]) onPick(s.results[s.active]);
    return true;
  }
  if (ev.key === 'Escape' && $('#' + id).value) {
    $('#' + id).value = '';
    closePick(id);
    return true;
  }
  return false;
}

// The union field, as before
export const onSpouseInput = () => onPickInput('f-spouse');
export const closeSpouse = () => closePick('f-spouse');
export const onSpouseKey = (ev, onPick) => onPickKey(ev, 'f-spouse', onPick);
