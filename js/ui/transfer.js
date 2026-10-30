/** Fenêtre « Importer / exporter » : GEDCOM, sauvegarde Lignée et dépôt GitHub. */
import { S, services, treeName } from '../state.js';
import { $, esc } from '../utils/dom.js';
import { pool, norm } from '../utils/helpers.js';
import { mapOf, dbSet, saveLocal, storePhotos, buildPortableBackup, beginAction, commitAction, track } from '../services/storage.js';
import { buildRegistreCsv } from '../services/csv.js';
import { buildGedcom, parseGedcom } from '../services/gedcom.js';
import { parseBackup } from '../services/backup.js';
import { openRepo, attachPhotos } from '../services/github.js';
import { afterData } from './render.js';
import { toast } from './toast.js';
import { newTree } from './trees.js';
import { t } from '../i18n.js';

const inClaude = () => !!(window.claude && window.claude.use);

/** Début du nom des fichiers exportés, d'après le nom de l'arbre : « lignee-famille-dupont ». */
const fileBase = () => ['lignee', norm(treeName()).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')]
  .filter(Boolean).join('-');

/* ---------- Ouverture / fermeture ---------- */

/* Dépôt GitHub en cours de lecture, quand il faut choisir entre plusieurs sauvegardes */
let openedRepo = null;

export function openTransfer() {
  $('#transfer').hidden = false;
  $('#exportHint').textContent = '';
  $('#exportText').hidden = true;
  $('#copyRow').hidden = true;
  if (!S.pending) $('#importInfo').innerHTML = '';
  $('#importFile').value = '';
  $('#repoToken').value = '';
  setTimeout(() => {
    const close = $('#transfer .icon-btn');
    if (close) close.focus();
  }, 20);
}

export function closeTransfer() {
  $('#transfer').hidden = true;
  $('#repoToken').value = '';
  openedRepo = null; // il garde le jeton pour lire les photos
}

/* ---------- Export ---------- */

/** Téléchargement direct (navigateur classique, hors claude.ai). */
function downloadBlob(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Propose le fichier à l'utilisateur.
 * - Hors claude.ai : téléchargement direct.
 * - Dans claude.ai : service de téléchargement de la plateforme,
 *   sinon affichage du texte à copier.
 */
async function saveFile({ filename, standaloneName = filename, type, text, hint, standaloneHint = hint }) {
  const hintEl = $('#exportHint');
  $('#exportText').hidden = true;
  $('#copyRow').hidden = true;

  if (!inClaude()) {
    downloadBlob(standaloneName, text, type);
    hintEl.textContent = standaloneHint;
    return;
  }

  if (services.downloads) {
    try {
      await services.downloads.save({ filename, data: text });
      hintEl.textContent = hint;
      return;
    } catch (e) {
      const code = e && e.code;
      if (code === 'declined') {
        hintEl.textContent = t('tr.declined');
        return;
      }
      if (code === 'rate_limited') {
        hintEl.textContent = t('tr.rateLimited');
        return;
      }
    }
  }

  hintEl.textContent = t('tr.noDownload');
  const textarea = $('#exportText');
  textarea.value = text;
  textarea.hidden = false;
  $('#copyRow').hidden = false;
}

export async function exportGedcom() {
  if (!S.people.size) {
    $('#exportHint').textContent = t('tr.empty');
    return;
  }
  const name = fileBase() + '.ged';
  await saveFile({
    filename: name + '.txt',               // claude.ai n'accepte pas l'extension .ged
    standaloneName: name,
    type: 'text/plain;charset=utf-8',
    text: buildGedcom(),
    hint: t('tr.gedHint', name),
    standaloneHint: t('tr.gedHintStandalone', name),
  });
}

export async function exportBackup() {
  if (!S.people.size) {
    $('#exportHint').textContent = t('tr.empty');
    return;
  }
  await saveFile({
    filename: fileBase() + '-' + t('tr.backupSuffix') + '.json',
    type: 'application/json',
    text: await buildPortableBackup(),
    hint: t('tr.backupHint'),
  });
}

export async function exportCsv() {
  if (!S.people.size) {
    $('#exportHint').textContent = t('tr.empty');
    return;
  }
  const name = fileBase() + '-' + t('tr.csvSuffix') + '.csv';
  await saveFile({ filename: name, type: 'text/csv;charset=utf-8', text: buildRegistreCsv(), hint: t('tr.csvHint', name) });
}

export async function copyExport() {
  const textarea = $('#exportText');
  try {
    await navigator.clipboard.writeText(textarea.value);
    toast(t('tr.copied'));
  } catch (e) {
    textarea.focus();
    textarea.select();
    toast(t('tr.selected'));
  }
}

/* ---------- Import ---------- */

/** Met en attente ce qui a été lu et propose de l'importer. */
function offerImport(result, source, note = '') {
  S.pending = result;
  $('#importInfo').innerHTML = `<p>${t('tr.found', result.people.length, result.unions.length, esc(source))}</p>${note}`
    + '<div class="row-btns import-actions">'
    + `<button class="btn primary" type="button" data-act="import-go">${t('tr.addTo', esc(treeName()))}</button>`
    + `<button class="btn" type="button" data-act="import-new">${t('tr.newTree')}</button>`
    + '</div>';
}

/** Lit le fichier choisi et affiche ce qu'il contient, sans encore l'importer. */
export async function readImportFile(input) {
  const file = input.files && input.files[0];
  const info = $('#importInfo');
  if (!file) return;

  let result = null;
  try {
    const text = await file.text();
    result = /^\s*\{/.test(text) ? parseBackup(text) : parseGedcom(text);
  } catch (e) {
    result = null;
  }

  if (!result || !result.people.length) {
    S.pending = null;
    info.innerHTML = `<p class="err">${t('tr.unreadable')}</p>`;
    return;
  }

  result.fileName = file.name.replace(/\.[^.]+$/, '');
  offerImport(result, file.name);
}

function repoFailed(e) {
  S.pending = null;
  $('#importInfo').innerHTML = `<p class="err">${t('tr.repoErr.' + (e.code || 'failed'))}</p>`;
}

/** Charge les photos de la sauvegarde choisie et la propose à l'import. */
async function offerRepoBackup(repo, backup) {
  $('#importInfo').innerHTML = `<p>${t('tr.repoLoading')}</p>`;
  const { found, missing } = await attachPhotos(repo, backup);
  backup.fileName = backup.path.split('/').pop().replace(/\.json$/i, '');
  const note = found || missing ? `<p>${t('tr.repoPhotos', found, missing)}</p>` : '';
  offerImport(backup, repo.name + ' / ' + backup.path, note);
}

/** Lit le dépôt indiqué et affiche ce qu'il contient, sans encore l'importer. */
export async function importRepo(button) {
  const info = $('#importInfo');
  S.pending = null;
  openedRepo = null;
  button.disabled = true;
  info.innerHTML = `<p>${t('tr.repoLoading')}</p>`;
  const token = $('#repoToken').value.trim();
  $('#repoToken').value = ''; // effacé dès sa lecture, même si le chargement échoue
  try {
    const repo = await openRepo($('#repoUrl').value, token);
    if (repo.backups.length === 1) {
      await offerRepoBackup(repo, repo.backups[0]);
      return;
    }
    openedRepo = repo;
    info.innerHTML = `<p>${t('tr.repoPick')}</p><div class="row-btns import-actions">`
      + repo.backups.map((b, i) => `<button class="btn" type="button" data-act="import-repo-pick" data-i="${i}">${esc(b.path)}</button>`).join('')
      + '</div>';
  } catch (e) {
    repoFailed(e);
  } finally {
    button.disabled = false;
  }
}

/** Sauvegarde choisie parmi celles du dépôt. */
export async function pickRepoBackup(i) {
  const repo = openedRepo;
  if (!repo || !repo.backups[i]) return;
  openedRepo = null;
  try {
    await offerRepoBackup(repo, repo.backups[i]);
  } catch (e) {
    repoFailed(e);
  }
}

/**
 * Ajoute à l'arbre les personnes puis les unions lues, dans l'arbre ouvert ou dans
 * un nouvel arbre (asNew). Reprend là où il s'est arrêté en cas d'erreur.
 */
export async function importGo(asNew) {
  const result = S.pending;
  if (!result || !S.canWrite) return;
  const info = $('#importInfo');
  if (asNew) {
    if (!(await newTree(result.name || result.fileName || t('tr.importedName')))) return;
    $('#transfer').hidden = false; // l'ouverture de l'arbre ne ferme pas cette fenêtre
  }
  const wasEmpty = S.people.size === 0;

  const items = [
    ...result.people.map((x) => ['people', x]),
    ...result.unions.map((x) => ['unions', x]),
  ].filter(([, x]) => !x.done);
  const total = items.length;
  let done = 0;
  const showProgress = () => { info.innerHTML = `<p>${t('tr.progress', done, total)}</p>`; };
  showProgress();

  beginAction('hist.import');
  try {
    const write = async ([collection, x]) => {
      track(collection, x.id);
      mapOf(collection).set(x.id, x.data);
      if (S.mode === 'db') await dbSet(collection, x.id, x.data);
      x.done = true;
      done++;
      if (done % 10 === 0 || done === total) showProgress();
    };
    await pool(items.filter(([c]) => c === 'people'), 4, write);
    await pool(items.filter(([c]) => c === 'unions'), 4, write);
    await storePhotos(); // mode file : les photos importées deviennent des fichiers
    if (S.mode !== 'db') await saveLocal();
    commitAction();

    S.pending = null;
    const n = result.people.length;
    info.innerHTML = `<p class="okmsg">${t('tr.doneInfo', n)}</p>`;
    if (wasEmpty) S.focus = null; // laisse choisir la personne la mieux renseignée
    S.scrollPending = true;
    afterData();
    toast(t('tr.done'));
  } catch (e) {
    if (S.mode !== 'db') await Promise.resolve(saveLocal()).catch(() => {}); // message déjà affiché
    commitAction();
    info.innerHTML = `<p class="err">${t('tr.stopped', done, total)}</p>`
      + `<button class="btn primary" type="button" data-act="import-go">${t('tr.resume')}</button>`;
    afterData();
  }
}
