/**
 * "Add a union" field of the form: searches people in the tree
 * as you type, with keyboard navigation (arrows, Enter, Escape).
 */
import { S } from '../state.js';
import { $, esc } from '../utils/dom.js';
import { P, longName, lifeYears } from '../model/people.js';
import { searchPeople } from './search.js';
import { t } from '../i18n.js';

const MAX = 12;

let results = [];  // suggested ids
let total = 0;     // total number of people found
let active = -1;   // suggestion selected with the keyboard

/** The person and the spouses already in the form are not suggested. */
function excluded() {
  const e = S.edit;
  return new Set([...(e.id ? [e.id] : []), ...e.unions.filter((u) => !u.removed).map((u) => u.other)]);
}

function renderList() {
  const input = $('#f-spouse');
  const list = $('#f-spouseList');
  if (!input || !list) return;
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

  list.innerHTML = results.map((id, i) => {
    const p = P(id);
    const place = p.birthPlace ? ' · ' + p.birthPlace : '';
    return `<li class="find-opt${i === active ? ' on' : ''}" role="option" id="sp-opt-${i}"`
      + ` aria-selected="${i === active}" data-act="spouse-pick" data-id="${esc(id)}">`
      + `<i class="sx ${esc(p.sex || 'U')}"></i>`
      + `<span class="fn">${esc(longName(p))}<span class="fp">${esc(place)}</span></span>`
      + `<span class="fy">${esc(lifeYears(p))}</span></li>`;
  }).join('')
    + (total > MAX
      ? `<li class="find-none" role="presentation">${t('spouse.more', total - MAX)}</li>`
      : '');
  if (active >= 0) input.setAttribute('aria-activedescendant', 'sp-opt-' + active);
  else input.removeAttribute('aria-activedescendant');
}

export function onSpouseInput() {
  if (!S.edit) return;
  ({ ids: results, total } = searchPeople($('#f-spouse').value, MAX, excluded()));
  active = results.length ? 0 : -1;
  renderList();
}

export function closeSpouse() {
  active = -1;
  renderList();
}

/** Keys in the field. Returns true if the key was handled. */
export function onSpouseKey(ev, onPick) {
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    if (!results.length) return true;
    const step = ev.key === 'ArrowDown' ? 1 : -1;
    active = (active + step + results.length) % results.length;
    renderList();
    const el = document.getElementById('sp-opt-' + active);
    if (el) el.scrollIntoView({ block: 'nearest' });
    return true;
  }
  // Enter must never save the form from this field
  if (ev.key === 'Enter') {
    if (active >= 0 && results[active]) onPick(results[active]);
    return true;
  }
  if (ev.key === 'Escape' && $('#f-spouse').value) {
    $('#f-spouse').value = '';
    closeSpouse();
    return true;
  }
  return false;
}
