/** Fiche détaillée d'une personne (onglet « Fiche »). */
import { S } from '../state.js';
import { esc } from '../utils/dom.js';
import { longDate } from '../utils/dates.js';
import { t } from '../i18n.js';
import {
  P, given, surname, maiden, fullName, photoOf, photoSrc, avatarOf, lifeYears, ageInfo,
  partnersOf, childrenOf, siblingsOf, situationText, eventsOf, sourcesOf, eventLabel, factLabel, SOURCE_KINDS, mediaOf, unionTypeLabel, unionEndText,
} from '../model/people.js';

/** Vignettes de la galerie ; un clic ouvre la visionneuse. */
export function mediaGrid(items) {
  const cells = items.filter(({ m }) => photoSrc(m.photo)).map(({ owner, m }) => `<button class="med" type="button" data-act="media-open" data-owner="${esc(owner)}" data-id="${esc(m.id)}" title="${esc(m.title || '')}">`
    + `<img src="${esc(photoSrc(m.photo))}" alt="${esc(m.title || '')}"></button>`);
  return cells.length ? `<div class="meds">${cells.join('')}</div>` : '';
}

/** Liste des sources d'une personne : acte, fait appuyé, cote, note et document. */
export function sourcesHTML(id) {
  const items = sourcesOf(P(id)).map((s) => {
    const img = photoSrc(s.photo);
    const kind = t('src.' + (SOURCE_KINDS.includes(s.kind) ? s.kind : 'other'));
    const where = [s.place, s.ref].map((x) => String(x || '').trim()).filter(Boolean).join(' · ');
    const fact = factLabel(id, s.fact);
    return '<li class="src">'
      + (img ? `<img class="src-doc zoomable" src="${esc(img)}" alt="${esc(s.title || kind)}" data-act="photo-zoom">` : '')
      + `<div><b>${esc(s.title || kind)}</b>${fact ? ` <span class="src-fact">${esc(fact)}</span>` : ''}`
      + (where ? `<small>${esc(where)}</small>` : '') + (s.note ? `<p>${esc(s.note)}</p>` : '') + '</div></li>';
  });
  return items.length ? `<ul class="srcs">${items.join('')}</ul>` : '';
}

/** Bouton vers une autre personne, avec ses années et une mention facultative. */
function chip(id, extra, label) {
  const q = P(id);
  if (!q) return '';
  const sub = [label, extra].filter(Boolean).join(' · ');
  return `<button class="chip" type="button" data-act="focus" data-id="${esc(id)}">`
    + `<span class="cn">${esc(fullName(q))}</span><span class="cy">${esc(lifeYears(q))}</span>`
    + `${sub ? `<span class="cx">${esc(sub)}</span>` : ''}</button>`;
}

/** Bouton « + Ajouter… », seulement si l'utilisateur peut modifier l'arbre. */
function addButton(rel, of, label, withId) {
  if (!S.canWrite) return '';
  return `<button class="addline" type="button" data-act="add" data-rel="${rel}" data-of="${esc(of)}"${withId ? ` data-with="${esc(withId)}"` : ''}>+ ${esc(label)}</button>`;
}

function unionText(partner) {
  if (!partner.uid) return t('fiche.commonKids');
  const u = S.unions.get(partner.uid) || {};
  const d = longDate(u.date);
  const parts = [unionTypeLabel(u), d, String(u.place || '').trim()].filter(Boolean);
  const end = unionEndText(u);
  return '× ' + (parts.join(', ') || t('fiche.union')) + (end ? ' · ' + t('ue.ended', end) : '');
}

function fact(date, place) {
  const text = [longDate(date), String(place || '').trim()].filter(Boolean).join(', ');
  return text ? esc(text) : `<span class="muted">${t('fiche.notSet')}</span>`;
}

export function ficheHTML(id) {
  const p = P(id);
  const sexWord = t(p.sex === 'F' || p.sex === 'M' ? 'sex.' + p.sex : 'sex.U');
  const partners = partnersOf(id);
  const kids = childrenOf(id);
  const siblings = siblingsOf(id);
  const age = ageInfo(p);
  const hasDeathInfo = String(p.deathDate || '').trim() || String(p.deathPlace || '').trim();
  const death = hasDeathInfo ? fact(p.deathDate, p.deathPlace) : p.deceased ? t('fiche.unknownDate') : '<span class="muted">—</span>';

  const parentLine = (rel, parentId, label) => {
    if (parentId && S.people.has(parentId)) return chip(parentId, '', label);
    if (S.canWrite) return addButton(rel, id, t(rel === 'father' ? 'addFather' : 'addMother'));
    return `<p class="unknown">${t(rel === 'father' ? 'fatherUnknown' : 'motherUnknown')}</p>`;
  };
  // Autres conjoints des parents : « Conjoint de la mère », « Conjointe du père »
  const stepChips = [[p.fatherId, p.motherId, false], [p.motherId, p.fatherId, true]]
    .filter(([parentId]) => parentId && S.people.has(parentId))
    .flatMap(([parentId, otherId, ofMother]) => partnersOf(parentId)
      .filter((pt) => pt.id !== otherId && pt.id !== id)
      .map((pt) => chip(pt.id, '', t('stepOf', P(pt.id).sex === 'F', ofMother))))
    .join('');
  const severalPartners = partners.length > 1;
  const childChip = (k) => {
    const c = P(k);
    const other = c.fatherId === id ? c.motherId : c.fatherId;
    return chip(k, severalPartners && other && S.people.has(other) ? t('with', fullName(P(other))) : '');
  };

  const photo = photoOf(p);
  const avatar = photo ? '' : avatarOf(p.sex);

  let html = `<article class="fiche">
    <div class="fiche-head">
      ${photo ? `<img class="photo zoomable" src="${esc(photo)}" alt="${esc(t('photoOf', fullName(p)))}" data-act="photo-zoom">` : ''}
      ${avatar ? `<img class="photo avatar" src="${esc(avatar)}" alt="">` : ''}
      <div>
        <p class="eyebrow"><i class="sx ${esc(p.sex || 'U')}"></i>${sexWord}${p.example ? ` <span class="tag">${t('example')}</span>` : ''}</p>
        <h2 class="name">${esc(given(p))} <span class="sur">${esc(surname(p) || maiden(p))}</span></h2>
        ${maiden(p) && surname(p) ? `<p class="maiden">${t('nee')} <span class="sur">${esc(maiden(p))}</span></p>` : ''}
        ${p.occupation ? `<p class="occ">${esc(p.occupation)}</p>` : ''}
      </div>
    </div>
    <dl class="facts">
      <div><dt>° ${t('birth')}</dt><dd>${fact(p.birthDate, p.birthPlace)}</dd></div>
      <div><dt>† ${t('death')}</dt><dd>${death}</dd></div>
      ${eventsOf(p).map((e) => `<div><dt>${esc(eventLabel(e))}</dt><dd>${fact(e.date, e.place)}${e.note ? `<small class="ev-note">${esc(e.note)}</small>` : ''}</dd></div>`).join('')}
      ${age ? `<div><dt>${esc(age.label)}</dt><dd>${esc(age.text)}</dd></div>` : ''}
      ${situationText(p, id) ? `<div><dt>${t('situation')}</dt><dd>${esc(situationText(p, id))}</dd></div>` : ''}
    </dl>

    <section class="rel">
      <h3>${t('parents')}</h3>
      <div class="chips">${parentLine('father', p.fatherId, t('father'))}${parentLine('mother', p.motherId, t('mother'))}${stepChips}</div>
    </section>

    <section class="rel">
      <h3>${t('unions')} <span class="n">${partners.length || ''}</span></h3>
      <div class="chips">
        ${partners.map((pt) => chip(pt.id, unionText(pt))).join('')}
        ${addButton('spouse', id, t('addSpouse'))}
        ${!partners.length && !S.canWrite ? `<p class="unknown">${t('noUnion')}</p>` : ''}
      </div>
    </section>

    <section class="rel">
      <h3>${t('children')} <span class="n">${kids.length || ''}</span></h3>
      <div class="chips">
        ${kids.map(childChip).join('')}
        ${severalPartners
          ? partners.map((pt) => addButton('child', id, t('addChildWith', fullName(P(pt.id))), pt.id)).join('')
          : addButton('child', id, t('addChild'))}
        ${!kids.length && !S.canWrite ? `<p class="unknown">${t('noChild')}</p>` : ''}
      </div>
    </section>

    ${siblings.length || S.canWrite ? `<section class="rel">
      <h3>${t('siblings')} <span class="n">${siblings.length || ''}</span></h3>
      <div class="chips">
        ${siblings.map((s) => chip(s.id, s.half)).join('')}
        ${addButton('sibling', id, t('addSibling'))}
      </div>
    </section>` : ''}

    ${mediaOf(id).length ? `<section class="rel"><h3>${t('media')} <span class="n">${mediaOf(id).length}</span></h3>${mediaGrid(mediaOf(id))}</section>` : ''}

    ${sourcesOf(p).length ? `<section class="rel"><h3>${t('sources')} <span class="n">${sourcesOf(p).length}</span></h3>${sourcesHTML(id)}</section>` : ''}

    ${p.notes ? `<section class="rel"><h3>${t('notes')}</h3><p class="notes">${esc(p.notes)}</p></section>` : ''}

    <div class="fiche-tools"><button class="link" type="button" data-act="family-book" data-id="${esc(id)}">${t('fb.open')}</button>`
    + `<button class="link" type="button" data-act="kin-open" data-id="${esc(id)}">${t('kin.ask')}</button></div>`;

  if (S.canWrite) {
    html += '<div class="actions">';
    html += S.confirmDel
      ? `<div class="confirm"><p>${esc(t('deleteAsk', fullName(p)))}</p>`
        + `<button class="btn danger" type="button" data-act="delete-yes">${t('delete')}</button>`
        + `<button class="btn" type="button" data-act="delete-no">${t('cancel')}</button></div>`
      : `<button class="btn primary" type="button" data-act="edit">${t('editFiche')}</button>`
        + `<button class="btn quiet" type="button" data-act="delete-ask">${t('delete')}</button>`;
    html += '</div>';
  }
  return html + '</article>';
}
