/**
 * GitHub repository linked to the open tree: banner and save.
 * The repository address is remembered per tree; the token stays in memory, never stored.
 */
import { S, treeName } from '../state.js';
import { REPO_KEY } from '../config.js';
import { $, esc } from '../utils/dom.js';
import { norm } from '../utils/helpers.js';
import { buildPortableBackup } from '../services/storage.js';
import { pushBackup, attachPhotos } from '../services/github.js';
import { toast } from './toast.js';
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

function setLink(repo, path, photos, mustConfirm) {
  S.repoLink = { tree: S.tree, name: repo.name, path, repo, photos, mustConfirm };
  S.repoConfirm = false;
  S.repoError = '';
  S.repoSavedAt = '';
  remember(S.repoLink);
}

/** Links the imported tree to the repository. In read-only mode, nothing containing the token is kept. */
export function linkRepo(repo, backup, photos) {
  if (repo.write) {
    setLink(repo, backup.path, photos, false);
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
  const { photos } = backup ? await attachPhotos(repo, backup) : { photos: new Map() };
  setLink(repo, path, photos, !!backup && !(known && known.head === repo.head));
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
  const actions = S.repoConfirm
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
  S.repoError = '';
  renderRepoBanner();
}

/** Saves the open tree to the linked repository, after confirmation if a backup must be replaced. */
export async function saveRepo(confirmed) {
  const link = S.repoLink;
  if (!link || !link.repo || link.tree !== S.tree) return;
  if (link.mustConfirm && !confirmed) {
    confirmRepoSave(true);
    return;
  }
  S.repoConfirm = false;
  S.repoError = '';
  try {
    await pushBackup(link.repo, link, await buildPortableBackup(), t('repo.commit'));
    link.mustConfirm = false;
    remember(link);
    S.repoSavedAt = new Date().toLocaleTimeString();
    toast(t('repo.saved'));
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
  S.repoError = '';
  renderRepoBanner();
}
