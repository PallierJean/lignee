/**
 * GitHub repository linked to the open tree: banner and save.
 * The repository address is remembered per tree; the token stays in memory, never stored.
 */
import { S, treeName } from '../state.js';
import { REPO_KEY } from '../config.js';
import { $, esc } from '../utils/dom.js';
import { norm } from '../utils/helpers.js';
import {
  buildPortableBackup, convertPhotos, opSet, opDelete, inBatch, storePhotos, saveLocal, beginAction, commitAction, mapOf,
} from '../services/storage.js';
import { pushBackup, attachPhotos, readLatest, SENT_NAME } from '../services/github.js';
import { mergeRecords, backupRecords, canonical, diffRecords, imagesOf } from '../services/merge.js';
import { fullName, isPhotoData } from '../model/people.js';
import { afterData } from './render.js';
import { toast } from './toast.js';
import { markExported } from '../services/exported.js';
import { t } from '../i18n.js';

function savedRepos() {
  try {
    return JSON.parse(localStorage.getItem(REPO_KEY)) || {};
  } catch (e) {
    return {}; // unreadable data or blocked storage
  }
}

function writeRepos(all) {
  try {
    localStorage.setItem(REPO_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage blocked: the link lasts until the page is closed */
  }
}

/** Repository remembered for the open tree: { name, path, head }, or null. */
export const savedRepo = () => savedRepos()[S.tree] || null;

const remember = (link) => writeRepos({ ...savedRepos(), [link.tree]: { name: link.name, path: link.path, head: link.repo.head } });

const NO_BASE = () => ({ people: new Map(), unions: new Map(), sources: new Map() });
const COLLECTIONS = ['people', 'unions', 'sources'];
const MERGE_TRIES = 3; // the repository may change again while we merge

function setLink(repo, path, photos, mustConfirm, base) {
  S.repoLink = { tree: S.tree, name: repo.name, path, repo, photos, mustConfirm, base: base || NO_BASE() };
  S.repoError = '';
  S.repoConflicts = null;
  S.repoSavedAt = '';
  remember(S.repoLink);
}

/** Links the imported tree to the repository. In read-only mode, nothing containing the token is kept. */
export function linkRepo(repo, backup, photos, base) {
  if (repo.write) {
    setLink(repo, backup.path, photos, false, base);
    return;
  }
  S.repoLink = { tree: S.tree, name: repo.name, path: backup.path };
}

/** Files of the open tree in this repository: the one already tracked, the one bearing its name. */
function treePaths(repo) {
  const known = savedRepo();
  const slug = norm(treeName()).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'arbre';
  return [known && known.name === repo.name ? known.path : '', `${slug}.json`];
}

/** True if the repository already holds the open tree's backup. */
export const holdsTree = (repo) => repo.backups.some((b) => treePaths(repo).includes(b.path));

/**
 * Links the open tree to the repository, empty or not. Resumes the backup already tracked, the one
 * named after the tree or the only one in the repository; otherwise a new file, named after the tree.
 * Replacing a backup you didn't write yourself will ask for confirmation.
 */
export async function connectTree(repo) {
  const known = savedRepo();
  const paths = treePaths(repo);
  const backup = repo.backups.find((b) => paths.includes(b.path))
    || (repo.backups.length === 1 ? repo.backups[0] : null);
  const path = backup ? backup.path : paths[0] || paths[1];
  const { photos, base } = backup ? await attachPhotos(repo, backup) : { photos: new Map() };
  setLink(repo, path, photos, !!backup && !(known && known.head === repo.head), base);
  renderRepoBanner();
}

export function renderRepoBanner() {
  const el = $('#repoBanner');
  const link = S.repoLink && S.repoLink.tree === S.tree ? S.repoLink : null;
  const known = link ? null : savedRepo();
  if (!link && !known) {
    el.hidden = true;
    return;
  }
  const forget = `<button class="btn small" type="button" data-act="repo-forget">${t('repo.forget')}</button>`;
  el.hidden = false;
  if (known) {
    el.className = 'banner repo-banner read';
    el.innerHTML = `<p>${t('repo.reconnect', esc(known.name))}</p><div class="acts">`
      + `<button class="btn small primary" type="button" data-act="repo-reconnect">${t('repo.reconnectBtn')}</button>${forget}</div>`;
    return;
  }
  const name = esc(link.name);
  if (!link.repo) {
    el.className = 'banner repo-banner read';
    el.innerHTML = `<p>${t('repo.read', name)}</p><div class="acts">${forget}</div>`;
    return;
  }
  const conflicts = S.repoConflicts;
  const actions = conflicts
    ? `<span>${t('repo.conflicts', conflicts.length, esc(conflicts.slice(0, 5).join(', ')) + (conflicts.length > 5 ? '…' : ''))}</span>`
      + `<button class="btn small danger" type="button" data-act="repo-keep-mine">${t('repo.keepMine')}</button>`
      + `<button class="btn small" type="button" data-act="repo-keep-theirs">${t('repo.keepTheirs')}</button>`
      + `<button class="btn small" type="button" data-act="repo-save-no">${t('cancel')}</button>`
    // The button only when needed: the first save of a backup written elsewhere, or after a failure;
    // otherwise each change goes by itself
    : (link.mustConfirm || S.repoError ? `<button class="btn small danger" type="button" data-act="repo-save">${t(S.repoError ? 'repo.retry' : 'repo.save')}</button>` : '') + forget;
  el.className = 'banner repo-banner write';
  el.innerHTML = `<p class="repo-alert">${t('repo.writeTitle')}</p><p title="${t('repo.write', name)}">${t('repo.writeShort', name)}</p>`
    + `<p>${S.repoSaving ? t('repo.saving') : link.mustConfirm ? t('repo.confirmFirst') : t('repo.autoOn')}`
    + (S.repoSavedAt && !S.repoSaving ? ' ' + t('repo.savedAt', esc(S.repoSavedAt)) : '') + '</p>'
    + (S.repoError ? `<p class="err">${S.repoError}</p>` : '')
    + `<div class="acts">${actions}</div>`;
}

/** Leaves the choice the banner asks for (records changed on both sides). */
export function confirmRepoSave() {
  S.repoConflicts = null;
  S.repoError = '';
  renderRepoBanner();
}

/** Name of a conflicting record, for the banner. */
function conflictName(collection, id, records) {
  if (collection === 'people') return fullName(records.people.get(id));
  if (collection === 'sources') {
    const s = records.sources.get(id) || {};
    return s.title || [t('src.' + (s.kind || 'other')), s.ref].filter(Boolean).join(' ');
  }
  const u = records.unions.get(id) || {};
  return `${fullName(records.people.get(u.a))} & ${fullName(records.people.get(u.b))}`;
}

/** Applies the merged `next` record locally: only its fields that differ from `mine` change. */
async function localRecord(link, latest, collection, id, next, mine) {
  const local = mapOf(collection).get(id) || {};
  const kept = {};
  const changed = {};
  for (const key of Object.keys(next)) {
    if (mine && canonical(next[key]) === canonical(mine[key]) && key in local) kept[key] = local[key];
    else changed[key] = next[key];
  }
  if (collection !== 'unions') {
    // Photos: those of the open tree come back as they are, the repository's new ones are loaded
    const known = new Map([...link.photos].map(([data, file]) => [file.ref, data]));
    const record = { id, data: await convertPhotos(changed, (photo) => known.get(photo) || photo) };
    const { photos } = await attachPhotos(latest, { path: link.path, people: [record] });
    for (const [data, file] of photos) link.photos.set(data, file);
    return { ...kept, ...record.data };
  }
  return { ...kept, ...changed };
}

/**
 * The repository's latest version next to the open tree, both with the repository's photo paths
 * (a photo not yet in the repository stays a data URL): { latest, theirs, mine, both }.
 */
async function compareLatest(link) {
  const latest = await readLatest(link.repo, link);
  const theirs = backupRecords(latest.backup);
  const portable = JSON.parse(await buildPortableBackup());
  const toRef = (photo) => (link.photos.get(photo) || {}).ref || photo;
  const mine = backupRecords({
    people: await Promise.all(portable.people.map((p) => convertPhotos(p, toRef))),
    unions: portable.unions,
    sources: await Promise.all((portable.sources || []).map((s) => convertPhotos(s, toRef))),
  });
  const both = Object.fromEntries(COLLECTIONS.map((c) => [c, new Map([...theirs[c], ...mine[c]])]));
  return { latest, theirs, mine, both };
}

/**
 * Merges the repository's latest version into the open tree. Returns { conflicts: [names] } when
 * fields were changed differently on both sides and `prefer` doesn't settle them; otherwise
 * applies the merge locally, as one undoable action, and returns { changed: number of records }.
 * `base`: the version both sides started from (by default, the one read or sent last); with an
 * empty base, nothing is deleted: what only one side has is kept.
 */
async function mergeLatest(link, prefer, base = link.base) {
  const { latest, theirs, mine, both } = await compareLatest(link);
  const merged = {};
  const conflicts = [];
  for (const collection of COLLECTIONS) {
    const { result, conflicts: ids } = mergeRecords(base[collection] || new Map(), mine[collection], theirs[collection], prefer);
    merged[collection] = result;
    for (const id of ids) conflicts.push(conflictName(collection, id, both));
  }
  if (conflicts.length && !prefer) return { conflicts }; // the repository stays where it was read

  const writes = [];
  for (const collection of COLLECTIONS) {
    const [result, before] = [merged[collection], mine[collection]];
    for (const id of new Set([...before.keys(), ...result.keys()])) {
      if (canonical(result.get(id)) === canonical(before.get(id))) continue;
      writes.push(result.has(id)
        ? [collection, id, await localRecord(link, latest, collection, id, result.get(id), before.get(id))]
        : [collection, id]);
    }
  }
  if (!writes.length) {
    latest.moveTo();
    return { changed: 0 };
  }
  beginAction('hist.repoMerge');
  try {
    await inBatch(async () => {
      // Each collection is set by the merge itself: no source is deleted along with a person
      for (const [collection, id, data] of writes) await (data ? opSet(collection, id, data) : opDelete(collection, id, { raw: true }));
    });
    if (await storePhotos()) await saveLocal(); // file mode: photos from the repository become files
  } finally {
    commitAction();
  }
  latest.moveTo();
  afterData();
  return { changed: writes.length };
}

/* ---------- Before replacing a backup written elsewhere: what would change ---------- */

const SHOWN = 25; // names listed per section, the others counted

/**
 * What saving would do to the repository: { people, unions, sources } (see diffRecords), the
 * photos sent and removed, and the names to show. Reads the repository's latest version.
 */
export async function repoPreview(link = S.repoLink) {
  const { latest, theirs, mine, both } = await compareLatest(link);
  const diff = Object.fromEntries(COLLECTIONS.map((c) => [c, diffRecords(theirs[c], mine[c])]));
  const ours = imagesOf(mine);
  const sent = [...ours].filter(isPhotoData).length;
  // Removed: the repository's photos the tree no longer cites, and the files left in its photos folder
  const folder = link.path.replace(/\.json$/i, '/').normalize('NFC');
  const files = [...latest.files.values()].map((x) => x.path.normalize('NFC'))
    .filter((path) => path.startsWith(folder + 'photos/') && SENT_NAME.test(path)).map((path) => path.slice(folder.length));
  const removed = new Set([...imagesOf(theirs)].filter((x) => !isPhotoData(x)).concat(files).filter((x) => !ours.has(x))).size;
  return { diff, photos: { sent, removed }, name: (c, id) => conflictName(c, id, both) };
}

/** Field names, for the changed records. */
const fieldName = (key) => {
  const label = t('diff.f.' + key);
  return label === 'diff.f.' + key ? key : label;
};

function namesList(items, label) {
  if (!items.length) return '';
  const shown = items.slice(0, SHOWN).map((x) => `<li>${x}</li>`).join('');
  const more = items.length > SHOWN ? `<li class="hint">${t('diff.more', items.length - SHOWN)}</li>` : '';
  return `<h3>${label} <span class="n">${items.length}</span></h3><ul class="diff-list">${shown}${more}</ul>`;
}

/** Content of the dialog listing what saving would change in the repository. */
export function repoDiffHTML(preview, path) {
  const { diff, photos, name } = preview;
  const p = diff.people;
  const changed = p.changed.map(({ id, fields }) => `${esc(name('people', id))} <small>(${esc(fields.map(fieldName).join(', '))})</small>`);
  const others = ['unions', 'sources'].map((c) => {
    const d = diff[c];
    const n = d.added.length + d.removed.length + d.changed.length;
    return n ? `<li>${t('diff.' + c, d.added.length, d.removed.length, d.changed.length)}</li>` : '';
  }).join('');
  const nothing = !COLLECTIONS.some((c) => diff[c].added.length || diff[c].removed.length || diff[c].changed.length) && !photos.sent && !photos.removed;
  return `<p>${t('diff.intro', esc(path))}</p>`
    + (nothing ? `<p class="okmsg">${t('diff.same')}</p>` : '')
    + namesList(p.added.map((id) => esc(name('people', id))), t('diff.added'))
    + namesList(p.removed.map((id) => esc(name('people', id))), t('diff.removed'))
    + namesList(changed, t('diff.changed'))
    + (others ? `<ul class="diff-list">${others}</ul>` : '')
    + (photos.sent || photos.removed ? `<p>${t('diff.photos', photos.sent, photos.removed)}</p>` : '')
    + `<p class="hint">${t('diff.choice')}</p>`;
}

/** Opens the dialog: what replacing the repository's backup would change, and the choice. */
export async function openRepoDiff() {
  const link = S.repoLink;
  if (!link || !link.repo || link.tree !== S.tree) return;
  const dlg = $('#repoDiffDlg');
  dlg.hidden = false;
  $('#repoDiffBody').innerHTML = `<p>${t('tr.repoLoading')}</p>`;
  try {
    $('#repoDiffBody').innerHTML = repoDiffHTML(await repoPreview(link), link.path);
  } catch (e) {
    $('#repoDiffBody').innerHTML = `<p class="err">${t('tr.repoErr.' + (e.code || 'failed'))}</p>`;
  }
}

export function closeRepoDiff() {
  $('#repoDiffDlg').hidden = true;
}

/**
 * Choice made in the dialog: 'replace' sends the open tree as it is; 'merge' first takes in
 * what only the repository has (the open tree wins where both differ), then sends.
 */
export async function chooseRepoSave(how) {
  const link = S.repoLink;
  closeRepoDiff();
  if (!link || !link.repo) return;
  if (how === 'merge') {
    S.repoError = '';
    try {
      const { changed } = await mergeLatest(link, 'mine', NO_BASE());
      link.merged = changed;
    } catch (e) {
      S.repoError = t('tr.repoErr.' + (e.code || 'failed'));
      renderRepoBanner();
      return;
    }
  }
  await saveRepo(true);
}

/**
 * Saves the open tree to the linked repository, after confirmation if a backup must be replaced.
 * If the repository changed since it was read, its changes are merged into the open tree first;
 * records changed differently on both sides wait for `prefer` ('mine' or 'theirs').
 */
// Saves go one after the other, manual or automatic: two sends at once would mix their merges
let saveQueue = Promise.resolve();

export function saveRepo(confirmed, prefer, options = {}) {
  if (!options.auto) clearTimeout(autoTimer); // a manual save takes the waiting changes along
  const run = saveQueue.then(() => sendRepo(confirmed, prefer, options));
  saveQueue = run.catch(() => {});
  return run;
}

async function sendRepo(confirmed, prefer, { auto = false, label = '' } = {}) {
  const link = S.repoLink;
  if (!link || !link.repo || link.tree !== S.tree) return;
  if (link.mustConfirm && !confirmed) {
    if (!auto) await openRepoDiff();
    return;
  }
  S.repoConflicts = null;
  S.repoError = '';
  S.repoSaving = true;
  renderRepoBanner();
  let changed = 0;
  try {
    for (let attempt = 1; ; attempt++) {
      try {
        const text = await buildPortableBackup();
        // Nothing new since the last send (the date of the backup aside): no empty commit
        const content = text.replace(/\n\s*"exportedAt": "[^"]*",/, '');
        if (auto && content === link.lastSent) break;
        await pushBackup(link.repo, link, text, commitMessage(label));
        link.lastSent = content;
        break;
      } catch (e) {
        if (e.code !== 'conflict' || attempt >= MERGE_TRIES) throw e;
        const outcome = await mergeLatest(link, prefer);
        if (outcome.conflicts) {
          S.repoConflicts = outcome.conflicts;
          renderRepoBanner();
          return;
        }
        changed += outcome.changed;
      }
    }
    link.mustConfirm = false;
    remember(link);
    S.repoSavedAt = new Date().toLocaleTimeString();
    markExported();
    changed += link.merged || 0;
    link.merged = 0;
    if (changed || !auto) toast(changed ? t('repo.merged', changed) : t('repo.saved'));
  } catch (e) {
    S.repoError = t('tr.repoErr.' + (e.code || 'failed'));
    if (auto) toast(t('repo.autoFailed'), true);
  } finally {
    S.repoSaving = false;
  }
  renderRepoBanner();
}

/** Commit message: what changed, when known. */
function commitMessage(label) {
  const what = { 'hist.undone': t('repo.undoCommit'), 'hist.redone': t('repo.redoCommit') }[label] || (label ? t(label) : '');
  return what && typeof what === 'string' ? `${t('repo.commit')} : ${what}` : t('repo.commit');
}

/* ---------- Each change goes to the repository ---------- */

export const AUTOSAVE_DELAY = 1500; // ms: changes made close together make one commit
let autoTimer = null;
let autoLabel = '';
let autoRunning = false;
let autoAgain = false;

/** True if changes go to the repository by themselves: a write link, confirmed, with no choice waiting. */
const autoSaving = (link = S.repoLink) => !!(link && link.repo && link.tree === S.tree && !link.mustConfirm && !S.repoConflicts);

/** After a change (notify 'changed'): sends the tree to the repository a moment later. */
export function scheduleRepoSave(label = '') {
  if (!autoSaving()) return;
  autoLabel = label;
  clearTimeout(autoTimer);
  autoTimer = setTimeout(flushRepoSave, AUTOSAVE_DELAY);
}

/** Sends now what is waiting; one send at a time, the changes made meanwhile follow. */
export async function flushRepoSave() {
  clearTimeout(autoTimer);
  autoTimer = null;
  if (autoRunning) {
    autoAgain = true;
    return;
  }
  autoRunning = true;
  try {
    if (autoSaving()) await saveRepo(false, undefined, { auto: true, label: autoLabel });
  } finally {
    autoRunning = false;
    if (autoAgain) {
      autoAgain = false;
      await flushRepoSave();
    }
  }
}

/** Forgets the open tree's repository and, with it, the token. */
export function forgetRepo() {
  if (S.repoLink && S.repoLink.tree === S.tree) S.repoLink = null;
  const { [S.tree]: dropped, ...others } = savedRepos();
  writeRepos(others);
  S.repoConflicts = null;
  S.repoError = '';
  renderRepoBanner();
}
