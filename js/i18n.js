/**
 * Interface language: French or English.
 *
 * t(key, ...args) returns the text in the chosen language. An entry is a string,
 * or a function that receives the arguments (numbers, names) and inflects the text.
 * In index.html, the data-i18n (text), data-i18n-html (text with tags)
 * and data-i18n-attr ("placeholder:key; title:key") attributes are filled by applyStatic().
 */
import { LANG_KEY } from './config.js';
import { FR } from './i18n/fr.js';
import { EN } from './i18n/en.js';

export const DICT = { fr: FR, en: EN };

function savedLang() {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return DICT[v] ? v : 'fr';
  } catch (e) {
    return 'fr';
  }
}

let lang = savedLang();

export const getLang = () => lang;

/** Text of the key in the chosen language (falling back to French). */
export function t(key, ...args) {
  const v = key in DICT[lang] ? DICT[lang][key] : FR[key];
  return typeof v === 'function' ? v(...args) : v;
}

/** Fills the static texts of index.html. */
export function applyStatic() {
  document.documentElement.lang = lang;
  document.querySelector('meta[name="description"]').content = t('meta.description');
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of document.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':').map((x) => x.trim());
      el.setAttribute(attr, t(key));
    }
  }
  const btn = document.getElementById('btnLang');
  btn.textContent = t('lang.switch');
  btn.title = t('lang.switchTitle');
  btn.setAttribute('aria-label', t('lang.switchTitle'));
}

/** Switches language and remembers the choice. */
export function setLang(next) {
  if (!DICT[next]) return;
  lang = next;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch (e) {
    /* storage unavailable: choice not remembered */
  }
  applyStatic();
}
