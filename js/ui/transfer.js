/** "Import" and "Export" dialogs: GEDCOM, Lignée backup and GitHub repository. */
import { S, services, treeName } from '../state.js';
import { $, esc } from '../utils/dom.js';
import { pool, norm } from '../utils/helpers.js';
import { mapOf, dbSet, saveLocal, storePhotos, buildPortableBackup, beginAction, commitAction, track } from '../services/storage.js';
import { buildRegisterCsv } from '../services/csv.js';
import { buildGedcom, parseGedcom } from '../services/gedcom.js';
import { parseBackup } from '../services/backup.js';
import { openRepo, attachPhotos } from '../services/github.js';
import { afterData } from './render.js';
import { toast, reportError } from './toast.js';
import { newTree } from './trees.js';
import { linkRepo, connectTree, holdsTree, savedRepo } from './repo-link.js';
import { markExported } from '../services/exported.js';
import { renderHeader } from './header.js';
import { t } from '../i18n.js';

const inClaude = () => !!(window.claude && window.claude.use);

/** Start of exported file names, from the tree name: "lignee-famille-dupont". */
export const fileBase = () => ['lignee', norm(treeName()).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')]
  .filter(Boolean).join('-');

/* ---------- Opening / closing ---------- */

/* GitHub repository being read, when a choice must be made between several backups */
let openedRepo = null;
/* Repository the pending import comes from: { repo, backup, photos } */
let pendingRepo = null;

/** Opens the dialog on import or export, never both at once. */
export function openTransfer(mode) {
  $('#transfer').hidden = false;
  $('#trTitle').textContent = t(mode === 'import' ? 'btn.import' : 'btn.export');
  $('#exportSection').hidden = mode === 'import';
  $('#importSection').hidden = mode !== 'import';
  $('#exportHint').textContent = '';
  $('#exportText').hidden = true;
  $('#copyRow').hidden = true;
  if (!S.pending) $('#importInfo').innerHTML = '';
  $('#importFile').value = '';
  $('#repoToken').value = '';
  const known = savedRepo();
  if (known) $('#repoUrl').value = known.name;
  setTimeout(() => {
    const close = $('#transfer .icon-btn');
    if (close) close.focus();
  }, 20);
}

export function closeTransfer() {
  $('#transfer').hidden = true;
  $('#repoToken').value = '';
  openedRepo = null; // they keep the token to read the photos
  pendingRepo = null;
}

/* ---------- Export ---------- */

/** Direct download (regular browser, outside claude.ai). */
export function downloadBlob(filename, text, type) {
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
 * Offers the file to the user.
 * - Outside claude.ai: direct download.
 * - In claude.ai: the platform's download service,
 *   otherwise the text is shown for copying.
 */
/** Offers the file to the user; returns true if it was handed over (downloaded or saved). */
async function saveFile({ filename, standaloneName = filename, type, text, hint, standaloneHint = hint }) {
  const hintEl = $('#exportHint');
  $('#exportText').hidden = true;
  $('#copyRow').hidden = true;

  if (!inClaude()) {
    downloadBlob(standaloneName, text, type);
    hintEl.textContent = standaloneHint;
    return true;
  }

  if (services.downloads) {
    try {
      await services.downloads.save({ filename, data: text });
      hintEl.textContent = hint;
      return true;
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
  const saved = await saveFile({
    filename: name + '.txt',               // claude.ai doesn't accept the .ged extension
    standaloneName: name,
    type: 'text/plain;charset=utf-8',
    text: buildGedcom(),
    hint: t('tr.gedHint', name),
    standaloneHint: t('tr.gedHintStandalone', name),
  });
  if (saved) exported();
}

/** A full export (GEDCOM or backup) was handed over: the local banner stops reminding. */
function exported() {
  markExported();
  renderHeader();
}

/**
 * Downloads the tree's backup. With `v1`, in the format older Lignée (before 2.0) and scripts
 * read: each person carries copies of the documents they cite.
 */
export async function exportBackup(v1 = false) {
  if (!S.people.size) {
    $('#exportHint').textContent = t('tr.empty');
    return;
  }
  const saved = await saveFile({
    filename: fileBase() + '-' + t('tr.backupSuffix') + (v1 ? '-v1' : '') + '.json',
    type: 'application/json',
    text: await buildPortableBackup({ v1 }),
    hint: t(v1 ? 'tr.backupV1Hint' : 'tr.backupHint'),
  });
  if (saved) exported();
}

export async function exportCsv() {
  if (!S.people.size) {
    $('#exportHint').textContent = t('tr.empty');
    return;
  }
  const name = fileBase() + '-' + t('tr.csvSuffix') + '.csv';
  await saveFile({ filename: name, type: 'text/csv;charset=utf-8', text: buildRegisterCsv(), hint: t('tr.csvHint', name) });
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

/** Holds what was read and offers to import it. */
function offerImport(result, source, note = '', actions = null) {
  S.pending = result;
  $('#importInfo').innerHTML = `<p>${t('tr.found', result.people.length, result.unions.length, esc(source))}</p>${note}`
    + '<div class="row-btns import-actions">'
    + (actions || `<button class="btn primary" type="button" data-act="import-go">${t('tr.addTo', esc(treeName()))}</button>`
      + `<button class="btn" type="button" data-act="import-new">${t('tr.newTree')}</button>`)
    + '</div>';
}

/** Reads the chosen file and shows what it contains, without importing it yet. */
export async function readImportFile(input) {
  const file = input.files && input.files[0];
  const info = $('#importInfo');
  if (!file) return;

  let result = null;
  try {
    const text = await file.text();
    result = /^\s*\{/.test(text) ? parseBackup(text) : parseGedcom(text);
  } catch (e) {
    if (e.code === 'newer') {
      S.pending = null;
      info.innerHTML = `<p class="err">${t('backup.newer')}</p>`;
      return;
    }
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

/** True if the open tree contains something other than the example family. */
const ownTree = () => [...S.people.values()].some((p) => !p.example);

/** Alternative when the repository holds another backup: link the open tree to it, if it has content. */
const connectChoice = (repo) => (repo.write && ownTree()
  ? `<button class="btn" type="button" data-act="repo-connect-open">${t('tr.repoConnectTree', esc(treeName()))}</button>` : '');

/** Loads the photos of the chosen backup and opens it in a new tree, unless a choice remains to be made. */
async function offerRepoBackup(repo, backup) {
  $('#importInfo').innerHTML = `<p>${t('tr.repoLoading')}</p>`;
  const { found, missing, photos, base } = await attachPhotos(repo, backup);
  pendingRepo = { repo, backup, photos, base };
  backup.fileName = backup.path.split('/').pop().replace(/\.json$/i, '');
  const note = (found || missing ? `<p>${t('tr.repoPhotos', found, missing)}</p>` : '')
    + `<p>${t(repo.write ? 'tr.repoMode.write' : 'tr.repoMode.read')}</p>`;
  const choice = connectChoice(repo);
  offerImport(backup, repo.name + ' / ' + backup.path, note, `<button class="btn primary" type="button" data-act="import-new">${t('tr.newTree')}</button>${choice}`);
  if (choice) return;
  await importGo(true);
  if (!S.pending && missing) toast(t('tr.repoPhotos', found, missing));
}

/** Links the open tree to the repository. The example family doesn't go there: a new tree takes its place. */
async function connectOpenTree(repo) {
  if (S.people.size && !ownTree() && !(await newTree(repo.name.split('/').pop()))) return;
  await connectTree(repo);
  closeTransfer();
  toast(t('tr.repoConnected', treeName()));
}

/**
 * Reads the given repository and does what the token and its content allow: link the open tree if
 * there's nothing to load or if its backup is already there; otherwise open the repository's backup in a new tree.
 */
export async function connectRepo(button) {
  const info = $('#importInfo');
  S.pending = null;
  openedRepo = null;
  pendingRepo = null;
  button.disabled = true;
  info.innerHTML = `<p>${t('tr.repoLoading')}</p>`;
  const token = $('#repoToken').value.trim();
  $('#repoToken').value = ''; // cleared as soon as it is read, even if loading fails
  try {
    const repo = await openRepo($('#repoUrl').value, token, true);
    if (!repo.backups.length && !repo.write) throw Object.assign(new Error('needWrite'), { code: token ? 'readOnly' : 'needToken' });
    if (repo.write && (!repo.backups.length || (ownTree() && holdsTree(repo)))) {
      await connectOpenTree(repo);
      return;
    }
    if (repo.backups.length === 1) {
      await offerRepoBackup(repo, repo.backups[0]);
      return;
    }
    openedRepo = repo;
    info.innerHTML = `<p>${t('tr.repoPick')}</p><div class="row-btns import-actions">`
      + repo.backups.map((b, i) => `<button class="btn" type="button" data-act="import-repo-pick" data-i="${i}">${esc(b.path)}</button>`).join('')
      + connectChoice(repo)
      + '</div>';
  } catch (e) {
    repoFailed(e);
  } finally {
    button.disabled = false;
  }
}

/** Links the open tree to the repository read, rather than importing its backup: the save button appears. */
export async function connectOpenedRepo() {
  const repo = openedRepo || (pendingRepo && pendingRepo.repo);
  if (!repo) return;
  openedRepo = null;
  pendingRepo = null;
  S.pending = null;
  try {
    await connectOpenTree(repo);
  } catch (e) {
    repoFailed(e);
  }
}

/** Backup chosen among those in the repository. */
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
 * Adds the people then the unions read, to the open tree or to
 * a new tree (asNew). Resumes where it stopped in case of error.
 */
export async function importGo(asNew) {
  const result = S.pending;
  if (!result || !S.canWrite) return;
  const info = $('#importInfo');
  if (asNew) {
    if (!(await newTree(result.name || result.fileName || t('tr.importedName')))) return;
    $('#transfer').hidden = false; // opening the tree doesn't close this dialog
  }
  const wasEmpty = S.people.size === 0;

  const items = [
    ...(result.sources || []).map((x) => ['sources', x]),
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
    await pool(items.filter(([c]) => c === 'sources'), 4, write); // before the people who cite them
    await pool(items.filter(([c]) => c === 'people'), 4, write);
    await pool(items.filter(([c]) => c === 'unions'), 4, write);
    await storePhotos(); // file mode: imported photos become files
    if (S.mode !== 'db') await saveLocal();
    commitAction();

    // A tree that already had other people doesn't go back to the repository
    if (pendingRepo && pendingRepo.backup === result && (asNew || wasEmpty)) linkRepo(pendingRepo.repo, result, pendingRepo.photos, pendingRepo.base);
    pendingRepo = null;
    S.pending = null;
    const n = result.people.length;
    info.innerHTML = `<p class="okmsg">${t('tr.doneInfo', n)}</p>`;
    if (wasEmpty) S.focus = null; // lets the best-documented person be chosen
    S.scrollPending = true;
    afterData();
    toast(t('tr.done'));
    if (asNew) closeTransfer();
  } catch (e) {
    reportError(e);
    if (S.mode !== 'db') await Promise.resolve(saveLocal()).catch(() => {}); // message already shown
    commitAction();
    info.innerHTML = `<p class="err">${t('tr.stopped', done, total)}</p>`
      + `<button class="btn primary" type="button" data-act="import-go">${t('tr.resume')}</button>`;
    afterData();
  }
}
