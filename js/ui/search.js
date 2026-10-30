/**
 * Recherche rapide de l'en-tête : suggestions au fil de la saisie,
 * navigation au clavier (flèches, Entrée, Échap), raccourci « / » ou Ctrl+K.
 */
import { S } from '../state.js';
import { $, esc } from '../utils/dom.js';
import { norm } from '../utils/helpers.js';
import { t } from '../i18n.js';
import { P, given, surname, maiden, longName, lifeYears, cmpName, queryWords, matchesWords } from '../model/people.js';

const MAX = 8;

let results = [];  // ids proposés
let total = 0;     // nombre total de personnes trouvées
let active = -1;   // suggestion sélectionnée au clavier

/** Les personnes dont le nom commence par la recherche passent en premier. */
function rank(p, q, words) {
  const name = norm([given(p), surname(p), maiden(p)].join(' '));
  const starts = [surname(p), maiden(p)].filter(Boolean).some((s) => norm(s + ' ' + given(p)).startsWith(q));
  if (name.startsWith(q) || starts) return 0;
  const nameWords = name.split(/\s+/);
  if (words.every((w) => nameWords.some((n) => n.startsWith(w)))) return 1;
  return 2;
}

/**
 * Personnes correspondant à la recherche, les plus pertinentes d'abord.
 * Renvoie { ids: les `max` premières, total }. `exclude` : ids à écarter.
 */
export function searchPeople(query, max, exclude = new Set()) {
  const words = queryWords(query);
  if (!words.length) return { ids: [], total: 0 };
  const q = words.join(' ');
  const found = [...S.people].filter(([k, p]) => !exclude.has(k) && matchesWords(p, words));
  found.sort((a, b) => rank(a[1], q, words) - rank(b[1], q, words) || cmpName(a[1], b[1]));
  return { ids: found.slice(0, max).map(([id]) => id), total: found.length };
}

function compute(query) {
  ({ ids: results, total } = searchPeople(query, MAX));
}

function renderList() {
  const input = $('#find');
  const list = $('#findList');
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
    return `<li class="find-opt${i === active ? ' on' : ''}${id === S.focus ? ' cur' : ''}" role="option" id="find-opt-${i}"`
      + ` aria-selected="${i === active}" data-act="find-pick" data-id="${esc(id)}">`
      + `<i class="sx ${esc(p.sex || 'U')}"></i>`
      + `<span class="fn">${esc(longName(p))}<span class="fp">${esc(place)}</span></span>`
      + `<span class="fy">${esc(lifeYears(p))}</span></li>`;
  }).join('')
    + (total > MAX
      ? `<li class="find-more" role="option" id="find-opt-more" data-act="find-all">${t('find.more', total)}</li>`
      : '');
  if (active >= 0) input.setAttribute('aria-activedescendant', 'find-opt-' + active);
  else input.removeAttribute('aria-activedescendant');
}

export function onFindInput() {
  compute($('#find').value);
  active = results.length ? 0 : -1;
  renderList();
}

export function closeFind(clear) {
  const input = $('#find');
  if (clear) input.value = '';
  active = -1;
  $('#findList').hidden = true;
  input.setAttribute('aria-expanded', 'false');
  input.removeAttribute('aria-activedescendant');
}

/** Personne choisie : `onPick` centre l'arbre sur elle. */
export function pickFind(id, onPick) {
  closeFind(true);
  $('#find').blur();
  onPick(id);
}

/** Toutes les personnes trouvées, dans le registre. `onShow` ouvre l'onglet. */
export function showAllFind(onShow) {
  S.query = $('#find').value;
  const q = $('#q');
  if (q) q.value = S.query;
  closeFind(true);
  onShow();
}

/** Touches dans le champ de recherche. Renvoie vrai si la touche a été traitée. */
export function onFindKey(ev, onPick) {
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    if (!results.length) return true;
    const step = ev.key === 'ArrowDown' ? 1 : -1;
    active = (active + step + results.length) % results.length;
    renderList();
    const el = document.getElementById('find-opt-' + active);
    if (el) el.scrollIntoView({ block: 'nearest' });
    return true;
  }
  if (ev.key === 'Enter') {
    if (active >= 0 && results[active]) pickFind(results[active], onPick);
    return true;
  }
  if (ev.key === 'Escape') {
    if ($('#find').value) closeFind(true);
    else $('#find').blur();
    return true;
  }
  return false;
}

/** Recalcule les suggestions après un changement des données, si la liste est ouverte. */
export function refreshFind() {
  const input = $('#find');
  if (!input || $('#findList').hidden) return;
  compute(input.value);
  if (active >= results.length) active = results.length - 1;
  renderList();
}
