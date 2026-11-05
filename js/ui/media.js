/**
 * Visionneuse de la galerie : une photo ou un document, avec les personnes identifiées.
 * Un clic sur l'image place un repère, puis on choisit la personne.
 */
import { S } from '../state.js';
import { $, esc } from '../utils/dom.js';
import { t } from '../i18n.js';
import { P, fullName, mediaList, photoSrc, peopleNamedIn } from '../model/people.js';
import { opUpdate, beginAction, commitAction } from '../services/storage.js';
import { afterData } from './render.js';
import { personOptions } from './form.js';

let current = null;  // { owner, id } : photo affichée
let pin = null;      // { x, y } : repère en attente d'une personne

const item = () => current && mediaList(P(current.owner)).find((m) => m.id === current.id);

/** Repères d'une image, avec des positions numériques : elles peuvent venir d'un fichier importé. */
const tagsOf = (m) => (Array.isArray(m.tags) ? m.tags : [])
  .filter((x) => x && typeof x === 'object')
  .map((x) => ({ ...x, x: Math.min(100, Math.max(0, +x.x || 0)), y: Math.min(100, Math.max(0, +x.y || 0)) }));

export function renderMedia() {
  if (!current) return;
  const m = item();
  if (!m) {
    closeMedia();
    return;
  }
  const tags = tagsOf(m);
  // Repères invisibles sur les visages : ils s'éclairent au survol, du visage ou du nom dans la liste (highlightTag)
  const shown = tags.filter((x) => P(x.id));
  const marks = shown.map((x) => `<button class="tag-pin" type="button" data-tag="${tags.indexOf(x)}" style="left:${x.x}%;top:${x.y}%"`
    + ` data-act="media-person" data-id="${esc(x.id)}" aria-label="${esc(fullName(P(x.id)))}"><span class="tag-name">${esc(fullName(P(x.id)))}</span></button>`).join('');
  const names = shown.map((x) => `<li data-tag="${tags.indexOf(x)}">`
    + `<button class="link" type="button" data-act="media-person" data-id="${esc(x.id)}">${esc(fullName(P(x.id)))}</button>`
    + (S.canWrite ? ` <button class="link" type="button" data-act="tag-remove" data-i="${tags.indexOf(x)}">${t('med.untag')}</button>` : '') + '</li>').join('');
  // Les personnes nommées dans la légende, pas encore identifiées, en tête de la liste
  const tagged = new Set(tags.map((x) => x.id));
  const named = peopleNamedIn([m.title, m.note].join(' ')).filter((id) => !tagged.has(id));
  const options = named.length
    ? `<optgroup label="${t('med.named')}">${named.map((id) => `<option value="${esc(id)}">${esc(fullName(P(id)))}</option>`).join('')}</optgroup>`
      + `<optgroup label="${t('med.everyone')}">${personOptions('')}</optgroup>`
    : personOptions('');
  const picker = pin
    ? `<div class="row-btns tag-pick"><select id="tagPerson" aria-label="${t('med.who')}"><option value="">${t('med.who')}</option>${options}</select>`
      + `<button class="btn small" type="button" data-act="tag-cancel">${t('cancel')}</button></div>`
    : '';
  // La consigne au-dessus de l'image : c'est là qu'on clique
  const hint = S.canWrite && !pin ? `<p class="hint tag-hint">${t('med.hint')}</p>` : '';
  $('#mediaCard').innerHTML = `<div class="sheet-head"><h2 id="mdTitle">${esc(m.title || t('med.untitled'))}</h2>`
    + `<button class="icon-btn" type="button" data-act="media-close" aria-label="${t('close')}">×</button></div>`
    + hint
    + `<div class="media-pic${S.canWrite ? ' can-tag' : ''}" data-act="media-pic"><img src="${esc(photoSrc(m.photo))}" alt="${esc(m.title || '')}">${marks}`
    + (pin ? `<span class="tag-pin new" style="left:${pin.x}%;top:${pin.y}%">+</span>` : '') + '</div>'
    + `${m.date || m.note ? `<p>${esc([m.date, m.note].filter(Boolean).join(' · '))}</p>` : ''}`
    + (names ? `<ol class="tag-list">${names}</ol>` : '') + picker;
}

/** Survol (ou focus) d'un nom de la liste : sa personne s'éclaire sur la photo. */
export function highlightTag(target, on) {
  const row = target && target.closest && target.closest('.tag-list [data-tag]');
  const pin = row && document.querySelector(`.tag-pin[data-tag="${row.dataset.tag}"]`);
  if (pin) pin.classList.toggle('lit', on);
}

export function openMedia(owner, id) {
  current = { owner, id };
  pin = null;
  $('#mediaDlg').hidden = false;
  renderMedia();
}

export function closeMedia() {
  current = null;
  pin = null;
  $('#mediaDlg').hidden = true;
}

/** Clic sur l'image : position du repère, en pourcentage de l'image. */
export function placePin(el, ev) {
  if (!S.canWrite || !item() || ev.target.closest('.tag-pin')) return;
  const box = el.querySelector('img').getBoundingClientRect();
  pin = {
    x: Math.round(((ev.clientX - box.left) / box.width) * 1000) / 10,
    y: Math.round(((ev.clientY - box.top) / box.height) * 1000) / 10,
  };
  renderMedia();
}

export function cancelPin() {
  pin = null;
  renderMedia();
}

async function saveTags(tags) {
  const owner = P(current.owner);
  beginAction('hist.tag');
  try {
    await opUpdate('people', current.owner, { media: mediaList(owner).map((m) => (m.id === current.id ? { ...m, tags } : m)) });
  } finally {
    commitAction();
    afterData();
  }
}

export async function addTag(id) {
  const m = item();
  if (!m || !pin || !P(id)) return;
  const tags = [...tagsOf(m), { id, x: pin.x, y: pin.y }];
  pin = null;
  await saveTags(tags);
}

export async function removeTag(i) {
  const m = item();
  if (m) await saveTags(tagsOf(m).filter((_, k) => k !== i));
}
