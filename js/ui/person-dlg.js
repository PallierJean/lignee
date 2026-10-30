/** Fiche d'une personne en lecture seule, ouverte au centre de l'écran par un clic dans l'arbre. */
import { S } from '../state.js';
import { $, esc } from '../utils/dom.js';
import { longDate, yearOf } from '../utils/dates.js';
import { t } from '../i18n.js';
import {
  P, given, surname, maiden, fullName, photoOf, avatarOf, lifeYears, ageInfo, isDead,
  partnersOf, childrenOf, siblingsOf, situationText, eventsOf, eventLabel, sourcesOf, mediaOf, unionTypeLabel, unionEndText,
} from '../model/people.js';
import { sourcesHTML, mediaGrid } from './fiche.js';

let opener = null; // élément à qui rendre la main à la fermeture

const sexClass = (p) => (p.sex === 'M' || p.sex === 'F' ? 'is-' + p.sex : '');

/** Numéro Sosa affiché dans l'arbre, s'il y en a un. */
function sosaOf(id) {
  const n = S.lastLayout && S.lastLayout.nodes.find((x) => x.id === id && x.sosa);
  return n ? n.sosa : null;
}

/** Bouton vers un proche : sa fiche remplace la fiche affichée. */
function rel(id, sub) {
  const q = P(id);
  if (!q) return '';
  return `<button class="pd-rel ${sexClass(q)}" type="button" data-act="person-open" data-id="${esc(id)}">`
    + `<span class="pd-rn">${esc(fullName(q))}${sub ? `<small>${esc(sub)}</small>` : ''}</span>`
    + `<span class="pd-ry">${esc(lifeYears(q))}</span></button>`;
}

function group(title, items, empty) {
  const n = items.length > 1 ? ` <span class="n">${items.length}</span>` : '';
  return `<div><h3>${title}${n}</h3><div class="pd-rels">`
    + (items.length ? items.join('') : `<p class="unknown">${empty}</p>`) + '</div></div>';
}

/** Ligne de la frise : symbole, date, événement et lieu. */
function event(sym, date, what, place) {
  return `<li><span class="pd-sym" aria-hidden="true">${sym}</span>`
    + `<span class="pd-d">${date ? esc(longDate(date)) : '—'}</span>`
    + `<span class="pd-what">${what}${place ? `<small>${esc(place)}</small>` : ''}</span></li>`;
}

function personHTML(id) {
  const p = P(id);
  const partners = partnersOf(id);
  const age = ageInfo(p);
  const sosa = sosaOf(id);
  const fem = p.sex === 'F';
  const photo = photoOf(p);
  const img = photo || avatarOf(p.sex);

  const life = [event('°', p.birthDate, `<b>${t('birth')}</b>`, String(p.birthPlace || '').trim())];
  for (const pt of partners) {
    if (!pt.uid) continue;
    const u = S.unions.get(pt.uid) || {};
    life.push(event('×', u.date, t('pd.unionWith', esc(fullName(P(pt.id))), unionTypeLabel(u)), String(u.place || '').trim()));
    if (unionEndText(u)) life.push(event('⊘', u.endDate, `<b>${esc(t('ue.' + u.end))}</b>`, ''));
  }
  if (isDead(p)) {
    const at = age && age.dead ? t('pd.deathAt', esc(age.text)) : '';
    life.push(event('†', p.deathDate, `<b>${t('death')}</b>${at}`, String(p.deathPlace || '').trim()));
  }

  for (const e of eventsOf(p)) {
    life.push(event('•', e.date, `<b>${esc(eventLabel(e))}</b>`, [e.place, e.note].map((x) => String(x || '').trim()).filter(Boolean).join(' · ')));
  }

  const parents = [[p.fatherId, t('father')], [p.motherId, t('mother')]]
    .filter(([q]) => q && S.people.has(q))
    .map(([q, label]) => rel(q, label));
  const spouses = partners.map((pt) => {
    const u = pt.uid && S.unions.get(pt.uid);
    const y = u && yearOf(u.date);
    return rel(pt.id, y ? '× ' + y : '');
  });
  const severalPartners = partners.length > 1;
  const kids = childrenOf(id).map((k) => {
    const c = P(k);
    const other = c.fatherId === id ? c.motherId : c.fatherId;
    return rel(k, severalPartners && other && S.people.has(other) ? t('with', fullName(P(other))) : '');
  });
  const siblings = siblingsOf(id).map((s) => rel(s.id, s.half));

  const head = [lifeYears(p), !isDead(p) && age ? age.text : ''].filter(Boolean).join(' · ');
  const situation = situationText(p, id);
  const updated = p.updatedAt
    ? t('pd.updated', new Date(p.updatedAt).toLocaleDateString(t('locale'), { day: 'numeric', month: 'short', year: 'numeric' }))
    : '';

  return `<button class="icon-btn pd-close" type="button" data-act="person-close" aria-label="${t('close')}">×</button>
    <header class="pd-head">
      ${img ? `<img class="pd-photo${photo ? ' zoomable' : ' avatar'}" src="${esc(img)}" alt="${photo ? esc(t('photoOf', fullName(p))) : ''}"${photo ? ' data-act="photo-zoom"' : ''}>` : ''}
      <div class="pd-id">
        <p class="pd-eyebrow"><i class="sx ${esc(p.sex || 'U')}"></i>${t(fem ? 'sex.F' : p.sex === 'M' ? 'sex.M' : 'sex.U')}`
          + `${sosa ? ` <span class="sosa" title="${t('sosaTitle')}">Sosa ${sosa}</span>` : ''}`
          + `${p.example ? ` <span class="tag">${t('example')}</span>` : ''}</p>
        <h2 class="pd-name" id="pdName">${esc(given(p) || '—')} <span class="sur">${esc(surname(p) || maiden(p))}</span></h2>
        ${maiden(p) && surname(p) ? `<p class="pd-maiden">${t('nee')} <span class="sur">${esc(maiden(p))}</span></p>` : ''}
        ${head ? `<p class="pd-years">${esc(head)}</p>` : ''}
        ${p.occupation || situation ? `<p class="pd-occ">${esc([p.occupation, situation].filter(Boolean).join(' · '))}</p>` : ''}
      </div>
    </header>
    <div class="pd-body" id="pdBody">
      <section><h3>${t('pd.life')}</h3><ol class="pd-life">${life.join('')}</ol></section>
      <section class="pd-family">
        ${group(t('parents'), parents, t('pd.parentsUnknown'))}
        ${group(t(partners.length > 1 ? 'unions' : 'union'), spouses, t('pd.noUnion'))}
        ${group(t('children'), kids, t('pd.noChild'))}
        ${group(t('siblings'), siblings, t('pd.none'))}
      </section>
      ${mediaOf(id).length ? `<section><h3>${t('media')}</h3>${mediaGrid(mediaOf(id))}</section>` : ''}
      ${sourcesOf(p).length ? `<section><h3>${t('sources')}</h3>${sourcesHTML(id)}</section>` : ''}
      ${p.notes ? `<section><h3>${t('notes')}</h3><p class="pd-notes">${esc(p.notes)}</p></section>` : ''}
    </div>
    <footer class="pd-foot">
      <span class="pd-meta">${esc(updated)}</span>
      <span class="row-btns">
        <button class="btn" type="button" data-act="family-book" data-id="${esc(id)}">${t('fb.open')}</button>
        ${id !== S.focus ? `<button class="btn" type="button" data-act="person-center" data-id="${esc(id)}">${t('pd.center')}</button>` : ''}
        ${S.canWrite ? `<button class="btn primary" type="button" data-act="person-edit" data-id="${esc(id)}">${t('pd.edit')}</button>` : ''}
      </span>
    </footer>`;
}

/** Redessine la fiche ouverte (après un changement des données), ou la ferme si la personne n'existe plus. */
export function renderPersonDlg() {
  if (!S.popup) return;
  if (!S.people.has(S.popup)) {
    closePersonDlg();
    return;
  }
  const body = $('#pdBody');
  const top = body ? body.scrollTop : 0;
  const card = $('#personCard');
  card.className = 'pd-card ' + sexClass(P(S.popup));
  card.innerHTML = personHTML(S.popup);
  $('#pdBody').scrollTop = top;
}

export function openPersonDlg(id) {
  if (!S.people.has(id)) return;
  if (!S.popup) opener = document.activeElement;
  const changed = id !== S.popup;
  S.popup = id;
  renderPersonDlg();
  if (changed) $('#pdBody').scrollTop = 0;
  $('#personDlg').hidden = false;
  $('#personCard').focus({ preventScroll: true });
}

export function closePersonDlg() {
  S.popup = null;
  $('#personDlg').hidden = true;
  if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  opener = null;
}
