/** Detailed record of a person ("Record" tab). */
import { S } from '../state.js';
import { esc } from '../utils/dom.js';
import { longDate } from '../utils/dates.js';
import { t } from '../i18n.js';
import {
  P, given, surname, maiden, fullName, photoOf, photoSrc, avatarOf, lifeYears, ageInfo,
  partnersOf, childrenOf, siblingsOf, isMinor, UNION_AGE, situationText, eventsOf, sourcesOf, eventLabel, factLabel, SOURCE_KINDS, mediaOf, mediaLabel, unionTypeLabel, unionCauseText, unionEndText,
} from '../model/people.js';
import { sourcesOfPerson } from '../model/sources.js';
import { readLink } from './reading.js';
import { occupationLabel } from '../model/occupations.js';

/** Gallery thumbnails; a click opens the viewer. */
/** Images of each grid shown, in order: group -> [{ owner, id }] (see ui/media.js). */
export const mediaGroups = new Map();

export function mediaGrid(items, group = '', lead = '') {
  // On each thumbnail, the number of people identified
  const count = (m) => (Array.isArray(m.tags) ? m.tags.filter((x) => x && P(x.id)).length : 0);
  const shown = items.filter(({ m }) => photoSrc(m.photo));
  // The viewer goes from one image to the next in the order of this grid
  if (group) mediaGroups.set(group, shown.map(({ owner, m }) => ({ owner, id: m.id })));
  const cells = shown.map(({ owner, m }) => `<button class="med" type="button" data-act="media-open" data-owner="${esc(owner)}" data-id="${esc(m.id)}"`
    + `${group ? ` data-group="${esc(group)}"` : ''} title="${esc(mediaLabel(m))}">`
    + `<img src="${esc(photoSrc(m.photo))}" alt="${esc(mediaLabel(m))}">`
    + (count(m) ? `<span class="med-n" title="${esc(t('med.taggedN', count(m)))}">${count(m)}</span>` : '')
    + (photoSrc(m.back) ? `<span class="med-rv" title="${t('med.hasBack')}">${t('med.rv')}</span>` : '') + '</button>');
  return cells.length || lead ? `<div class="meds">${lead}${cells.join('')}</div>` : '';
}

/** First cell of a gallery: adds photos to `owner`'s gallery (they open in the viewer, to identify the people). */
export function addMediaTile(owner) {
  if (!S.canWrite || !P(owner)) return '';
  return `<label class="med med-add" title="${esc(t('med.addTo', fullName(P(owner))))}"><input type="file" accept="image/*" multiple class="sr" data-gal-add="${esc(owner)}">`
    + `<span class="plus" aria-hidden="true">+</span><small>${t('med.add')}</small></label>`;
}

/** A person's sources: certificate, supported fact, reference, note and document. */
export function sourcesHTML(id) {
  const items = sourcesOfPerson(id).map((s) => {
    const img = photoSrc(s.photo);
    const back = photoSrc(s.back); // second side: a marriage contract, a two-sided certificate
    const kind = t('src.' + (SOURCE_KINDS.includes(s.kind) ? s.kind : 'other'));
    const where = [s.place, s.ref].map((x) => String(x || '').trim()).filter(Boolean).join(' · ');
    const fact = [factLabel(id, s.fact), s.role ? t('role.' + s.role) : ''].filter(Boolean).join(' · ');
    return '<li class="src">'
      // Front and back share data-pair: enlarged, one switches to the other (ui/events.js)
      + (img ? `<img class="src-doc zoomable" src="${esc(img)}" alt="${esc(s.title || kind)}${back ? ' (' + t('med.front') + ')' : ''}" data-act="photo-zoom"${back ? ` data-pair="${esc(s.id)}" data-side="0"` : ''}>` : '')
      + (img && back ? `<img class="src-doc zoomable" src="${esc(back)}" alt="${esc(s.title || kind)} (${t('med.back')})" data-act="photo-zoom" data-pair="${esc(s.id)}" data-side="1">` : '')
      + `<div><b>${esc(s.title || kind)}</b>${fact ? ` <span class="src-fact">${esc(fact)}</span>` : ''}`
      + (where ? `<small>${esc(where)}</small>` : '') + (s.note ? `<p>${esc(s.note)}</p>` : '') + readLink(s.source, S.sources.get(s.source)) + '</div></li>';
  });
  return items.length ? `<ul class="srcs">${items.join('')}</ul>` : '';
}

/** Button to another person, with their years and an optional note. */
function chip(id, extra, label) {
  const q = P(id);
  if (!q) return '';
  const sub = [label, extra].filter(Boolean).join(' · ');
  return `<button class="chip" type="button" data-act="focus" data-id="${esc(id)}">`
    + `<span class="cn">${esc(fullName(q))}</span><span class="cy">${esc(lifeYears(q))}</span>`
    + `${sub ? `<span class="cx">${esc(sub)}</span>` : ''}</button>`;
}

/** "+ Add…" button, only if the user can edit the tree. */
function addButton(rel, of, label, withId) {
  if (!S.canWrite) return '';
  return `<button class="addline" type="button" data-act="add" data-rel="${rel}" data-of="${esc(of)}"${withId ? ` data-with="${esc(withId)}"` : ''}>+ ${esc(label)}</button>`;
}

function unionText(partner) {
  if (!partner.uid) return t('record.commonKids');
  const u = S.unions.get(partner.uid) || {};
  const d = longDate(u.date);
  const parts = [unionTypeLabel(u), unionCauseText(u), d, String(u.place || '').trim()].filter(Boolean);
  const end = unionEndText(u);
  return '× ' + (parts.join(', ') || t('record.union')) + (end ? ' · ' + t('ue.ended', end) : '');
}

function fact(date, place) {
  const text = [longDate(date), String(place || '').trim()].filter(Boolean).join(', ');
  return text ? esc(text) : `<span class="muted">${t('record.notSet')}</span>`;
}

export function recordHTML(id) {
  const p = P(id);
  const sexWord = t(p.sex === 'F' || p.sex === 'M' ? 'sex.' + p.sex : 'sex.U');
  const partners = partnersOf(id);
  const kids = childrenOf(id);
  const siblings = siblingsOf(id);
  const age = ageInfo(p);
  const hasDeathInfo = String(p.deathDate || '').trim() || String(p.deathPlace || '').trim();
  const death = hasDeathInfo ? fact(p.deathDate, p.deathPlace) : p.deceased ? t('record.unknownDate') : '<span class="muted">—</span>';

  const parentLine = (rel, parentId, label) => {
    if (parentId && S.people.has(parentId)) return chip(parentId, '', label);
    if (S.canWrite) return addButton(rel, id, t(rel === 'father' ? 'addFather' : 'addMother'));
    return `<p class="unknown">${t(rel === 'father' ? 'fatherUnknown' : 'motherUnknown')}</p>`;
  };
  // Parents' other spouses: "Mother's spouse", "Father's spouse"
  const stepChips = [[p.fatherId, p.motherId, false], [p.motherId, p.fatherId, true]]
    .filter(([parentId]) => parentId && S.people.has(parentId))
    .flatMap(([parentId, otherId, ofMother]) => partnersOf(parentId)
      .filter((pt) => pt.id !== otherId && pt.id !== id)
      .map((pt) => chip(pt.id, '', t('stepOf', P(pt.id).sex === 'F', ofMother))))
    .join('');
  const severalPartners = partners.length > 1;
  const minor = isMinor(P(id)); // under 17: no child to add
  const young = isMinor(P(id), undefined, UNION_AGE); // under 15: no spouse to add
  const childChip = (k) => {
    const c = P(k);
    const other = c.fatherId === id ? c.motherId : c.fatherId;
    return chip(k, severalPartners && other && S.people.has(other) ? t('with', fullName(P(other))) : '');
  };

  const photo = photoOf(p);
  const avatar = photo ? '' : avatarOf(p.sex);

  let html = `<article class="record">
    <div class="record-head">
      ${photo ? `<img class="photo zoomable" src="${esc(photo)}" alt="${esc(t('photoOf', fullName(p)))}" data-act="photo-zoom">` : ''}
      ${avatar ? `<img class="photo avatar" src="${esc(avatar)}" alt="">` : ''}
      <div>
        <p class="eyebrow"><i class="sx ${esc(p.sex || 'U')}"></i>${sexWord}${p.example ? ` <span class="tag">${t('example')}</span>` : ''}</p>
        <h2 class="name">${esc(given(p))} <span class="sur">${esc(surname(p) || maiden(p))}</span></h2>
        ${maiden(p) && surname(p) ? `<p class="maiden">${t('nee')} <span class="sur">${esc(maiden(p))}</span></p>` : ''}
        ${p.occupation ? `<p class="occ">${esc(occupationLabel(p))}</p>` : ''}
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
        ${young ? '' : addButton('spouse', id, t('addSpouse'))}
        ${!partners.length && (!S.canWrite || young) ? `<p class="unknown">${t('noUnion')}</p>` : ''}
      </div>
    </section>

    <section class="rel">
      <h3>${t('children')} <span class="n">${kids.length || ''}</span></h3>
      <div class="chips">
        ${kids.map(childChip).join('')}
        ${minor ? '' : severalPartners
          ? partners.map((pt) => addButton('child', id, t('addChildWith', fullName(P(pt.id))), pt.id)).join('')
          : addButton('child', id, t('addChild'))}
        ${!kids.length && (!S.canWrite || minor) ? `<p class="unknown">${t('noChild')}</p>` : ''}
      </div>
    </section>

    ${siblings.length || S.canWrite ? `<section class="rel">
      <h3>${t('siblings')} <span class="n">${siblings.length || ''}</span></h3>
      <div class="chips">
        ${siblings.map((s) => chip(s.id, s.half)).join('')}
        ${addButton('sibling', id, t('addSibling'))}
      </div>
    </section>` : ''}

    ${mediaOf(id).length || S.canWrite ? `<section class="rel"><h3>${t('media')} <span class="n">${mediaOf(id).length || ''}</span></h3>${mediaGrid(mediaOf(id), 'person:' + id, addMediaTile(id))}`
      + `${S.canWrite ? `<p class="hint">${t('med.galleryHint')}</p>` : ''}</section>` : ''}

    ${sourcesOfPerson(id).length ? `<section class="rel"><h3>${t('sources')} <span class="n">${sourcesOfPerson(id).length}</span></h3>${sourcesHTML(id)}</section>` : ''}

    ${p.notes ? `<section class="rel"><h3>${t('notes')}</h3><p class="notes">${esc(p.notes)}</p></section>` : ''}

    <div class="record-tools"><button class="link" type="button" data-act="family-book" data-id="${esc(id)}">${t('fb.open')}</button>`
    + `<button class="link" type="button" data-act="kin-open" data-id="${esc(id)}">${t('kin.ask')}</button></div>`;

  if (S.canWrite) {
    html += '<div class="actions">';
    html += S.confirmDel === id
      ? `<div class="confirm"><p>${esc(t('deleteAsk', fullName(p)))}</p>`
        + `<button class="btn danger" type="button" data-act="delete-yes">${t('delete')}</button>`
        + `<button class="btn" type="button" data-act="delete-no">${t('cancel')}</button></div>`
      : `<button class="btn primary" type="button" data-act="edit">${t('editRecord')}</button>`
        + `<button class="btn quiet" type="button" data-act="delete-ask">${t('delete')}</button>`;
    html += '</div>';
  }
  return html + '</article>';
}
