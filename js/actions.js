/**
 * Actions de l'utilisateur : navigation dans l'arbre, ajout, modification,
 * suppression de personnes, affichage.
 */
import { ZOOMS, narrow, reduced } from './config.js';
import { S, savePrefs } from './state.js';
import { $ } from './utils/dom.js';
import { rid, pool } from './utils/helpers.js';
import { isImpossibleDate } from './utils/dates.js';
import { P, photoOf, photoSrc, partnersOf, childrenOf, unionBetween, unionIdBetween, unionDeathEnd, currentSituation, reindex, birthSurname, eventsOf, sourcesOf, mediaList, unionType, isDead, DATED_SITUATIONS } from './model/people.js';
import { opSet, opUpdate, opDelete, storePhoto, beginAction, commitAction, undoAction, redoAction } from './services/storage.js';
import { relationship } from './model/kinship.js';
import { mergedData } from './model/duplicates.js';
import { renamePatches } from './model/places.js';
import { matchDeath, deathDifferences } from './model/insee.js';
import { inseeResults, ignoreInsee } from './services/insee.js';
import { renderTree, scrollToFocus, scrollToPerson } from './tree/render.js';
import { renderAll, renderSide, renderFiche, afterData } from './ui/render.js';
import { renderHeader, renderControls } from './ui/header.js';
import { blankDraft, captureDraft, focusFirstField } from './ui/form.js';
import { toast } from './ui/toast.js';
import { t, getLang, setLang } from './i18n.js';
import { updatePrintInfo } from './ui/print.js';
import { photoFromFile, DOCUMENT_SIDE } from './utils/image.js';

/** Situations partagées avec le conjoint actuel. */
const COUPLE_SITUATIONS = new Set(['married', 'remarried', 'pacs', 'cohabiting']);

/** Situation d'une personne seule -> fin de sa dernière union. */
const ENDING_SITUATIONS = { widowed: 'death', divorced: 'divorce', separated: 'separation' };

/** Sur téléphone, fait défiler jusqu'au panneau latéral. */
function showSide() {
  if (narrow()) $('.side').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}

/* ---------- Navigation et affichage ---------- */

export function setFocus(id, fromList) {
  if (!S.people.has(id)) return;
  if (S.edit) {
    toast(t('finishFocus'));
    return;
  }
  const same = id === S.focus;
  S.focus = id;
  S.confirmDel = false;
  S.tab = 'fiche';
  savePrefs();
  if (!same) S.scrollPending = true;
  renderAll();
  if (fromList) showSide();
}

export function setTab(tab) {
  S.tab = tab;
  if (!S.panel) togglePanel();
  renderSide();
  if (tab === 'registre' && !narrow()) {
    const search = $('#q');
    if (search) search.focus({ preventScroll: true });
  }
}

/** Nombre de générations affichées : kind = 'up' (ascendants) ou 'down' (descendants). */
export function setGenerations(kind, n) {
  S[kind] = n;
  savePrefs();
  S.scrollPending = true;
  renderControls();
  renderTree();
  requestAnimationFrame(scrollToFocus);
}

/** Zoom avant (+1) ou arrière (-1), en gardant le centre de la vue. */
export function zoomBy(step) {
  const canvas = $('#canvas');
  // Centre de la vue dans l'arbre : les marges de défilement valent une demi-vue
  const cx = canvas.scrollLeft / S.zoom;
  const cy = canvas.scrollTop / S.zoom;
  const i = Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(S.zoom) + step));
  S.zoom = ZOOMS[i];
  savePrefs();
  renderControls();
  renderTree();
  canvas.scrollLeft = cx * S.zoom;
  canvas.scrollTop = cy * S.zoom;
}

/** Bascule entre la vue centrée sur une personne et l'arbre complet, à plat. */
export function toggleFull() {
  S.full = S.fan ? true : !S.full;
  S.fan = false;
  savePrefs();
  S.scrollPending = true;
  renderControls();
  renderTree();
  requestAnimationFrame(scrollToFocus);
}

/** Bascule entre l'arbre et la roue d'ascendance. */
export function toggleFan() {
  S.fan = !S.fan;
  savePrefs();
  S.scrollPending = true;
  renderControls();
  renderTree();
  requestAnimationFrame(scrollToFocus);
}

/** Affiche ou retire le halo de la lignée directe. */
export function toggleLine() {
  S.line = !S.line;
  savePrefs();
  renderControls();
  renderTree();
}

/** Affiche ou masque le panneau fiche/registre : l'arbre prend toute la largeur. */
export function togglePanel() {
  S.panel = !S.panel;
  savePrefs();
  renderControls();
  renderTree(); // ses marges suivent la largeur de la toile
  requestAnimationFrame(recenter);
}

export function recenter() {
  S.scrollPending = true;
  scrollToFocus();
}

/** Bascule l'interface entre le français et l'anglais, sans perdre la saisie en cours. */
export function toggleLang() {
  captureDraft();
  setLang(getLang() === 'fr' ? 'en' : 'fr');
  renderAll(true);
  if (!$('#printDlg').hidden) updatePrintInfo();
}

/* ---------- Annuler / rétablir ---------- */

async function runHistory(run, doneKey) {
  if (S.busy) return;
  if (S.edit) {
    toast(t('finishFirst'));
    return;
  }
  S.busy = true;
  let action = null;
  try {
    action = await run();
  } catch (e) {
    /* message déjà affiché par l'enregistrement */
  }
  S.busy = false;
  if (action) {
    const focus = doneKey === 'hist.undone' ? action.focus : action.after;
    if (focus && S.people.has(focus)) S.focus = focus;
    S.scrollPending = true;
    savePrefs();
    toast(t(doneKey, t(action.label)));
  }
  afterData();
}

export const undo = () => runHistory(undoAction, 'hist.undone');
export const redo = () => runHistory(redoAction, 'hist.redone');

/* ---------- Analyse ---------- */

export function setAnalyseView(view) {
  S.analyse = view;
  renderSide();
}

export function setTimeScope(family) {
  S.timeFamily = family;
  renderSide();
}

/** Éphémérides : mois précédent (-1) ou suivant (+1). */
export function shiftMonth(step) {
  const current = S.calMonth || new Date().getMonth() + 1;
  S.calMonth = ((current - 1 + step + 12) % 12) + 1;
  renderSide();
}

/** Ouvre le lien de parenté, avec la personne `id` en premier. */
export function openKin(id) {
  S.kinA = id;
  S.analyse = 'kin';
  S.tab = 'analyse';
  renderSide();
  showSide();
}

export function setKin(side, id) {
  S[side] = id;
  if (S.kinShow) renderTree();
  renderSide();
}

/** Surligne le chemin dans l'arbre complet, le seul où il est sûrement visible en entier. */
export function showKin() {
  const { path } = relationship(S.kinA, S.kinB);
  if (!path.length) return;
  if (!S.kinShow) S.kinWasFull = S.full;
  S.kinShow = true;
  S.full = true;
  S.fan = false;
  renderControls();
  renderTree();
  renderSide();
  requestAnimationFrame(() => scrollToPerson(path[Math.floor(path.length / 2)]));
}

export function hideKin() {
  S.kinShow = false;
  S.full = S.kinWasFull;
  S.scrollPending = true;
  renderControls();
  renderTree();
  renderSide();
  requestAnimationFrame(scrollToFocus);
}

/* ---------- Formulaire ---------- */

function openEdit(edit) {
  S.edit = Object.assign({ token: rid('e'), error: '' }, edit);
  S.tab = 'fiche';
  S.confirmDel = false;
  renderSide(true);
  showSide();
  focusFirstField();
}

/** Ligne d'union vide du formulaire. */
function draftUnion(other) {
  return { uid: null, other, type: '', date: '', place: '', end: '', endDate: '', cause: '', formerId: '', removed: false };
}

/** Champs enregistrés d'une ligne d'union : la cause ne vaut que pour un remariage. */
function unionFields(u) {
  const cause = u.type === 'remarried' ? u.cause : '';
  return {
    type: u.type, date: u.date.trim(), place: u.place.trim(), end: u.end, endDate: u.endDate.trim(),
    cause, formerId: cause === 'widowed' ? u.formerId : '',
  };
}

/** Unions de la personne : sans autre fin renseignée, elles s'arrêtent à la mort du premier conjoint. */
async function closeUnionsAtDeath(id) {
  for (const x of partnersOf(id)) {
    const date = x.uid ? unionDeathEnd(P(id), P(x.id)) : null;
    if (date === null) continue;
    const u = S.unions.get(x.uid);
    if (!u.end) await opUpdate('unions', x.uid, { end: 'death', endDate: date });
    else if (u.end === 'death' && !u.endDate && date) await opUpdate('unions', x.uid, { endDate: date });
  }
}

/** La cause d'un remariage donne la fin de l'union précédente, si elle n'en a pas. */
async function endFormerUnion(id, row) {
  const { cause, formerId } = unionFields(row);
  if (row.removed || !cause) return;
  const uid = cause === 'widowed'
    ? unionIdBetween(id, formerId) || unionIdBetween(row.other, formerId)
    : (partnersOf(id).filter((x) => x.uid && x.id !== row.other).pop() || {}).uid;
  if (uid && !S.unions.get(uid).end) await opUpdate('unions', uid, { end: cause === 'widowed' ? 'death' : 'divorce' });
}

export function startNew() {
  if (!S.canWrite) return;
  if (S.edit) {
    toast(t('finishFirst'));
    return;
  }
  openEdit({ id: null, rel: null, of: null, draft: blankDraft(), unions: [], events: [], sources: [], media: [] });
}

/**
 * Ajout d'un proche de la personne `of` : rel = 'father' | 'mother' | 'child' | 'spouse' | 'sibling'.
 * Pour un enfant, `withId` est l'autre parent ; par défaut, le dernier conjoint.
 */
export function startAdd(rel, of, withId) {
  if (!S.canWrite || !S.people.has(of)) return;
  if (S.edit) {
    toast(t('finishFirst'));
    return;
  }
  const o = P(of);
  const d = blankDraft();
  const unions = [];

  if (rel === 'father') {
    d.sex = 'M';
    d.surname = o.surname || '';
  } else if (rel === 'mother') {
    d.sex = 'F';
  } else if (rel === 'spouse') {
    d.sex = o.sex === 'M' ? 'F' : o.sex === 'F' ? 'M' : 'U';
    unions.push(draftUnion(of));
  } else if (rel === 'child') {
    const last = partnersOf(of).pop();
    const partner = withId || (last ? last.id : '');
    if (o.sex === 'F') {
      d.motherId = of;
      d.fatherId = partner;
    } else {
      d.fatherId = of;
      d.motherId = partner;
    }
    d.surname = birthSurname(d.fatherId, d.motherId);
  } else if (rel === 'sibling') {
    // Frère ou sœur : mêmes parents que la personne (modifiables pour un demi-frère ou une demi-sœur)
    d.fatherId = o.fatherId && S.people.has(o.fatherId) ? o.fatherId : '';
    d.motherId = o.motherId && S.people.has(o.motherId) ? o.motherId : '';
    // Nom de naissance commun (pas le nom d'usage d'une sœur mariée)
    d.surname = birthSurname(d.fatherId, d.motherId) || (o.sex === 'F' ? o.maidenName || o.surname : o.surname) || '';
  }
  openEdit({ id: null, rel, of, draft: d, unions, events: [], sources: [], media: [] });
}

export function startEdit(id) {
  const p = P(id);
  if (!p || !S.canWrite) return;
  const d = blankDraft();
  for (const key of Object.keys(d)) {
    if (key !== 'deceased' && key !== 'sex') d[key] = p[key] == null ? '' : String(p[key]);
  }
  d.sex = p.sex || 'U';
  d.photo = photoOf(p) ? p.photo : '';
  d.deceased = !!p.deceased && !String(p.deathDate || '').trim();
  if (d.sex === 'F' && !d.maidenName.trim()) d.maidenName = birthSurname(d.fatherId, d.motherId);
  const unions = partnersOf(id)
    .filter((x) => x.uid && S.unions.has(x.uid))
    .map((x) => {
      const u = S.unions.get(x.uid);
      // Par défaut, l'union s'arrête à la mort du premier conjoint
      const death = unionDeathEnd(p, P(x.id));
      const end = u.end || (death === null ? '' : 'death');
      return {
        uid: x.uid, other: x.id, type: unionType(u), date: u.date || '', place: u.place || '',
        end, endDate: u.endDate || (end === 'death' && death) || '', cause: u.cause || '', formerId: u.formerId || '', removed: false,
        orig: { type: u.type || '', date: u.date || '', place: u.place || '', end: u.end || '', endDate: u.endDate || '', cause: u.cause || '', formerId: u.formerId || '' },
      };
    });
  // La fiche montre la situation du moment : celle des unions, si elle a changé depuis
  d.situation = currentSituation(id);
  // Des textes, même si la fiche vient d'un fichier importé mal formé
  const texts = (x, keys) => Object.fromEntries(keys.map((k) => [k, x[k] == null ? '' : String(x[k])]));
  const events = eventsOf(p).map((x) => ({ ...x, ...texts(x, ['date', 'place', 'note']), removed: false }));
  const sources = sourcesOf(p).map((x) => ({
    ...x, kind: 'other', ...texts(x, ['fact', 'title', 'place', 'ref', 'note']), ...(x.kind ? { kind: String(x.kind) } : {}),
    photo: photoSrc(x.photo) ? x.photo : '', removed: false,
  }));
  const media = mediaList(p).filter((x) => photoSrc(x.photo))
    .map((x) => ({ tags: [], ...x, ...texts(x, ['title', 'date', 'note']), removed: false }));
  openEdit({ id, rel: null, of: null, draft: d, unions, events, sources, media });
}

export function cancelEdit() {
  S.edit = null;
  S.busy = false;
  renderSide(true);
}

export function addDraftUnion(otherId) {
  if (!S.edit) return;
  captureDraft();
  S.edit.unions.push(draftUnion(otherId));
  renderSide(true);
}

export function removeDraftUnion(i) {
  captureDraft();
  if (S.edit && S.edit.unions[i]) S.edit.unions[i].removed = true;
  renderSide(true);
}

/** Images choisies dans le formulaire : ajoutées à la galerie du brouillon. */
export async function addDraftMedia(files) {
  if (!S.edit) return;
  const token = S.edit.token;
  const added = [];
  for (const file of files) {
    try {
      added.push({ id: rid('m'), photo: await photoFromFile(file, DOCUMENT_SIDE), title: file.name.replace(/\.[^.]+$/, ''), date: '', note: '', tags: [], removed: false });
    } catch (err) {
      toast(err.message, true);
    }
  }
  if (!S.edit || S.edit.token !== token) return;
  captureDraft();
  S.edit.media.push(...added);
  renderSide(true);
}

export function removeDraftMedia(i) {
  captureDraft();
  if (S.edit && S.edit.media[i]) S.edit.media[i].removed = true;
  renderSide(true);
}

export function addDraftEvent() {
  if (!S.edit) return;
  captureDraft();
  S.edit.events.push({ id: rid('e'), type: 'baptism', date: '', place: '', note: '', removed: false });
  renderSide(true);
}

export function removeDraftEvent(i) {
  captureDraft();
  if (S.edit && S.edit.events[i]) S.edit.events[i].removed = true;
  renderSide(true);
}

export function addDraftSource() {
  if (!S.edit) return;
  captureDraft();
  S.edit.sources.push({ id: rid('s'), fact: '', kind: 'birth', title: '', place: '', ref: '', note: '', photo: '', removed: false });
  renderSide(true);
}

export function removeDraftSource(i) {
  captureDraft();
  if (S.edit && S.edit.sources[i]) S.edit.sources[i].removed = true;
  renderSide(true);
}

/** Redessine le formulaire : un libellé d'événement a changé dans la liste des faits. */
export function refreshDraft() {
  captureDraft();
  renderSide(true);
}

/** Document d'une source (photo d'un acte) : réduit moins qu'un portrait, pour rester lisible. */
export async function setDraftSourcePhoto(i, file) {
  if (!S.edit || !file) return;
  const token = S.edit.token;
  let photo;
  try {
    photo = await photoFromFile(file, DOCUMENT_SIDE);
  } catch (err) {
    toast(err.message, true);
    return;
  }
  if (!S.edit || S.edit.token !== token) return;
  captureDraft();
  S.edit.sources[i].photo = photo;
  renderSide(true);
}

export function removeDraftSourcePhoto(i) {
  if (!S.edit) return;
  captureDraft();
  S.edit.sources[i].photo = '';
  renderSide(true);
}

/** Photo choisie dans le formulaire : réduite puis gardée dans le brouillon. */
export async function setDraftPhoto(file) {
  if (!S.edit || !file) return;
  const token = S.edit.token;
  let photo;
  try {
    photo = await photoFromFile(file);
  } catch (err) {
    toast(err.message, true);
    return;
  }
  if (!S.edit || S.edit.token !== token) return; // formulaire fermé entre-temps
  captureDraft();
  S.edit.draft.photo = photo;
  renderSide(true);
}

export function removeDraftPhoto() {
  if (!S.edit) return;
  captureDraft();
  S.edit.draft.photo = '';
  renderSide(true);
}

export async function submitEdit() {
  if (S.busy || !S.edit) return;
  captureDraft();
  const e = S.edit;
  const d = e.draft;

  if (!d.given.trim() && !d.surname.trim() && !(d.sex === 'F' && d.maidenName.trim())) {
    e.error = 'f.errName';
    renderSide(true);
    focusFirstField();
    return;
  }
  if (e.rel === 'sibling' && !d.fatherId && !d.motherId) {
    e.error = 'f.errSibling';
    renderSide(true);
    return;
  }
  if (d.fatherId && d.fatherId === d.motherId) {
    e.error = 'f.errParents';
    renderSide(true);
    return;
  }
  const dates = [d.birthDate, d.deathDate, DATED_SITUATIONS.has(d.situation) ? d.situationDate : '',
    ...e.unions.filter((u) => !u.removed).flatMap((u) => [u.date, u.endDate]), ...e.events.filter((x) => !x.removed).map((x) => x.date)];
  if (dates.some(isImpossibleDate)) {
    e.error = 'f.errDate';
    renderSide(true);
    return;
  }

  S.busy = true;
  const button = $('#f-submit');
  if (button) {
    button.disabled = true;
    button.textContent = t('f.saving');
  }

  beginAction(e.id ? 'hist.edit' : 'hist.add');
  try {
    const id = e.id || rid('p');
    const previous = e.id ? P(e.id) : null;
    const data = {
      given: d.given.trim(),
      surname: d.surname.trim(),
      maidenName: d.sex === 'F' ? d.maidenName.trim() : '',
      sex: d.sex || 'U',
      birthDate: d.birthDate.trim(),
      birthPlace: d.birthPlace.trim(),
      deathDate: d.deathDate.trim(),
      deathPlace: d.deathPlace.trim(),
      deceased: !!(d.deceased || d.deathDate.trim() || d.deathPlace.trim()),
      occupation: d.occupation.trim(),
      situation: d.situation || '',
      situationDate: DATED_SITUATIONS.has(d.situation) ? d.situationDate.trim() : '',
      notes: d.notes.trim(),
      fatherId: d.fatherId || null,
      motherId: d.motherId || null,
      createdAt: (previous && previous.createdAt) || Date.now(),
      updatedAt: Date.now(),
    };
    if (d.photo) data.photo = await storePhoto(d.photo, data);
    if (previous && previous.example) data.example = true;

    const events = e.events.filter((x) => !x.removed).map(({ removed, ...x }) => ({
      ...x, date: x.date.trim(), place: x.place.trim(), note: x.note.trim(),
    }));
    if (events.length) data.events = events;
    const facts = new Set(events.map((x) => x.id));
    const sources = [];
    for (const { removed, ...x } of e.sources) {
      const s = { ...x, title: x.title.trim(), place: x.place.trim(), ref: x.ref.trim(), note: x.note.trim() };
      if (removed || !(s.title || s.place || s.ref || s.note || s.photo)) continue;
      // Fait retiré du formulaire : la source reste, pour la fiche en général
      if (/^e_/.test(s.fact) && !facts.has(s.fact)) s.fact = '';
      if (s.photo) s.photo = await storePhoto(s.photo, data);
      else delete s.photo;
      sources.push(s);
    }
    if (sources.length) data.sources = sources;
    const media = [];
    for (const { removed, ...x } of e.media) {
      if (removed) continue;
      media.push({ ...x, title: x.title.trim(), date: x.date.trim(), note: x.note.trim(), photo: await storePhoto(x.photo, data) });
    }
    if (media.length) data.media = media;
    await opSet('people', id, data);

    // Nouveau parent : on le relie à l'enfant, et on crée l'union avec l'autre parent s'il est connu
    if ((e.rel === 'father' || e.rel === 'mother') && S.people.has(e.of)) {
      const field = e.rel === 'father' ? 'fatherId' : 'motherId';
      await opUpdate('people', e.of, { [field]: id });
      const child = P(e.of);
      const other = e.rel === 'father' ? child.motherId : child.fatherId;
      if (other && S.people.has(other) && !unionBetween(id, other)) {
        await opSet('unions', rid('u'), { a: other, b: id, date: '', place: '', createdAt: Date.now() });
      }
    }

    // Unions modifiées, retirées ou ajoutées dans le formulaire
    for (const u of e.unions) {
      if (u.uid) {
        if (u.removed) await opDelete('unions', u.uid);
        else if (Object.entries(unionFields(u)).some(([k, v]) => v !== u.orig[k])) await opUpdate('unions', u.uid, unionFields(u));
      } else if (!u.removed && S.people.has(u.other) && !unionBetween(id, u.other)) {
        await opSet('unions', rid('u'), { a: u.other, b: id, ...unionFields(u), createdAt: Date.now() });
      }
    }
    reindex();
    await closeUnionsAtDeath(id);
    for (const u of e.unions) await endFormerUnion(id, u);

    // Dernière union modifiée, situation inchangée : c'est l'union qui donne la situation
    const latest = partnersOf(id).pop();
    const row = latest && e.unions.find((u) => !u.removed && u.other === latest.id);
    if (row && (!row.uid || row.type !== row.orig.type || row.end !== row.orig.end)
      && data.situation === ((previous && previous.situation) || '')) {
      const code = currentSituation(id);
      const now = code === 'married' && row.type === 'remarried' ? 'remarried' : code;
      if (now !== data.situation) {
        data.situation = now;
        data.situationDate = DATED_SITUATIONS.has(now) ? row.date.trim() : '';
        await opUpdate('people', id, { situation: now, situationDate: data.situationDate });
      }
    }

    // Personne mariée, pacsée ou en concubinage : la date (mariage ou pacs) est celle de
    // l'union la plus récente (les unions précédentes gardent la leur), et le conjoint
    // actuel prend la même situation
    // Veuf, divorcé ou séparé : c'est la fin de la dernière union, si elle n'en a pas déjà une
    if (ENDING_SITUATIONS[data.situation]) {
      reindex();
      const last = partnersOf(id).pop();
      if (last && last.uid && !S.unions.get(last.uid).end) await opUpdate('unions', last.uid, { end: ENDING_SITUATIONS[data.situation] });
    }
    if (COUPLE_SITUATIONS.has(data.situation)) {
      reindex();
      const current = partnersOf(id).pop();
      // Le conjoint n'est pas forcément remarié : pour lui, « remarié » vaut « marié »
      const shared = data.situation === 'remarried' ? 'married' : data.situation;
      // Union de type non précisé ou statut changé : la situation donne le type (mêmes codes)
      if (current && current.uid) {
        const { type } = S.unions.get(current.uid);
        const changed = !previous || previous.situation !== data.situation;
        const same = type === data.situation || (type === 'religious' && shared === 'married')
          || (type === 'remarried' && data.situation === 'married');
        if (!type || (changed && !same)) await opUpdate('unions', current.uid, { type: data.situation });
      }
      let date = data.situationDate;
      if (DATED_SITUATIONS.has(data.situation)) {
        const u = current && current.uid && S.unions.get(current.uid);
        // Une date de situation modifiée dans le formulaire l'emporte ; sinon, celle de l'union
        const typed = date && date !== ((previous && previous.situationDate) || '');
        const unionDate = u ? String(u.date || '').trim() : '';
        if (u && date && (typed || !unionDate) && date !== unionDate) await opUpdate('unions', current.uid, { date });
        else if (unionDate) date = unionDate;
        if (date !== data.situationDate) await opUpdate('people', id, { situationDate: date });
      }

      // Seulement si la personne est aussi la dernière union du conjoint
      const spouse = current && P(current.id);
      const spouseCurrent = spouse && partnersOf(current.id).pop();
      if (spouseCurrent && spouseCurrent.id === id && !(current.uid && S.unions.get(current.uid).end)
        && (spouse.situation !== shared || (spouse.situationDate || '') !== date)
        && !(spouse.situation === 'remarried' && shared === 'married')) {
        await opUpdate('people', current.id, { situation: shared, situationDate: date, updatedAt: Date.now() });
      }
    } else if (!data.situation || data.situation === 'single') {
      // Sans statut de couple : la personne reprend celui de l'union en cours
      reindex();
      const current = partnersOf(id).pop();
      const u = current && current.uid && S.unions.get(current.uid);
      const type = u && !u.end && !isDead(P(current.id)) && partnersOf(current.id).pop().id === id ? unionType(u) : '';
      const shared = type === 'religious' ? 'married' : type;
      if (COUPLE_SITUATIONS.has(shared)) {
        if (!u.type) await opUpdate('unions', current.uid, { type: shared });
        await opUpdate('people', id, { situation: shared, situationDate: DATED_SITUATIONS.has(shared) ? String(u.date || '').trim() : '' });
      }
    }

    // Union terminée : le conjoint dont c'est la dernière union est lui aussi veuf, divorcé ou séparé
    reindex();
    const ended = partnersOf(id).pop();
    if (ended && ended.uid && S.unions.get(ended.uid).end && partnersOf(ended.id).pop().id === id) {
      const code = currentSituation(ended.id);
      if (ENDING_SITUATIONS[code] && P(ended.id).situation !== code) {
        await opUpdate('people', ended.id, { situation: code, situationDate: '', updatedAt: Date.now() });
      }
    }

    S.focus = e.rel && S.people.has(e.of) ? e.of : id;
    commitAction();
    S.edit = null;
    S.busy = false;
    S.scrollPending = true;
    savePrefs();
    afterData();
    toast(t(e.id ? 'f.saved' : 'f.added'));
  } catch (err) {
    commitAction();
    S.busy = false;
    const b = $('#f-submit');
    if (b) {
      b.disabled = false;
      b.textContent = t('save');
    }
    reindex();
    renderTree();
  }
}

/* ---------- Suppression ---------- */

export function confirmDelete(show) {
  S.confirmDel = show;
  renderFiche();
}

export async function doDelete(id) {
  if (!S.canWrite || !S.people.has(id)) return;
  const p = P(id);
  const kids = childrenOf(id).slice();
  const partners = partnersOf(id);
  const next = [p.fatherId, p.motherId, kids[0], partners[0] && partners[0].id]
    .find((x) => x && x !== id && S.people.has(x)) || null;

  beginAction('hist.delete');
  try {
    for (const k of kids) {
      const c = P(k);
      if (!c) continue;
      const patch = {};
      if (c.fatherId === id) patch.fatherId = null;
      if (c.motherId === id) patch.motherId = null;
      await opUpdate('people', k, patch);
    }
    for (const [uid, u] of [...S.unions]) {
      if (u.a === id || u.b === id) await opDelete('unions', uid);
    }
    await opDelete('people', id);
    S.confirmDel = false;
    S.focus = next;
    commitAction();
    S.scrollPending = true;
    savePrefs();
    afterData();
    toast(t('deleted'));
  } catch (e) {
    commitAction();
    S.confirmDel = false;
    afterData();
  }
}

/* ---------- Doublons ---------- */

export function ignoreDuplicate(key) {
  S.dupIgnored.add(key);
  renderSide();
}

/** Fusionne `drop` dans `keep` : liens, unions et enfants passent à `keep`, puis `drop` disparaît. */
export async function mergePeople(keep, drop) {
  if (!S.canWrite || S.busy || !S.people.has(keep) || !S.people.has(drop)) return;
  if (S.edit) {
    toast(t('finishFirst'));
    return;
  }
  S.busy = true;
  beginAction('hist.merge');
  try {
    const unionIds = new Map();
    for (const [uid, u] of [...S.unions]) {
      if (u.a !== drop && u.b !== drop) continue;
      const other = u.a === drop ? u.b : u.a;
      const twin = [...S.unions].find(([k, x]) => k !== uid && ((x.a === keep && x.b === other) || (x.a === other && x.b === keep)));
      if (other === keep) await opDelete('unions', uid);
      else if (twin) {
        const [tid, tu] = twin;
        unionIds.set(uid, tid);
        await opUpdate('unions', tid, {
          type: tu.type || u.type || '', date: tu.date || u.date || '', place: tu.place || u.place || '',
          end: tu.end || u.end || '', endDate: tu.endDate || u.endDate || '',
          cause: tu.cause || u.cause || '', formerId: tu.formerId || u.formerId || '',
        });
        await opDelete('unions', uid);
      } else await opUpdate('unions', uid, u.a === drop ? { a: keep } : { b: keep });
    }
    for (const [uid, u] of [...S.unions]) {
      if (u.formerId === drop) await opUpdate('unions', uid, { formerId: keep });
    }
    for (const [id, p] of [...S.people]) {
      if (id === drop || id === keep) continue;
      const patch = {};
      if (p.fatherId === drop) patch.fatherId = keep;
      if (p.motherId === drop) patch.motherId = keep;
      // Identifications sur les photos : elles suivent la personne conservée
      const tagged = (m) => (Array.isArray(m.tags) ? m.tags : []);
      if (mediaList(p).some((m) => tagged(m).some((x) => x.id === drop))) {
        patch.media = mediaList(p).map((m) => ({ ...m, tags: tagged(m).map((x) => (x.id === drop ? { ...x, id: keep } : x)) }));
      }
      // Sources du mariage portées par un conjoint : elles suivent l'union conservée
      const moved = (s) => String(s.fact || '').startsWith('union:') && unionIds.has(s.fact.slice(6));
      if (sourcesOf(p).some(moved)) {
        patch.sources = sourcesOf(p).map((s) => (moved(s) ? { ...s, fact: 'union:' + unionIds.get(s.fact.slice(6)) } : s));
      }
      if (Object.keys(patch).length) await opUpdate('people', id, patch);
    }
    const merged = mergedData(P(keep), P(drop), unionIds);
    merged.updatedAt = Date.now();
    for (const key of ['fatherId', 'motherId']) if (merged[key] === keep || merged[key] === drop) merged[key] = null;
    await opSet('people', keep, merged);
    await opDelete('people', drop);
    if (S.focus === drop) S.focus = keep;
    commitAction();
    S.busy = false;
    S.scrollPending = true;
    savePrefs();
    afterData();
    toast(t('dup.merged'));
  } catch (e) {
    commitAction();
    S.busy = false;
    afterData();
  }
}

/**
 * Renomme un lieu partout où il est cité (naissances, décès, événements, unions) ; s'annule en une fois.
 * Une fiche en cours de saisie suit aussi : l'enregistrer ne remet pas l'ancien lieu.
 */
export async function renamePlace(from, to) {
  to = String(to || '').trim();
  if (!S.canWrite || S.busy) return;
  if (!to || to === from) {
    toast(t('pl.unchanged'));
    return;
  }
  const patches = renamePatches(from, to);
  if (!patches.length) return;
  if (S.edit) {
    captureDraft(); // le formulaire reste dans la page, masqué : sa saisie d'abord, puis le nouveau lieu
    const same = (x) => String(x || '').trim() === from;
    const d = S.edit.draft;
    if (same(d.birthPlace)) d.birthPlace = to;
    if (same(d.deathPlace)) d.deathPlace = to;
    for (const x of [...S.edit.unions, ...S.edit.events]) if (same(x.place)) x.place = to;
  }
  S.busy = true;
  beginAction('hist.place');
  try {
    for (const x of patches) await opUpdate(x.collection, x.id, x.patch);
  } finally {
    commitAction();
    S.busy = false;
    afterData();
    if (S.edit) renderFiche(true); // le formulaire masqué reprend son brouillon, avec le nouveau lieu
  }
  toast(t('pl.renamed', patches.length));
}

/* ---------- Décès de l'INSEE ---------- */

/** Écarts reportables d'une fiche avec son acte INSEE (correspondance sûre ou probable). */
export function inseeDifferences(id) {
  const entry = inseeResults()[id];
  const m = entry && matchDeath(id, entry.acts);
  return m && m.level !== 'lead' ? deathDifferences(id, m.act) : [];
}

/** Reporte dans la fiche l'écart n° `i` de son acte INSEE, ou tous (`i` absent). */
export async function applyInsee(id, i) {
  if (!S.canWrite || S.busy) return;
  if (S.edit) {
    toast(t('finishFirst'));
    return;
  }
  const diffs = inseeDifferences(id).filter((x, k) => x.patch && (i === undefined || k === i));
  if (!diffs.length) return;
  const patch = Object.assign({}, ...diffs.map((x) => x.patch));
  const dies = patch.deceased && !isDead(P(id));
  S.busy = true;
  beginAction('hist.insee');
  try {
    await opUpdate('people', id, patch);
    if (dies || patch.deathDate) await closeUnionsAtDeath(id);
  } finally {
    commitAction();
    S.busy = false;
    afterData();
  }
  toast(t('ins.applied', diffs.length));
}

/** N'affiche plus les écarts INSEE de cette fiche. */
export function ignoreInseeOf(id) {
  ignoreInsee(id);
  renderSide();
}

/* ---------- Famille d'exemple ---------- */

/** Ferme un bandeau d'information, durablement sur ce navigateur. */
export function closeBanner(kind) {
  S.closed[kind] = true;
  savePrefs();
  renderHeader();
}

export function confirmRemoveExamples(show) {
  S.confirmEx = show;
  renderHeader();
}

export async function removeExamples() {
  const examples = new Set([...S.people].filter(([, p]) => p.example).map(([k]) => k));
  const unionIds = [...S.unions]
    .filter(([, u]) => u.example || examples.has(u.a) || examples.has(u.b))
    .map(([k]) => k);
  const linkedPeople = [...S.people]
    .filter(([k, p]) => !examples.has(k) && (examples.has(p.fatherId) || examples.has(p.motherId)));
  S.confirmEx = false;

  beginAction('hist.examples');
  try {
    await pool(linkedPeople, 3, async ([k, p]) => {
      const patch = {};
      if (examples.has(p.fatherId)) patch.fatherId = null;
      if (examples.has(p.motherId)) patch.motherId = null;
      await opUpdate('people', k, patch);
    });
    await pool(unionIds, 3, (uid) => opDelete('unions', uid));
    await pool([...examples], 3, (id) => opDelete('people', id));
    S.focus = null;
    commitAction();
    afterData();
    toast(t('ex.removed'));
  } catch (e) {
    commitAction();
    afterData();
  }
}
