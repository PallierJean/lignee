/** Registre : toutes les personnes, regroupées par nom de famille, avec recherche. */
import { S } from '../state.js';
import { $, esc } from '../utils/dom.js';
import { t, getLang } from '../i18n.js';
import { P, given, surname, maiden, lifeYears, byBirth, queryWords, matchesWords } from '../model/people.js';

export function renderRegistre() {
  const list = $('#reglist');

  if (!S.people.size) {
    list.innerHTML = `<p class="nofocus reg-empty">${t('reg.empty')}</p>`;
    return;
  }

  const words = queryWords(S.query);
  const groups = new Map();
  for (const [id, p] of S.people) {
    if (!matchesWords(p, words)) continue;
    // Une femme figure sous son nom d'usage et sous son nom de jeune fille
    const names = [surname(p), maiden(p)].filter(Boolean);
    for (const key of names.length ? names : [t('noSurname')]) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(id);
    }
  }

  if (!groups.size) {
    list.innerHTML = `<p class="nofocus reg-empty">${t('noMatch', esc(S.query))}</p>`;
    return;
  }

  const keys = [...groups.keys()].sort((a, b) => a.localeCompare(b, getLang()));
  list.innerHTML = keys.map((key) => {
    const ids = groups.get(key).sort(byBirth);
    const rows = ids.map((id) => {
      const p = P(id);
      // Sous le nom de jeune fille, on rappelle le nom d'usage, et inversement
      const other = maiden(p) && surname(p) ? (key === maiden(p) ? t('married') + ' ' + surname(p) : t('nee') + ' ' + maiden(p)) : '';
      const place = p.birthPlace ? `<span class="pl"> · ${esc(p.birthPlace)}</span>` : '';
      return `<button class="reg-row${id === S.focus ? ' cur' : ''}" type="button" data-act="focus" data-id="${esc(id)}">`
        + `<span class="nm">${esc(given(p) || '—')}${other ? `<span class="pl"> ${esc(other)}</span>` : ''}${place}</span><span class="y">${esc(lifeYears(p))}</span></button>`;
    }).join('');
    return `<div class="reg-group"><h4>${esc(key)}<span>${ids.length}</span></h4>${rows}</div>`;
  }).join('');
}
