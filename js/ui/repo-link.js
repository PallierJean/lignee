/**
 * Dépôt GitHub relié à l'arbre ouvert : bandeau et sauvegarde.
 * L'adresse du dépôt est retenue pour chaque arbre ; le jeton reste en mémoire, jamais enregistré.
 */
import { S, treeName } from '../state.js';
import { REPO_KEY } from '../config.js';
import { $, esc } from '../utils/dom.js';
import { norm } from '../utils/helpers.js';
import { buildPortableBackup } from '../services/storage.js';
import { pushBackup, attachPhotos, openRepo } from '../services/github.js';
import { toast } from './toast.js';
import { t } from '../i18n.js';

function savedRepos() {
  try {
    return JSON.parse(localStorage.getItem(REPO_KEY)) || {};
  } catch (e) {
    return {}; // données illisibles ou stockage bloqué
  }
}

function writeRepos(all) {
  try {
    localStorage.setItem(REPO_KEY, JSON.stringify(all));
  } catch (e) {
    /* stockage bloqué : le lien dure jusqu'à la fermeture de la page */
  }
}

/** Dépôt retenu pour l'arbre ouvert : { name, path, head }, ou null. */
export const savedRepo = () => savedRepos()[S.tree] || null;

const remember = (link) => writeRepos({ ...savedRepos(), [link.tree]: { name: link.name, path: link.path, head: link.repo.head } });

function setLink(repo, path, photos, mustConfirm) {
  S.repoLink = { tree: S.tree, name: repo.name, path, repo, photos, mustConfirm };
  S.repoConfirm = false;
  S.repoError = '';
  S.repoSavedAt = '';
  remember(S.repoLink);
}

/** Relie l'arbre importé au dépôt. En lecture seule, rien de ce qui contient le jeton n'est gardé. */
export function linkRepo(repo, backup, photos) {
  if (repo.write) {
    setLink(repo, backup.path, photos, false);
    return;
  }
  S.repoLink = { tree: S.tree, name: repo.name, path: backup.path };
}

/**
 * Relie l'arbre ouvert au dépôt indiqué, vide ou non. Reprend la sauvegarde déjà suivie, celle qui
 * porte le nom de l'arbre ou la seule du dépôt ; sinon un nouveau fichier, nommé d'après l'arbre.
 * Remplacer une sauvegarde qu'on n'a pas écrite soi-même demandera une confirmation.
 */
export async function connectTree(input, token) {
  if (!token) throw Object.assign(new Error('needToken'), { code: 'needToken' });
  const repo = await openRepo(input, token, true);
  if (!repo.write) throw Object.assign(new Error('readOnly'), { code: 'readOnly' });

  const known = savedRepo();
  const slug = norm(treeName()).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'arbre';
  const paths = [known && known.name === repo.name ? known.path : '', `${slug}.json`];
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
  const forget = `<button class="btn" type="button" data-act="repo-forget">${t('repo.forget')}</button>`;
  el.hidden = false;
  if (known) {
    el.className = 'banner repo-banner read';
    el.innerHTML = `<p>${t('repo.reconnect', esc(known.name))}</p><div class="acts">`
      + `<button class="btn primary" type="button" data-act="repo-reconnect">${t('repo.reconnectBtn')}</button>${forget}</div>`;
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
      + `<button class="btn danger" type="button" data-act="repo-save-yes">${t('repo.saveYes')}</button>`
      + `<button class="btn" type="button" data-act="repo-save-no">${t('cancel')}</button>`
    : `<button class="btn danger" type="button" data-act="repo-save">${t('repo.save')}</button>${forget}`;
  el.className = 'banner repo-banner write';
  el.innerHTML = `<p class="repo-alert">${t('repo.writeTitle')}</p><p>${t('repo.write', name)}</p>`
    + (S.repoSavedAt ? `<p>${t('repo.savedAt', esc(S.repoSavedAt))}</p>` : '')
    + (S.repoError ? `<p class="err">${S.repoError}</p>` : '')
    + `<div class="acts">${actions}</div>`;
}

export function confirmRepoSave(show) {
  S.repoConfirm = show;
  S.repoError = '';
  renderRepoBanner();
}

/** Sauvegarde l'arbre ouvert dans le dépôt relié, après confirmation s'il faut remplacer une sauvegarde. */
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

/** Oublie le dépôt de l'arbre ouvert et, avec lui, le jeton. */
export function forgetRepo() {
  if (S.repoLink && S.repoLink.tree === S.tree) S.repoLink = null;
  const { [S.tree]: dropped, ...others } = savedRepos();
  writeRepos(others);
  S.repoConfirm = false;
  S.repoError = '';
  renderRepoBanner();
}
