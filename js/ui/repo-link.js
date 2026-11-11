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
import { pushBackup, attachPhotos, readLatest } from '../services/github.js';
import { mergeRecords, backupRecords, canonical } from '../services/merge.js';
import { fullName } from '../model/people.js';
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

const NO_BASE = () => ({ people: new Map(), unions: new Map() });
const MERGE_TRIES = 3; // the repository may change again while we merge

function setLink(repo, path, photos, mustConfirm, base) {
  S.repoLink = { tree: S.tree, name: repo.name, path, repo, photos, mustConfirm, base: base || NO_BASE() };
  S.repoConfirm = false;
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
    : S.repoConfirm
    ? `<span>${t('repo.confirm', esc(link.path))}</span>`
      + `<button class="btn small danger" type="button" data-act="repo-save-yes">${t('repo.saveYes')}</button>`
      + `<button class="btn small" type="button" data-act="repo-save-no">${t('cancel')}</button>`
    : `<button class="btn small danger" type="button" data-act="repo-save">${t('repo.save')}</button>${forget}`;
  el.className = 'banner repo-banner write';
  el.innerHTML = `<p class="repo-alert">${t('repo.writeTitle')}</p><p title="${t('repo.write', name)}">${t('repo.writeShort', name)}</p>`
    + (S.repoSavedAt ? `<p>${t('repo.savedAt', esc(S.repoSavedAt))}</p>` : '')
    + (S.repoError ? `<p class="err">${S.repoError}</p>` : '')
    + `<div class="acts">${actions}</div>`;
}

export function confirmRepoSave(show) {
  S.repoConfirm = show;
  S.repoConflicts = null;
  S.repoError = '';
  renderRepoBanner();
}

/** Name of a conflicting record, for the banner. */
function conflictName(collection, id, records) {
  if (collection === 'people') return fullName(records.people.get(id));
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
  if (collection === 'people') {
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
 * Merges the repository's latest version into the open tree. Returns { conflicts: [names] } when
 * fields were changed differently on both sides and `prefer` doesn't settle them; otherwise
 * applies the merge locally, as one undoable action, and returns { changed: number of records }.
 */
async function mergeLatest(link, prefer) {
  const latest = await readLatest(link.repo, link);
  const theirs = backupRecords(latest.backup);
  const portable = JSON.parse(await buildPortableBackup());
  const toRef = (photo) => (link.photos.get(photo) || {}).ref || photo;
  const mine = backupRecords({
    people: await Promise.all(portable.people.map((p) => convertPhotos(p, toRef))),
    unions: portable.unions,
  });
  const both = {
    people: new Map([...theirs.people, ...mine.people]),
    unions: new Map([...theirs.unions, ...mine.unions]),
  };
  const merged = {};
  const conflicts = [];
  for (const collection of ['people', 'unions']) {
    const { result, conflicts: ids } = mergeRecords(link.base[collection], mine[collection], theirs[collection], prefer);
    merged[collection] = result;
    for (const id of ids) conflicts.push(conflictName(collection, id, both));
  }
  if (conflicts.length && !prefer) return { conflicts }; // the repository stays where it was read

  const writes = [];
  for (const collection of ['people', 'unions']) {
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
      for (const [collection, id, data] of writes) await (data ? opSet(collection, id, data) : opDelete(collection, id));
    });
    if (await storePhotos()) await saveLocal(); // file mode: photos from the repository become files
  } finally {
    commitAction();
  }
  latest.moveTo();
  afterData();
  return { changed: writes.length };
}

/**
 * Saves the open tree to the linked repository, after confirmation if a backup must be replaced.
 * If the repository changed since it was read, its changes are merged into the open tree first;
 * records changed differently on both sides wait for `prefer` ('mine' or 'theirs').
 */
export async function saveRepo(confirmed, prefer) {
  const link = S.repoLink;
  if (!link || !link.repo || link.tree !== S.tree) return;
  if (link.mustConfirm && !confirmed) {
    confirmRepoSave(true);
    return;
  }
  S.repoConfirm = false;
  S.repoConflicts = null;
  S.repoError = '';
  let changed = 0;
  try {
    for (let attempt = 1; ; attempt++) {
      try {
        await pushBackup(link.repo, link, await buildPortableBackup(), t('repo.commit'));
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
    toast(changed ? t('repo.merged', changed) : t('repo.saved'));
  } catch (e) {
    S.repoError = t('tr.repoErr.' + (e.code || 'failed'));
  }
  renderRepoBanner();
}

/** Forgets the open tree's repository and, with it, the token. */
export function forgetRepo() {
  if (S.repoLink && S.repoLink.tree === S.tree) S.repoLink = null;
  const { [S.tree]: dropped, ...others } = savedRepos();
  writeRepos(others);
  S.repoConfirm = false;
  S.repoConflicts = null;
  S.repoError = '';
  renderRepoBanner();
}
