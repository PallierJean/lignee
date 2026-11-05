/**
 * Roue d'ascendance : au survol d'un secteur, une étiquette (nom, Sosa, naissance, décès) et le chemin
 * qui le relie à la personne centrale ; un double-clic recentre la roue sur lui, un double-clic au
 * centre revient à la personne quittée. Des boutons font de même : revenir, ou descendre vers un enfant.
 */
import { S } from '../state.js';
import { $, esc } from '../utils/dom.js';
import { longDate } from '../utils/dates.js';
import { t } from '../i18n.js';
import { P, fullName, lifeYears, descendantRows } from '../model/people.js';
import { openPersonDlg } from './person-dlg.js';

const back = [];      // personnes centrales quittées par double-clic, la dernière en fin
let opening = null;   // clic simple en attente : un double-clic l'annule

const sectorOf = (target) => (target && target.closest ? target.closest('#fan .fan-s') : null);

/** Ligne « ° 10 septembre 1864, Lyon (69) » d'une naissance ou d'un décès, ou ''. */
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

/** Place l'étiquette près du point (x, y), sans sortir de la fenêtre. */
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
 * Survol (ou focus) d'un secteur : étiquette et chemin vers le centre (numéros Sosa n, n/2… 1).
 * `ev` donne la position de la souris ; au clavier, l'étiquette se place sur le secteur.
 */
export function fanHover(target, on, ev) {
  const sector = sectorOf(target);
  if (!on) {
    // Passage d'un élément à l'autre du même secteur (forme, texte) : rien ne change
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

/** La souris se déplace sur la roue : l'étiquette la suit. */
export function fanMove(ev) {
  if (!$('#fanTip').hidden && sectorOf(ev.target)) placeTip(ev.clientX, ev.clientY);
}

/** Clic sur un secteur : sa fiche, un instant plus tard, sauf si c'est le début d'un double-clic. */
export function fanClick(id) {
  clearTimeout(opening);
  opening = setTimeout(() => openPersonDlg(id), 250);
}

/**
 * Double-clic : la personne sur qui centrer la roue (cet ancêtre ; au centre, la personne quittée),
 * ou null.
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

/** La personne quittée par le dernier recentrage (et la retire de la pile), ou null. */
export function fanBack() {
  while (back.length && !S.people.has(back[back.length - 1])) back.pop();
  return back.length ? back.pop() : null;
}

/**
 * Barre de la roue, toujours visible : revenir à la personne quittée, descendre vers un descendant
 * de la personne centrale, jusqu'au plus lointain connu (même après un rechargement, qui oublie
 * les personnes quittées) : un bouton par enfant s'il n'y en a que deux au plus, sinon une liste
 * rangée par génération.
 */
export function renderFanNav(shown) {
  const nav = $('#fanNav');
  nav.hidden = !shown;
  if (!shown) return;
  while (back.length && !S.people.has(back[back.length - 1])) back.pop();
  const previous = back.length ? P(back[back.length - 1]) : null;
  const rows = descendantRows(S.focus);
  const kids = rows.length ? rows[0] : [];
  const few = rows.length === 1 && kids.length <= 2;
  const option = (id) => `<option value="${esc(id)}">${esc([fullName(P(id)), lifeYears(P(id))].filter(Boolean).join(' · '))}</option>`;
  const p = P(S.focus);
  const alone = !S.people.has(p.fatherId) && !S.people.has(p.motherId);
  nav.hidden = !previous && !kids.length && !alone;
  nav.innerHTML = '<div>'
    + (previous ? `<button class="btn small" type="button" data-act="fan-back">${esc(t('fan.backTo', fullName(previous)))}</button>` : '')
    + (few
      ? kids.map((id) => `<button class="btn small" type="button" data-act="fan-down" data-id="${esc(id)}">↓ ${esc(fullName(P(id)))}</button>`).join('')
      : `<select class="btn small" id="fanKids" aria-label="${esc(t('fan.down'))}"><option value="">↓ ${esc(t('fan.down'))}</option>`
        + rows.map((row, i) => `<optgroup label="${esc(t('fan.genDown', i + 1, row.length))}">${row.map(option).join('')}</optgroup>`).join('')
        + '</select>')
    + (alone ? `<span class="hint">${esc(t('fan.alone'))}</span>` : '')
    + '</div>';
}
