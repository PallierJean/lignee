/**
 * Écoute des événements de la page.
 * Chaque élément cliquable porte un attribut data-act qui désigne l'action à lancer.
 */
import { S } from './state.js';
import { avatarOf, birthSurname, DATED_SITUATIONS, situationOfUnion } from './model/people.js';
import { situationOptions } from './ui/form.js';
import * as A from './actions.js';
import {
  openTransfer, closeTransfer, exportGedcom, exportBackup, exportCsv, copyExport, readImportFile, importGo, pickRepoBackup, connectRepo, connectOpenedRepo,
} from './ui/transfer.js';
import { renderRegistre } from './ui/registre.js';
import {
  startLocate, placeRowValue, startInsee, restartInsee, inseeSendCode, inseeSendAuth, inseeOtherEmail,
} from './ui/analyse.js';
import { departmentHint, departmentFromCity } from './ui/form.js';
import { openMedia, closeMedia, placePin, cancelPin, addTag, removeTag } from './ui/media.js';
import { openPersonDlg, closePersonDlg } from './ui/person-dlg.js';
import { onFindInput, onFindKey, closeFind, pickFind, showAllFind } from './ui/search.js';
import { onSpouseInput, onSpouseKey, closeSpouse } from './ui/spouse-pick.js';
import { confirmRepoSave, saveRepo, forgetRepo } from './ui/repo-link.js';
import { openPrint, closePrint, updatePrintInfo, printTree, printFamilyBook } from './ui/print.js';
import {
  openTrees, closeTrees, switchTree, newTree, askTree, cancelTreeEdit, submitRename, confirmDeleteTree,
} from './ui/trees.js';

/** Vrai si l'utilisateur est en train d'écrire dans un champ. */
const typing = (el) => !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);

/** Formulaire sans photo : affiche l'avatar du sexe choisi. */
function updateFormAvatar(sex) {
  const img = document.getElementById('f-avatar');
  if (!img) return;
  const src = avatarOf(sex);
  if (src) img.src = src;
  img.hidden = !src;
  document.getElementById('f-avatar-empty').hidden = !!src;
}

/** Formulaire : accorde les libellés de la situation (« Marié », « Mariée ») au sexe choisi. */
function updateSituationLabels(sex) {
  const select = document.getElementById('f-situ');
  if (!select) return;
  const situation = select.value;
  select.innerHTML = situationOptions({ situation, sex });
}

/** Formulaire : indice de la dernière union, celle qui donne la situation (-1 s'il n'y en a pas). */
const lastUnionRow = () => (S.edit ? S.edit.unions.findLastIndex((u) => !u.removed) : -1);

/** Formulaire : la cause ne s'affiche que pour un remariage, le conjoint décédé que pour un veuvage. */
function updateUnionCause(i) {
  const remarried = document.getElementById('u-type-' + i).value === 'remarried';
  document.getElementById('u-cause-row-' + i).hidden = !remarried;
  document.getElementById('u-former-row-' + i).hidden = document.getElementById('u-cause-' + i).value !== 'widowed';
}

/** Formulaire : la situation suit la dernière union. */
function situationFromUnion(i) {
  if (i !== lastUnionRow()) return;
  const select = document.getElementById('f-situ');
  const type = document.getElementById('u-type-' + i).value;
  let end = document.getElementById('u-end-' + i).value;
  // Union close par le décès de la personne elle-même : elle n'est pas veuve
  if (end === 'death' && (document.getElementById('f-ddate').value.trim() || document.getElementById('f-deceased').checked)) end = '';
  const code = situationOfUnion(type, end);
  if (!code || (code === 'married' && select.value === 'remarried' && type !== 'remarried' && !end)) return;
  select.value = code;
  document.getElementById('f-situdate-row').hidden = !DATED_SITUATIONS.has(code);
  document.getElementById('f-situdate').value = DATED_SITUATIONS.has(code) ? document.getElementById('u-date-' + i).value : '';
}

/** Formulaire : la dernière union suit la situation. */
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
 * Formulaire : déduit le nom de naissance du nom du père (ou de la mère).
 * Il remplit le nom de famille quand les parents changent, et le nom de jeune fille d'une femme.
 */
function updateNames(parentsChanged) {
  const father = document.getElementById('f-father');
  if (!father) return;
  const auto = birthSurname(father.value, document.getElementById('f-mother').value);
  const fill = (input) => {
    // On ne remplace pas un nom saisi à la main
    const v = input.value.trim().toUpperCase();
    if (v && v !== (input.dataset.auto || '').toUpperCase()) return;
    input.value = auto;
    input.dataset.auto = auto;
  };
  if (parentsChanged) fill(document.getElementById('f-surname'));
  const sex = document.querySelector('input[name="f-sex"]:checked');
  if (sex && sex.value === 'F') fill(document.getElementById('f-maiden'));
}

/** Agrandit la photo d'une fiche au centre de l'écran. */
function openPhotoZoom(img) {
  const big = document.getElementById('photoZoomImg');
  big.src = img.src;
  big.alt = img.alt;
  document.getElementById('photoZoom').hidden = false;
}

function closePhotoZoom() {
  document.getElementById('photoZoom').hidden = true;
}

/** Désactive le bouton pendant une action longue. */
const once = (fn) => (el) => {
  el.disabled = true;
  return fn(el);
};

const CLICK_ACTIONS = {
  // Photo de la fiche
  'photo-zoom': (el) => openPhotoZoom(el),

  // Fiche en fenêtre
  'person-open': (el) => openPersonDlg(el.dataset.id),
  'person-close': () => closePersonDlg(),
  'person-center': (el) => {
    closePersonDlg();
    A.setFocus(el.dataset.id);
  },
  'person-edit': (el) => {
    if (S.edit) return A.setFocus(el.dataset.id); // affiche le message « Enregistrez ou annulez… »
    closePersonDlg();
    A.setFocus(el.dataset.id);
    A.startEdit(el.dataset.id);
  },

  // Arbre et navigation
  focus: (el) => A.setFocus(el.dataset.id, !!el.closest('#reglist')),
  tab: (el) => A.setTab(el.dataset.tab),
  up: (el) => A.setGenerations('up', +el.dataset.n),
  down: (el) => A.setGenerations('down', +el.dataset.n),
  zoom: (el) => A.zoomBy(+el.dataset.d),
  center: () => A.recenter(),
  full: () => A.toggleFull(),
  fan: () => A.toggleFan(),
  line: () => A.toggleLine(),
  panel: () => A.togglePanel(),
  lang: () => A.toggleLang(),
  undo: () => A.undo(),
  redo: () => A.redo(),

  // Analyse
  'analyse-view': (el) => A.setAnalyseView(el.dataset.view),
  'cal-month': (el) => A.shiftMonth(+el.dataset.d),
  'kin-open': (el) => A.openKin(el.dataset.id),
  'kin-show': () => A.showKin(),
  'kin-hide': () => A.hideKin(),
  'dup-merge': once((el) => A.mergePeople(el.dataset.keep, el.dataset.drop)),
  'dup-ignore': (el) => A.ignoreDuplicate(el.dataset.key),
  'time-scope': (el) => A.setTimeScope(el.dataset.family === 'true'),
  'map-locate': () => startLocate(),
  'place-rename': (el) => A.renamePlace(el.dataset.from, placeRowValue(+el.dataset.i)),
  'insee-check': () => startInsee(),
  'insee-register': () => inseeSendCode(),
  'insee-auth': () => inseeSendAuth(),
  'insee-restart-login': () => inseeOtherEmail(),
  'insee-forget': () => restartInsee(),
  'insee-apply': once((el) => A.applyInsee(el.dataset.id, el.dataset.i === undefined ? undefined : +el.dataset.i)),
  'insee-ignore': (el) => A.ignoreInseeOf(el.dataset.id),
  'insee-confirm': (el) => A.confirmInseeOf(el.dataset.id),

  // Galerie
  'media-open': (el) => openMedia(el.dataset.owner, el.dataset.id),
  'media-close': () => closeMedia(),
  'media-person': (el) => {
    closeMedia();
    openPersonDlg(el.dataset.id);
  },
  'media-pic': (el, ev) => placePin(el, ev),
  'tag-cancel': () => cancelPin(),
  'tag-remove': (el) => removeTag(+el.dataset.i),

  // Collection d'arbres
  'trees-open': () => openTrees(),
  'trees-close': () => closeTrees(),
  'tree-open': (el) => switchTree(el.dataset.id),
  'tree-rename': (el) => askTree('rename', el.dataset.id),
  'tree-delete': (el) => askTree('delete', el.dataset.id),
  'tree-cancel': () => cancelTreeEdit(),
  'tree-delete-yes': once((el) => confirmDeleteTree(el.dataset.id)),

  // Impression
  'print-open': () => openPrint(),
  'print-close': () => closePrint(),
  'print-go': () => printTree(),
  'family-book': (el) => {
    closePersonDlg();
    printFamilyBook(el.dataset.id);
  },

  // Recherche rapide
  'find-pick': (el) => pickFind(el.dataset.id, (id) => A.setFocus(id, true)),
  'find-all': () => showAllFind(() => A.setTab('registre')),
  'spouse-pick': (el) => A.addDraftUnion(el.dataset.id),

  // Ajout et modification
  new: () => A.startNew(),
  add: (el) => A.startAdd(el.dataset.rel, el.dataset.of, el.dataset.with),
  edit: () => A.startEdit(S.focus),
  'cancel-edit': () => A.cancelEdit(),
  'u-remove': (el) => A.removeDraftUnion(+el.dataset.i),
  'photo-remove': () => A.removeDraftPhoto(),
  'ev-add': () => A.addDraftEvent(),
  'ev-remove': (el) => A.removeDraftEvent(+el.dataset.i),
  'src-add': () => A.addDraftSource(),
  'med-remove': (el) => A.removeDraftMedia(+el.dataset.i),
  'src-remove': (el) => A.removeDraftSource(+el.dataset.i),
  'src-photo-remove': (el) => A.removeDraftSourcePhoto(+el.dataset.i),

  // Suppression
  'delete-ask': (el) => A.confirmDelete(true, el.dataset.id || S.focus),
  'delete-no': () => A.confirmDelete(false),
  'delete-yes': once((el) => A.doDelete(el.dataset.id || S.focus)),
  // Formulaire : la confirmation s'affiche sans redessiner la saisie en cours
  'form-delete-ask': (el) => {
    document.getElementById('f-delconfirm').hidden = false;
    el.hidden = true;
  },
  'form-delete-no': () => {
    document.getElementById('f-delconfirm').hidden = true;
    document.querySelector('.f-del').hidden = false;
  },

  // Famille d'exemple
  'banner-close': (el) => A.closeBanner(el.dataset.kind),
  'ex-ask': () => A.confirmRemoveExamples(true),
  'ex-no': () => A.confirmRemoveExamples(false),
  'ex-yes': once(() => A.removeExamples()),

  // Importer, exporter
  'import-open': () => openTransfer('import'),
  'export-open': () => openTransfer('export'),
  'transfer-close': () => closeTransfer(),
  'export-ged': () => exportGedcom(),
  'export-json': () => exportBackup(),
  'export-csv': () => exportCsv(),
  'registre-csv': () => {
    openTransfer('export');
    exportCsv();
  },
  'copy-export': () => copyExport(),
  'repo-connect': (el) => connectRepo(el),
  'repo-connect-open': once(connectOpenedRepo),
  'repo-reconnect': () => {
    openTransfer('import');
    setTimeout(() => document.getElementById('repoToken').focus(), 40);
  },
  'repo-save': once(() => saveRepo(false)),
  'repo-save-no': () => confirmRepoSave(false),
  'repo-save-yes': once(() => saveRepo(true)),
  'repo-forget': () => forgetRepo(),
  'import-repo-pick': once((el) => pickRepoBackup(+el.dataset.i)),
  'import-go': once(() => importGo(false)),
  'import-new': once(() => importGo(true)),
};

export function bindEvents() {
  // Un clic dans les suggestions ne doit pas retirer le curseur du champ de recherche
  document.getElementById('findList').addEventListener('mousedown', (ev) => ev.preventDefault());
  document.getElementById('find').addEventListener('focus', onFindInput);
  document.getElementById('find').addEventListener('blur', () => closeFind(false));

  // Champ d'ajout d'une union : le formulaire est recréé à chaque rendu, d'où la délégation
  document.addEventListener('mousedown', (ev) => {
    if (ev.target.closest('#f-spouseList')) ev.preventDefault();
  });
  document.addEventListener('focusin', (ev) => {
    if (ev.target.id === 'f-spouse') onSpouseInput();
  });
  document.addEventListener('focusout', (ev) => {
    if (ev.target.id === 'f-spouse') closeSpouse();
  });

  document.addEventListener('click', (ev) => {
    // Photo agrandie : n'importe quel clic la ferme
    if (!document.getElementById('photoZoom').hidden) {
      closePhotoZoom();
      return;
    }
    // Clic sur le fond d'une fenêtre : on la ferme
    if (ev.target.id === 'transfer') {
      closeTransfer();
      return;
    }
    if (ev.target.id === 'printDlg') {
      closePrint();
      return;
    }
    if (ev.target.id === 'treesDlg') {
      closeTrees();
      return;
    }
    if (ev.target.id === 'personDlg') {
      closePersonDlg();
      return;
    }
    if (ev.target.id === 'mediaDlg') {
      closeMedia();
      return;
    }
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
    if (el.matches('[id^="ev-type-"]')) A.refreshDraft();
    if (el.id === 'f-media' && el.files.length) A.addDraftMedia([...el.files]);
    if (el.id === 'tagPerson' && el.value) addTag(el.value);
    if (el.id === 'kinA' || el.id === 'kinB') A.setKin(el.id, el.value);
    // Ville ou pays changés : le département suit la ville, en France seulement
    if (el.id && (el.id.endsWith('-city') || el.id.endsWith('-country'))) departmentFromCity(el.id.replace(/-(city|country)$/, ''));
  });

  document.addEventListener('input', (ev) => {
    if (ev.target.id === 'find') onFindInput();
    if (ev.target.id === 'f-spouse') onSpouseInput();
    if (ev.target.id.endsWith('-dept')) {
      const label = document.getElementById(ev.target.id + 'name');
      if (label) label.textContent = departmentHint(ev.target.id.slice(0, -'-dept'.length));
    }
    if (ev.target.id === 'q') {
      S.query = ev.target.value;
      renderRegistre();
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
    if (ev.target.id === 'find') {
      if (onFindKey(ev, (id) => A.setFocus(id, true))) ev.preventDefault();
      return;
    }
    if (ev.target.id === 'f-spouse') {
      if (onSpouseKey(ev, A.addDraftUnion)) {
        ev.preventDefault();
        return;
      }
    }
    // Roue d'ascendance : les secteurs SVG ne sont pas des boutons natifs
    if (ev.key === 'Enter' && ev.target.closest && ev.target.closest('.fan-s')) {
      openPersonDlg(ev.target.closest('.fan-s').dataset.id);
      return;
    }
    // Ctrl+Z / Ctrl+Maj+Z / Ctrl+Y : dans un champ, c'est l'annulation de la saisie
    const key = String(ev.key || '').toLowerCase(); // pas de touche sur un remplissage automatique
    const dialogOpen = ['transfer', 'printDlg', 'treesDlg', 'personDlg', 'mediaDlg', 'photoZoom'].some((id) => !document.getElementById(id).hidden);
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && (key === 'z' || key === 'y') && !typing(ev.target)
      && S.canWrite && !S.edit && !dialogOpen) {
      ev.preventDefault();
      if (key === 'y' || ev.shiftKey) A.redo();
      else A.undo();
      return;
    }
    // Ctrl+B (Cmd+B sur Mac) : panneau, comme la barre latérale de VS Code
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !ev.shiftKey && key === 'b' && !typing(ev.target) && !dialogOpen) {
      ev.preventDefault();
      A.togglePanel();
      return;
    }
    // Raccourcis : « / » ou Ctrl+K (Cmd+K sur Mac) pour rechercher
    const shortcut = (ev.key === '/' && !typing(ev.target) && !ev.ctrlKey && !ev.metaKey && !ev.altKey)
      || (key === 'k' && (ev.ctrlKey || ev.metaKey));
    if (shortcut && !dialogOpen) {
      ev.preventDefault();
      const find = document.getElementById('find');
      find.focus();
      find.select();
      return;
    }
    if (ev.key !== 'Escape') return;
    if (!document.getElementById('photoZoom').hidden) {
      closePhotoZoom();
      return;
    }
    if (!document.getElementById('mediaDlg').hidden) {
      closeMedia();
      return;
    }
    if (!document.getElementById('personDlg').hidden) {
      closePersonDlg();
      return;
    }
    if (!document.getElementById('transfer').hidden) {
      closeTransfer();
      return;
    }
    if (!document.getElementById('printDlg').hidden) {
      closePrint();
      return;
    }
    if (!document.getElementById('treesDlg').hidden) {
      if (S.treeEdit) cancelTreeEdit();
      else closeTrees();
      return;
    }
    if (S.edit && !S.busy) A.cancelEdit();
  });
}
