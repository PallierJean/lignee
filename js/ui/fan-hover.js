/**
 * Fan chart: hovering a sector shows a label (name, Sosa, birth, death) and the path
 * linking it to the focus person; a double-click recentres the fan on it, a double-click in the
 * centre returns to the person left. Buttons do the same: go back, or go down to a child.
 */
import { S } from '../state.js';
import { $, esc } from '../utils/dom.js';
import { longDate } from '../utils/dates.js';
import { t } from '../i18n.js';
import { P, fullName, lifeYears, descendantRows } from '../model/people.js';
import { openPersonDlg } from './person-dlg.js';

const back = [];      // focus people left by double-click, the last at the end
let opening = null;   // pending single click: a double-click cancels it

const sectorOf = (target) => (target && target.closest ? target.closest('#fan .fan-s') : null);

/** Row "° 10 septembre 1864, Lyon (69)" for a birth or a death, or ''. */
function lifeLine(sym, date, place) {
  const text = [date ? longDate(date) : '', String(place || '').trim()].filter(Boolean).join(', ');
  return text ? `<span>${sym} ${esc(text)}</span>` : '';
}

function tipHTML(id, sosa) {
  const p = P(id);
  const gen = Math.floor(Math.log2(sosa));
  const previous = back.length ? P(back[back.length - 1]) : null;
  const hint = sosa > 1 ? t('fan.center') : previous ? t('fan.back', fullName(previous)) : '';
  return `<b>${esc(fullName(p))}</b><small>${esc(t('fan.sosa', sosa, gen))}</small>`
    + lifeLine('°', p.birthDate, p.birthPlace) + lifeLine('†', p.deathDate, p.deathPlace)
    + (hint ? `<em>${esc(hint)}</em>` : '');
}

/** Places the label near point (x, y), without leaving the window. */
function placeTip(x, y) {
  const tip = $('#fanTip');
  const left = x + 16 + tip.offsetWidth > window.innerWidth - 8 ? x - 16 - tip.offsetWidth : x + 16;
  const top = Math.min(y + 16, window.innerHeight - 8 - tip.offsetHeight);
  tip.style.left = `${Math.max(8, left)}px`;
  tip.style.top = `${Math.max(8, top)}px`;
}

function clear() {
  $('#fanTip').hidden = true;
  const fan = $('#fan');
  fan.classList.remove('trace');
  for (const x of fan.querySelectorAll('.fan-s.on')) x.classList.remove('on');
}

/**
 * Hover (or focus) of a sector: label and path to the centre (Sosa numbers n, n/2… 1).
 * `ev` gives the mouse position; with the keyboard, the label is placed on the sector.
 */
export function fanHover(target, on, ev) {
  const sector = sectorOf(target);
  if (!on) {
    // Moving from one element to another of the same sector (shape, text): nothing changes
    if (sector && ev && ev.relatedTarget && sector.contains(ev.relatedTarget)) return;
    if (sector) clear();
    return;
  }
  if (!sector || !P(sector.dataset.id)) return;
  const sosa = Number(sector.dataset.sosa);
  const path = new Set();
  for (let n = sosa; n >= 1; n = Math.floor(n / 2)) path.add(String(n));
  const fan = $('#fan');
  fan.classList.add('trace');
  for (const x of fan.querySelectorAll('.fan-s')) x.classList.toggle('on', path.has(x.dataset.sosa));
  const tip = $('#fanTip');
  tip.innerHTML = tipHTML(sector.dataset.id, sosa);
  tip.hidden = false;
  if (ev && 'clientX' in ev) placeTip(ev.clientX, ev.clientY);
  else {
    const r = sector.getBoundingClientRect();
    placeTip(r.left + r.width / 2, r.top + r.height / 2);
  }
}

/** The mouse moves over the fan: the label follows it. */
export function fanMove(ev) {
  if (!$('#fanTip').hidden && sectorOf(ev.target)) placeTip(ev.clientX, ev.clientY);
}

/** Click on a sector: its record, a moment later, unless it's the start of a double-click. */
export function fanClick(id) {
  clearTimeout(opening);
  opening = setTimeout(() => openPersonDlg(id), 250);
}

/**
 * Double-click: the person to centre the fan on (this ancestor; in the centre, the person left),
 * or null.
 */
export function fanRecenter(target) {
  const sector = sectorOf(target);
  if (!sector) return null;
  clearTimeout(opening);
  clear();
  if (sector.dataset.sosa !== '1') {
    back.push(S.focus);
    return sector.dataset.id;
  }
  return fanBack();
}

/** The person left by the last recentring (and removes it from the stack), or null. */
export function fanBack() {
  while (back.length && !S.people.has(back[back.length - 1])) back.pop();
  return back.length ? back.pop() : null;
}

/**
 * Fan chart bar, always visible: go back to the person left, go down to a descendant
 * of the focus person, as far as the farthest known (even after a reload, which forgets
 * the people left): a list sorted by generation, always there, greyed out with no descendant.
 */
export function renderFanNav(shown) {
  const nav = $('#fanNav');
  nav.hidden = !shown;
  if (!shown) return;
  while (back.length && !S.people.has(back[back.length - 1])) back.pop();
  const previous = back.length ? P(back[back.length - 1]) : null;
  const rows = descendantRows(S.focus);
  const option = (id) => `<option value="${esc(id)}">${esc([fullName(P(id)), lifeYears(P(id))].filter(Boolean).join(' · '))}</option>`;
  const p = P(S.focus);
  const alone = !S.people.has(p.fatherId) && !S.people.has(p.motherId);
  nav.innerHTML = '<div>'
    + (previous ? `<button class="btn small" type="button" data-act="fan-back">${esc(t('fan.backTo', fullName(previous)))}</button>` : '')
    + `<select class="btn small" id="fanKids" aria-label="${esc(t('fan.down'))}"${rows.length ? '' : ' disabled'}>`
    + `<option value="">↓ ${esc(t(rows.length ? 'fan.down' : 'fan.noDown'))}</option>`
    + rows.map((row, i) => `<optgroup label="${esc(t('fan.genDown', i + 1, row.length))}">${row.map(option).join('')}</optgroup>`).join('')
    + '</select>'
    + (alone ? `<span class="hint">${esc(t('fan.alone'))}</span>` : '')
    + '</div>';
}
