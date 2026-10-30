/** Bandeau du dépôt GitHub lié à l'arbre ouvert : lecture seule, ou lecture et écriture avec l'envoi. */
import { S } from '../state.js';
import { $, esc } from '../utils/dom.js';
import { buildPortableBackup } from '../services/storage.js';
import { pushBackup } from '../services/github.js';
import { toast } from './toast.js';
import { t } from '../i18n.js';

/** Relie l'arbre ouvert au dépôt. En lecture seule, rien de ce qui contient le jeton n'est gardé. */
export function linkRepo(repo, backup, photos) {
  S.repoLink = {
    tree: S.tree,
    name: repo.name,
    path: backup.path,
    ...(repo.write ? { repo, photos } : {}),
  };
  S.repoConfirm = false;
  S.repoError = '';
}

export function renderRepoBanner() {
  const el = $('#repoBanner');
  const link = S.repoLink;
  if (!link || link.tree !== S.tree) {
    el.hidden = true;
    return;
  }
  const name = esc(link.name);
  const forget = `<button class="btn" type="button" data-act="repo-forget">${t('repo.forget')}</button>`;
  el.hidden = false;
  if (!link.repo) {
    el.className = 'banner repo-banner read';
    el.innerHTML = `<p>${t('repo.read', name)}</p><div class="acts">${forget}</div>`;
    return;
  }
  const actions = S.repoConfirm
    ? `<span>${t('repo.confirm', esc(link.path))}</span>`
      + `<button class="btn danger" type="button" data-act="repo-push-yes">${t('repo.pushYes')}</button>`
      + `<button class="btn" type="button" data-act="repo-push-no">${t('cancel')}</button>`
    : `<button class="btn danger" type="button" data-act="repo-push-ask">${t('repo.push')}</button>${forget}`;
  el.className = 'banner repo-banner write';
  el.innerHTML = `<p class="repo-alert">${t('repo.writeTitle')}</p><p>${t('repo.write', name)}</p>`
    + (S.repoError ? `<p class="err">${S.repoError}</p>` : '')
    + `<div class="acts">${actions}</div>`;
}

export function confirmRepoPush(show) {
  S.repoConfirm = show;
  S.repoError = '';
  renderRepoBanner();
}

/** Envoie l'arbre ouvert vers le dépôt lié. */
export async function pushRepo() {
  const link = S.repoLink;
  if (!link || !link.repo || link.tree !== S.tree) return;
  S.repoConfirm = false;
  try {
    await pushBackup(link.repo, link, await buildPortableBackup(), t('repo.commit'));
    toast(t('repo.pushed'));
  } catch (e) {
    S.repoError = t('tr.repoErr.' + (e.code || 'failed'));
  }
  renderRepoBanner();
}

/** Oublie le dépôt et, avec lui, le jeton. */
export function forgetRepo() {
  S.repoLink = null;
  S.repoConfirm = false;
  S.repoError = '';
  renderRepoBanner();
}
