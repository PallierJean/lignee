/**
 * Champ « Ajouter une union » du formulaire : recherche d'une personne de l'arbre
 * au fil de la saisie, avec navigation au clavier (flèches, Entrée, Échap).
 */
import { S } from '../state.js';
import { $, esc } from '../utils/dom.js';
import { P, longName, lifeYears } from '../model/people.js';
import { searchPeople } from './search.js';
import { t } from '../i18n.js';

const MAX = 12;

let results = [];  // ids proposés
let total = 0;     // nombre total de personnes trouvées
let active = -1;   // suggestion sélectionnée au clavier

/** La personne elle-même et ses conjoints déjà dans le formulaire ne sont pas proposés. */
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

/** Touches dans le champ. Renvoie vrai si la touche a été traitée. */
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
  // Entrée ne doit jamais enregistrer le formulaire depuis ce champ
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
