/**
 * Page event listeners.
 * Each clickable element carries a data-act attribute naming the action to run.
 */
import { S } from './state.js';
import { $ } from './utils/dom.js';
import { t } from './i18n.js';
import { avatarOf, birthSurname, DATED_SITUATIONS, situationOfUnion } from './model/people.js';
import { situationOptions } from './ui/form.js';
import * as A from './actions.js';
import {
  openTransfer, closeTransfer, exportGedcom, exportBackup, exportCsv, readImportFile, importGo, pickRepoBackup, connectRepo, connectOpenedRepo,
} from './ui/transfer.js';
import { renderRegister } from './ui/register.js';
import {
  startLocate, placeRowValue, startInsee, restartInsee, inseeSendCode, inseeSendAuth, inseeOtherEmail, copyActs, exportActsCsv, findActsHall, findAllActsHalls, setActsCc, setLibraryFilter,
} from './ui/analysis.js';
import { departmentHint, departmentFromCity } from './ui/form.js';
import {
  openMedia, closeMedia, stepMedia, showMediaSide, placePin, cancelPin, addTag, removeTag, highlightTag, editCaption, saveCaption, openDraftMedia, askMediaDelete, askMediaArchive, archiveMedia, deleteMedia, cropMedia, addGalleryPhotos, onTagFind, pickFirstTag, setMediaBack } from './ui/media.js';
import { closeCropFree, resetCropFree, cropFreeDrag, cropFreeOpen } from './ui/crop-free.js';
import { openPersonDlg, closePersonDlg } from './ui/person-dlg.js';
import { fanHover, fanMove, fanClick, fanRecenter, fanBack } from './ui/fan-hover.js';
import { mapZoom, mapFit, mapPick, mapWheel, mapDrag } from './ui/places.js';
import { closeCrop, cropZoomInput, cropWheel, cropDrag, cropOpen } from './ui/crop.js';
import { pinch } from './ui/pinch.js';
import { defineDialogs, dialogOpen, closeTopDialog, closeOnBackdrop } from './ui/dialogs.js';
import { onFindInput, onFindKey, closeFind, pickFind, showAllFind } from './ui/search.js';
import { onSpouseInput, onSpouseKey, closeSpouse } from './ui/spouse-pick.js';
import { confirmRepoSave, saveRepo, forgetRepo, chooseRepoSave, closeRepoDiff } from './ui/repo-link.js';
import { openPrint, closePrint, updatePrintInfo, printTree, printFamilyBook } from './ui/print.js';
import {
  openTrees, closeTrees, switchTree, newTree, askTree, cancelTreeEdit, submitRename, confirmDeleteTree,
} from './ui/trees.js';

/** True if the user is typing in a field. */
const typing = (el) => !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);

/** Form with no photo: shows the avatar of the chosen sex. */
function updateFormAvatar(sex) {
  const img = document.getElementById('f-avatar');
  if (img) img.src = avatarOf(sex);
}

/** Form: inflects the situation labels ("Marié", "Mariée") for the chosen sex. */
function updateSituationLabels(sex) {
  const select = document.getElementById('f-situ');
  if (!select) return;
  const situation = select.value;
  select.innerHTML = situationOptions({ situation, sex });
}

/** Form: index of the last union, the one that sets the situation (-1 if there is none). */
const lastUnionRow = () => (S.edit ? S.edit.unions.findLastIndex((u) => !u.removed) : -1);

/** Form: the cause only shows for a remarriage, the deceased spouse only for a widowhood. */
function updateUnionCause(i) {
  const remarried = document.getElementById('u-type-' + i).value === 'remarried';
  document.getElementById('u-cause-row-' + i).hidden = !remarried;
  document.getElementById('u-former-row-' + i).hidden = document.getElementById('u-cause-' + i).value !== 'widowed';
}

/** Form: the situation follows the last union. */
function situationFromUnion(i) {
  if (i !== lastUnionRow()) return;
  const select = document.getElementById('f-situ');
  const type = document.getElementById('u-type-' + i).value;
  let end = document.getElementById('u-end-' + i).value;
  // Union ended by the person's own death: they are not widowed
  if (end === 'death' && (document.getElementById('f-ddate').value.trim() || document.getElementById('f-deceased').checked)) end = '';
  const code = situationOfUnion(type, end);
  if (!code || (code === 'married' && select.value === 'remarried' && type !== 'remarried' && !end)) return;
  select.value = code;
  document.getElementById('f-situdate-row').hidden = !DATED_SITUATIONS.has(code);
  document.getElementById('f-situdate').value = DATED_SITUATIONS.has(code) ? document.getElementById('u-date-' + i).value : '';
}

/** Form: the last union follows the situation. */
function unionFromSituation(code) {
  const i = lastUnionRow();
  if (i < 0) return;
  const type = document.getElementById('u-type-' + i);
  const end = { widowed: 'death', divorced: 'divorce', separated: 'separation' }[code];
  if (end) document.getElementById('u-end-' + i).value = end;
  else if (code && code !== 'single') {
    document.getElementById('u-end-' + i).value = '';
    document.getElementById('u-enddate-' + i).value = '';
    if (!(type.value === 'religious' && ['married', 'remarried'].includes(code))) type.value = code;
    updateUnionCause(i);
  }
}

/**
 * Form: derives the birth surname from the father's (or the mother's).
 * It fills the surname when the parents change, and a woman's maiden name.
 */
function updateNames(parentsChanged) {
  const father = document.getElementById('f-father');
  if (!father) return;
  const auto = birthSurname(father.value, document.getElementById('f-mother').value);
  const fill = (input) => {
    // A surname typed by hand is not replaced
    const v = input.value.trim().toUpperCase();
    if (v && v !== (input.dataset.auto || '').toUpperCase()) return;
    input.value = auto;
    input.dataset.auto = auto;
  };
  if (parentsChanged) fill(document.getElementById('f-surname'));
  const sex = document.querySelector('input[name="f-sex"]:checked');
  if (sex && sex.value === 'F') fill(document.getElementById('f-maiden'));
}

// Faces of the document enlarged: its front and back (data-pair), or the image alone
let zoomFaces = [];

/** Shows face `i` of the enlarged document; the Front / Back buttons follow. */
function showZoomFace(i) {
  const face = zoomFaces[i];
  if (!face) return;
  const big = document.getElementById('photoZoomImg');
  big.src = face.src;
  big.alt = face.alt;
  const sides = document.getElementById('photoZoomSides');
  sides.hidden = zoomFaces.length < 2;
  sides.innerHTML = zoomFaces.length < 2 ? '' : zoomFaces.map((_, k) => `<button type="button" data-face="${k}" aria-pressed="${k === i}">${t(k ? 'med.back' : 'med.front')}</button>`).join('');
}

/** Enlarges a photo in the middle of the screen; a document with a back can switch sides there. */
function openPhotoZoom(img) {
  const pair = img.dataset.pair;
  const scope = img.parentElement || document;
  zoomFaces = pair
    ? [...scope.querySelectorAll('img[data-pair]')].filter((x) => x.dataset.pair === pair).sort((a, b) => (+a.dataset.side || 0) - (+b.dataset.side || 0))
    : [img];
  document.getElementById('photoZoom').hidden = false;
  showZoomFace(Math.max(0, zoomFaces.indexOf(img)));
}

/** Front or back, with the arrow keys: the other side. */
function stepZoomFace(d) {
  if (zoomFaces.length < 2) return false;
  const at = zoomFaces.findIndex((x) => x.src === document.getElementById('photoZoomImg').src);
  showZoomFace((Math.max(0, at) + d + zoomFaces.length) % zoomFaces.length);
  return true;
}

function closePhotoZoom() {
  document.getElementById('photoZoom').hidden = true;
  zoomFaces = [];
}

/** Disables the button during a long action. */
const once = (fn) => (el) => {
  el.disabled = true;
  return fn(el);
};

const CLICK_ACTIONS = {
  // Record photo
  'photo-zoom': (el) => openPhotoZoom(el),

  // Record dialog
  // In the fan chart, the record waits a moment: a double-click recentres the fan (ui/fan-hover.js)
  'person-open': (el) => (el.closest('#fan') ? fanClick(el.dataset.id) : openPersonDlg(el.dataset.id)),
  'person-close': () => closePersonDlg(),

  // Fan chart: go back to the person left (going down: #fanKids list, see 'change')
  'fan-back': () => {
    const id = fanBack();
    if (id) A.setFocus(id);
  },
  'person-center': (el) => {
    closePersonDlg();
    A.setFocus(el.dataset.id);
  },
  'person-edit': (el) => {
    closePersonDlg();
    A.editPerson(el.dataset.id);
  },
  'leave-resume': () => A.leaveEdit(false),
  'leave-drop': () => A.leaveEdit(true),

  // Tree and navigation
  focus: (el) => A.setFocus(el.dataset.id, !!el.closest('#reglist')),
  tab: (el) => A.setTab(el.dataset.tab),
  up: (el) => A.setGenerations('up', +el.dataset.n),
  down: (el) => A.setGenerations('down', +el.dataset.n),
  zoom: (el) => A.zoomBy(+el.dataset.d),
  center: () => A.recenter(),
  full: () => A.toggleFull(),
  fan: () => A.toggleFan(),
  line: () => A.toggleLine(),
  photos: () => A.togglePhotos(),
  filter: (el) => A.toggleFilter(el.dataset.filter),
  panel: () => A.togglePanel(),
  lang: () => A.toggleLang(),
  undo: () => A.undo(),
  redo: () => A.redo(),

  // Analysis
  'analysis-view': (el) => A.setAnalysisView(el.dataset.view),
  'cal-month': (el) => A.shiftMonth(+el.dataset.d),
  'kin-open': (el) => A.openKin(el.dataset.id),
  'kin-show': () => A.showKin(),
  'kin-hide': () => A.hideKin(),
  'dup-merge': once((el) => A.mergePeople(el.dataset.keep, el.dataset.drop)),
  'dup-ignore': (el) => A.ignoreDuplicate(el.dataset.key),
  'time-scope': (el) => A.setTimeScope(el.dataset.family === 'true'),
  'map-locate': () => startLocate(),
  'crop-ok': () => closeCrop(true),
  'crop-cancel': () => closeCrop(false),
  'map-zoom': (el) => mapZoom(+el.dataset.d),
  'map-region': (el) => mapFit(el.dataset.key || ''),
  'map-point': (el) => mapPick(el.dataset.name),
  'place-rename': (el) => A.renamePlace(el.dataset.from, placeRowValue(+el.dataset.i)),
  'insee-check': () => startInsee(),
  'acts-copy': (el) => copyActs(el.dataset.i === undefined ? undefined : Number(el.dataset.i)),
  'acts-csv': () => exportActsCsv(),
  'acts-hall': (el) => findActsHall(Number(el.dataset.i)),
  'acts-halls': () => findAllActsHalls(),
  'insee-register': () => inseeSendCode(),
  'insee-auth': () => inseeSendAuth(),
  'insee-restart-login': () => inseeOtherEmail(),
  'insee-forget': () => restartInsee(),
  'insee-apply': once((el) => A.applyInsee(el.dataset.id, el.dataset.i === undefined ? undefined : +el.dataset.i)),
  'insee-ignore': (el) => A.ignoreInseeOf(el.dataset.id),
  'insee-confirm': (el) => A.confirmInseeOf(el.dataset.id),

  // Gallery
  'media-open': (el) => openMedia(el.dataset.owner, el.dataset.id, el.dataset.group),
  'media-step': (el) => stepMedia(Number(el.dataset.d)),
  'media-side': (el) => showMediaSide(el.dataset.back === '1'),
  'media-close': () => closeMedia(),
  'media-person': (el) => {
    closeMedia();
    openPersonDlg(el.dataset.id);
  },
  'media-pic': (el, ev) => placePin(el, ev),
  'tag-cancel': () => cancelPin(),
  'caption-edit': () => editCaption(true),
  'caption-cancel': () => editCaption(false),
  'caption-save': once(() => saveCaption()),
  'tag-remove': (el) => removeTag(+el.dataset.i),

  // Tree collection
  'trees-open': () => openTrees(),
  'trees-close': () => closeTrees(),
  'tree-open': (el) => switchTree(el.dataset.id),
  'tree-rename': (el) => askTree('rename', el.dataset.id),
  'tree-delete': (el) => askTree('delete', el.dataset.id),
  'tree-cancel': () => cancelTreeEdit(),
  'tree-delete-yes': once((el) => confirmDeleteTree(el.dataset.id)),

  // Printing
  'print-open': () => openPrint(),
  'print-close': () => closePrint(),
  'print-go': () => printTree(),
  'family-book': (el) => {
    closePersonDlg();
    printFamilyBook(el.dataset.id);
  },

  // Quick search
  'find-pick': (el) => pickFind(el.dataset.id, (id) => A.setFocus(id, true)),
  'find-all': () => showAllFind(() => A.setTab('register')),
  'spouse-pick': (el) => A.addDraftUnion(el.dataset.id),

  // Adding and editing
  new: () => A.startNew(),
  add: (el) => A.startAdd(el.dataset.rel, el.dataset.of, el.dataset.with),
  edit: () => A.startEdit(S.focus),
  'cancel-edit': () => A.cancelEdit(),
  'u-remove': (el) => A.removeDraftUnion(+el.dataset.i),
  'photo-remove': () => A.removeDraftPhoto(),
  'ev-add': () => A.addDraftEvent(),
  'ev-remove': (el) => A.removeDraftEvent(+el.dataset.i),
  'src-add': () => A.addDraftSource(),
  'med-tag': (el) => openDraftMedia(+el.dataset.i),
  'media-delete': () => askMediaDelete(true),
  'tag-pick': once((el) => addTag(el.dataset.id)),
  'media-crop': once(() => cropMedia()),
  'media-back-remove': once(() => setMediaBack(null)),
  'med-crop': (el) => A.cropDraftMedia(+el.dataset.i),
  'freecrop-ok': () => closeCropFree(true),
  'freecrop-cancel': () => closeCropFree(false),
  'freecrop-reset': () => resetCropFree(),
  'media-delete-no': () => askMediaDelete(false),
  'media-delete-yes': once(() => deleteMedia()),
  'media-archive': () => askMediaArchive(true),
  'media-archive-no': () => askMediaArchive(false),
  'media-archive-yes': once(() => archiveMedia(($('#archiveKind') || {}).value)),
  'med-remove': (el) => A.removeDraftMedia(+el.dataset.i),
  'med-back-remove': (el) => A.removeDraftMediaBack(+el.dataset.i),
  'src-back-remove': (el) => A.removeDraftSourceBack(+el.dataset.i),
  'src-remove': (el) => A.removeDraftSource(+el.dataset.i),
  'src-photo-remove': (el) => A.removeDraftSourcePhoto(+el.dataset.i),

  // Deletion
  'delete-ask': (el) => A.confirmDelete(true, el.dataset.id || S.focus),
  'delete-no': () => A.confirmDelete(false),
  'delete-yes': once((el) => A.doDelete(el.dataset.id || S.focus)),
  // Form: the confirmation shows without redrawing the input in progress
  'form-delete-ask': (el) => {
    document.getElementById('f-delconfirm').hidden = false;
    el.hidden = true;
  },
  'form-delete-no': () => {
    document.getElementById('f-delconfirm').hidden = true;
    document.querySelector('.f-del').hidden = false;
  },

  // Example family
  'banner-close': (el) => A.closeBanner(el.dataset.kind),
  'sheet-close': () => A.closeSheet(),
  'ex-ask': () => A.confirmRemoveExamples(true),
  'ex-no': () => A.confirmRemoveExamples(false),
  'ex-yes': once(() => A.removeExamples()),

  // Import, export
  'import-open': () => openTransfer('import'),
  'export-open': () => openTransfer('export'),
  'transfer-close': () => closeTransfer(),
  'export-ged': () => exportGedcom(),
  'export-json': () => exportBackup(),
  'export-csv': () => exportCsv(),
  'register-csv': () => {
    openTransfer('export');
    exportCsv();
  },
  'repo-connect': (el) => connectRepo(el),
  'repo-connect-open': once(connectOpenedRepo),
  'repo-link-open': () => {
    openTransfer('import');
    setTimeout(() => document.getElementById('repoUrl').focus(), 40);
  },
  'repo-reconnect': () => {
    openTransfer('import');
    setTimeout(() => document.getElementById('repoToken').focus(), 40);
  },
  'repo-save': once(() => saveRepo(false)),
  'repo-save-no': () => confirmRepoSave(false),
  'repo-diff-merge': once(() => chooseRepoSave('merge')),
  'repo-diff-replace': once(() => chooseRepoSave('replace')),
  'repo-diff-close': () => closeRepoDiff(),
  'repo-keep-mine': once(() => saveRepo(true, 'mine')),
  'repo-keep-theirs': once(() => saveRepo(true, 'theirs')),
  'repo-forget': () => forgetRepo(),
  'import-repo-pick': once((el) => pickRepoBackup(+el.dataset.i)),
  'import-go': once(() => importGo(false)),
  'import-new': once(() => importGo(true)),
};

/** Dialogs from the topmost to the lowest (ui/dialogs.js): Escape closes the first open one. */
function appearanceMenu() {
  const look = document.getElementById('appearance');
  return {
    id: 'appearance',
    menu: true,
    isOpen: () => look.open,
    close: () => {
      look.open = false;
      look.querySelector('summary').focus();
    },
  };
}

const DIALOGS = () => [
  { id: 'leaveDlg', close: () => A.leaveEdit(false) },
  { id: 'cropDlg', close: () => closeCrop(false), isOpen: cropOpen },
  { id: 'freeCropDlg', close: () => closeCropFree(false), isOpen: cropFreeOpen },
  appearanceMenu(),
  { id: 'photoZoom', close: closePhotoZoom },
  { id: 'mediaDlg', close: closeMedia, backdrop: true },
  { id: 'personDlg', close: closePersonDlg, backdrop: true },
  { id: 'repoDiffDlg', close: closeRepoDiff, backdrop: true },
  { id: 'transfer', close: closeTransfer, backdrop: true },
  { id: 'printDlg', close: closePrint, backdrop: true },
  // Escape first leaves the rename or delete in progress; the backdrop closes the dialog
  { id: 'treesDlg', close: () => (S.treeEdit ? cancelTreeEdit() : closeTrees()), backdrop: closeTrees },
];

export function bindEvents() {
  defineDialogs(DIALOGS());
  // A click in the suggestions must not take the cursor out of the search field
  document.getElementById('findList').addEventListener('mousedown', (ev) => ev.preventDefault());
  document.getElementById('find').addEventListener('focus', onFindInput);
  document.getElementById('find').addEventListener('blur', () => closeFind(false));

  // Add-a-union field: the form is recreated on every render, hence the delegation
  document.addEventListener('mousedown', (ev) => {
    if (ev.target.closest('#f-spouseList')) ev.preventDefault();
  });
  // Viewer: hovering an identified name lights up the person on the photo
  document.addEventListener('mouseover', (ev) => highlightTag(ev.target, true));
  document.addEventListener('mouseout', (ev) => highlightTag(ev.target, false));
  // Fan chart: label and path on hover, double-click to recentre
  document.addEventListener('mouseover', (ev) => fanHover(ev.target, true, ev));
  document.addEventListener('mouseout', (ev) => fanHover(ev.target, false, ev));
  document.addEventListener('mousemove', fanMove);
  // Places map: wheel to zoom, drag to move
  document.addEventListener('wheel', mapWheel, { passive: false });
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.addEventListener(type, mapDrag);
  // Photo crop: drag, wheel, zoom slider
  document.addEventListener('wheel', cropWheel, { passive: false });
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.addEventListener(type, cropDrag);
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.addEventListener(type, cropFreeDrag);
  // Tree: pinch with two fingers to zoom
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.addEventListener(type, pinch);
  // Phone: the Back button closes the side panel opened over the tree
  window.addEventListener('popstate', () => {
    if (!(history.state && history.state.sheet)) A.closeSheet(true);
  });
  document.addEventListener('dblclick', (ev) => {
    const id = fanRecenter(ev.target);
    if (id) A.setFocus(id);
  });
  document.addEventListener('focusout', (ev) => fanHover(ev.target, false, ev));

  document.addEventListener('focusin', (ev) => {
    highlightTag(ev.target, true);
    fanHover(ev.target, true);
    if (ev.target.id === 'f-spouse') onSpouseInput();
  });
  document.addEventListener('focusout', (ev) => {
    if (ev.target.id === 'f-spouse') closeSpouse();
  });

  document.addEventListener('click', (ev) => {
    // Display menu: a click elsewhere closes it
    const look = document.getElementById('appearance');
    if (look.open && !look.contains(ev.target)) look.open = false;
    // Enlarged photo: Front / Back switch sides, any other click closes it
    if (!document.getElementById('photoZoom').hidden) {
      const face = ev.target.closest && ev.target.closest('[data-face]');
      if (face) showZoomFace(+face.dataset.face);
      else closePhotoZoom();
      return;
    }
    if (closeOnBackdrop(ev.target)) return;
    const el = ev.target.closest('[data-act]');
    if (!el) return;
    const action = CLICK_ACTIONS[el.dataset.act];
    if (action) action(el, ev);
  });

  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.name === 'f-sex') {
      document.getElementById('f-maiden-row').hidden = el.value !== 'F';
      updateFormAvatar(el.value);
      updateSituationLabels(el.value);
    }
    if (el.id === 'fanKids' && el.value) A.setFocus(el.value);
    if (el.id === 'themeSel') A.setTheme(el.value);
    if (el.id === 'actsCc') setActsCc(el.value);
    if (el.id === 'src-cite' && el.value) A.citeDraftSource(el.value);
    if (el.id === 'lib-kind') setLibraryFilter(el.value);
    if (el.id === 'textSel') A.setTextSize(el.value);
    if (el.name === 'f-sex') updateNames(false);
    if (el.id === 'f-father' || el.id === 'f-mother') updateNames(true);
    if (el.id === 'f-situ') {
      document.getElementById('f-situdate-row').hidden = !DATED_SITUATIONS.has(el.value);
      unionFromSituation(el.value);
    }
    const row = /^u-(type|end|cause|date)-(\d+)$/.exec(el.id || '');
    if (row) {
      updateUnionCause(+row[2]);
      situationFromUnion(+row[2]);
    }
    if (el.id === 'importFile') readImportFile(el);
    if (el.closest('#printDlg')) updatePrintInfo();
    if (el.id === 'f-photo' && el.files[0]) A.setDraftPhoto(el.files[0]);
    if (el.matches('[data-src-photo]') && el.files[0]) A.setDraftSourcePhoto(+el.dataset.srcPhoto, el.files[0]);
    if (el.matches('[data-med-back]') && el.files[0]) A.setDraftMediaBack(+el.dataset.medBack, el.files[0]);
    if (el.matches('[data-media-back]') && el.files[0]) {
      setMediaBack(el.files[0]);
      el.value = '';
    }
    if (el.matches('[data-gal-add]') && el.files.length) {
      addGalleryPhotos(el.dataset.galAdd, el.files);
      el.value = '';
    }
    if (el.matches('[data-src-back]') && el.files[0]) A.setDraftSourceBack(+el.dataset.srcBack, el.files[0]);
    if (el.matches('[id^="ev-type-"]')) A.refreshDraft();
    if (el.id === 'f-media' && el.files.length) A.addDraftMedia([...el.files]);
    if (el.id === 'kinA' || el.id === 'kinB') A.setKin(el.id, el.value);
    // City or country changed: the department follows the city, in France only
    if (el.id && (el.id.endsWith('-city') || el.id.endsWith('-country'))) departmentFromCity(el.id.replace(/-(city|country)$/, ''));
  });

  document.addEventListener('input', (ev) => {
    if (ev.target.id === 'cropZoom') cropZoomInput(ev.target.value);
    if (ev.target.id === 'find') onFindInput();
    if (ev.target.id === 'f-spouse') onSpouseInput();
    if (ev.target.id.endsWith('-dept')) {
      const label = document.getElementById(ev.target.id + 'name');
      if (label) label.textContent = departmentHint(ev.target.id.slice(0, -'-dept'.length));
    }
    if (ev.target.id === 'lib-q') setLibraryFilter(undefined, ev.target.value);
    if (ev.target.id === 'tagFind') onTagFind(ev.target.value);
    if (ev.target.id === 'q') {
      S.query = ev.target.value;
      renderRegister();
    }
  });

  document.addEventListener('submit', (ev) => {
    if (ev.target.id === 'editForm') {
      ev.preventDefault();
      A.submitEdit();
    }
    if (ev.target.id === 'newTreeForm') {
      ev.preventDefault();
      newTree(document.getElementById('newTreeName').value);
    }
    if (ev.target.id === 'renameForm') {
      ev.preventDefault();
      submitRename(ev.target.dataset.id, document.getElementById('renameInput').value);
    }
  });

  document.addEventListener('keydown', (ev) => {
    // Enlarged document with a back: the arrow keys switch sides
    if (!document.getElementById('photoZoom').hidden && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) {
      if (stepZoomFace(ev.key === 'ArrowRight' ? 1 : -1)) ev.preventDefault();
      return;
    }
    if (ev.target.id === 'find') {
      if (onFindKey(ev, (id) => A.setFocus(id, true))) ev.preventDefault();
      return;
    }
    // Whom to identify on a photo: Enter takes the first result
    if (ev.target.id === 'tagFind' && ev.key === 'Enter') {
      ev.preventDefault();
      pickFirstTag();
      return;
    }
    if (ev.target.id === 'f-spouse') {
      if (onSpouseKey(ev, A.addDraftUnion)) {
        ev.preventDefault();
        return;
      }
    }
    // Fan chart: SVG sectors are not native buttons
    if (ev.key === 'Enter' && ev.target.closest && ev.target.closest('.fan-s')) {
      openPersonDlg(ev.target.closest('.fan-s').dataset.id);
      return;
    }
    // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y: in a field, it's the input's own undo
    const key = String(ev.key || '').toLowerCase(); // no key on an autofill
    const blocked = dialogOpen();
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && (key === 'z' || key === 'y') && !typing(ev.target)
      && S.canWrite && !S.edit && !blocked) {
      ev.preventDefault();
      if (key === 'y' || ev.shiftKey) A.redo();
      else A.undo();
      return;
    }
    // Ctrl+B (Cmd+B on Mac): panel, like the VS Code side bar
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !ev.shiftKey && key === 'b' && !typing(ev.target) && !blocked) {
      ev.preventDefault();
      A.togglePanel();
      return;
    }
    // Shortcuts: "/" or Ctrl+K (Cmd+K on Mac) to search
    const shortcut = (ev.key === '/' && !typing(ev.target) && !ev.ctrlKey && !ev.metaKey && !ev.altKey)
      || (key === 'k' && (ev.ctrlKey || ev.metaKey));
    if (shortcut && !blocked) {
      ev.preventDefault();
      const find = document.getElementById('find');
      find.focus();
      find.select();
      return;
    }
    // Gallery viewer: the arrow keys go from one image to the next
    if ((ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') && !typing(ev.target)
      && !document.getElementById('mediaDlg').hidden && stepMedia(ev.key === 'ArrowLeft' ? -1 : 1)) {
      ev.preventDefault();
      return;
    }
    if (ev.key !== 'Escape') return;
    if (closeTopDialog()) return;
    if (S.edit && !S.busy) A.cancelEdit();
    else if (S.sheet) A.closeSheet();
  });
}
