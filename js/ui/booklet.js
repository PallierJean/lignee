/**
 * Livret de famille : de vraies pages A4 construites ici. Les marges font partie de chaque
 * page, elles ne dépendent donc pas des réglages de la fenêtre d'impression. Les blocs sont
 * mesurés hors écran pour répartir le texte, ce qui donne aussi les numéros du sommaire.
 */
import { S } from '../state.js';
import { esc } from '../utils/dom.js';
import { t } from '../i18n.js';
import { yearOf, longDate } from '../utils/dates.js';
import { P, photoOf } from '../model/people.js';
import { bookSections } from '../model/narrative.js';
import { familyBook, familyBookName } from '../model/family-book.js';
import { fanSVG, fanSize } from '../tree/fan.js';

const MM = 96 / 25.4;      // pixels CSS par millimètre
const BODY_H = 256;        // hauteur du texte d'une page, en mm (voir .bk-page dans print.css)
const COVER_FAN = 150;     // largeur de la roue en couverture, en mm
const COVER_GENS = 5;      // générations de la roue en couverture : au-delà, illisible
const SAFETY = 4;          // marge de sûreté de la répartition, en mm

/** Le logo de Lignée, repris en couverture. */
const MARK = '<svg class="bk-mark" viewBox="0 0 40 40" aria-hidden="true"><rect x="3" y="4" width="13" height="9" rx="1.5"/>'
  + '<rect x="24" y="4" width="13" height="9" rx="1.5"/><rect class="f" x="13.5" y="27" width="13" height="9" rx="1.5"/>'
  + '<path d="M9.5 13v6h21v-6M20 19v8"/></svg>';

function entryHTML(x) {
  const photo = photoOf(P(x.id));
  return '<article class="bk-entry">'
    + (photo ? `<img class="bk-photo" src="${esc(photo)}" alt="">` : '')
    + `<header><h3>${esc(x.name)}</h3>${x.years ? `<span>${esc(x.years)}</span>` : ''}</header>`
    + `<p>${esc(x.text)}</p>`
    + (x.sources ? `<p class="bk-src">${esc(x.sources)}</p>` : '') + '</article>';
}

/** Années couvertes par une génération : « 1787 – 1892 », ou vide. */
function span(section) {
  const years = section.people.map((x) => yearOf(P(x.id).birthDate)).filter(Boolean);
  if (!years.length) return '';
  const [lo, hi] = [Math.min(...years), Math.max(...years)];
  return lo === hi ? String(lo) : lo + ' – ' + hi;
}

const chapterHTML = (s) => `<div class="bk-chapter"><span class="bk-num">${s.gen}</span>`
  + `<div><h2>${esc(t('stat.gen', s.gen))}</h2><p>${esc(span(s))}</p></div></div>`;

/** Blocs à répartir : { html, chapter?, glue? } ; un titre reste avec la fiche qui le suit. */
const blocksOf = (sections) => sections.flatMap((s) => [
  { html: chapterHTML(s), chapter: s, glue: true },
  ...s.people.map((x) => ({ html: entryHTML(x) })),
]);

/** Répartit les blocs sur des pages, d'après leur hauteur réelle. */
async function paginate(blocks) {
  const box = document.createElement('div');
  box.className = 'bk-measure';
  box.innerHTML = blocks.map((b) => b.html).join('');
  document.body.appendChild(box);
  await document.fonts.ready;
  await Promise.all([...box.querySelectorAll('img')].map((img) => img.decode().catch(() => {})));
  const heights = [...box.children].map((el) => el.getBoundingClientRect().height);
  box.remove();

  const max = (BODY_H - SAFETY) * MM;
  const pages = [[]];
  let used = 0;
  blocks.forEach((b, i) => {
    const need = heights[i] + (b.glue ? heights[i + 1] || 0 : 0);
    if (used && used + need > max) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(b);
    used += heights[i];
  });
  return pages;
}

function coverHTML(title, sections) {
  const size = P(S.focus) ? fanSize(S.focus, COVER_GENS) : { gens: 0 };
  const fan = size.gens > 0 ? fanSVG(FAN_COLORS, (COVER_FAN * MM) / size.W, S.focus, COVER_GENS) : '';
  const years = [...S.people.values()].map((p) => yearOf(p.birthDate)).filter(Boolean);
  const facts = [t('pr.people', S.people.size), t('pr.gens', sections.length), years.length ? t('sum.since', Math.min(...years)) : '']
    .filter(Boolean).join('  ·  ');
  return `<section class="bk-page bk-cover"><div class="bk-frame">${MARK}<p class="bk-kicker">${t('pr.bookKicker')}</p>`
    + `<h1>${esc(title)}</h1><div class="bk-fan">${fan}</div><p class="bk-facts">${esc(facts)}</p>`
    + `<p class="bk-date">${esc(t('pr.printed', today()))}</p></div></section>`;
}

const FAN_COLORS = {
  text: '#16211E', muted: '#56645F', line: '#C8D2CD', empty: '#F1F4F2',
  M: '#FFFFFF', F: '#FFFFFF', U: '#FFFFFF', stroke: { M: '#4F86C6', F: '#E9A8BD', U: '#9AA8A2' },
};

const today = () => {
  const d = new Date();
  return longDate(`${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`);
};

const pageHTML = (body, n, title) => `<section class="bk-page"><div class="bk-body">${body}</div>`
  + `<footer class="bk-foot"><span>${esc(title)}</span><span>${n}</span></footer></section>`;

/* ---------- Livret d'une personne ---------- */

/** Extrait d'une personne : son nom et ses faits, avec en tête « Premier enfant » ou « Époux… ». */
function extractHTML(x, label) {
  return '<article class="bk-entry bk-extract">'
    + (x.photo ? `<img class="bk-photo" src="${esc(x.photo)}" alt="">` : '')
    + (label ? `<p class="bk-label">${esc(label)}</p>` : '')
    + `<header><h3>${esc(x.name)}</h3></header>`
    + `<dl>${x.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></article>`;
}

const sectionHTML = (title, sub) => `<div class="bk-chapter"><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div></div>`;

/** Le livret de famille de la personne `id`, façon mairie : ses unions et ses enfants directs. */
export async function familyBookHTML(id) {
  const book = familyBook(id);
  const names = [book.holder, ...book.unions.map((u) => u.partner)].map((x) => x.name);
  const blocks = [{ html: sectionHTML(t('fb.holder')), glue: true }, { html: extractHTML(book.holder) }];
  let n = 0;
  const child = (x) => ({ html: extractHTML(x, t('fb.child', ++n)) });
  for (const u of book.unions) {
    blocks.push({ html: sectionHTML(u.title, u.when), glue: true }, { html: extractHTML(u.partner, t('fb.partner')) });
    blocks.push(...u.children.map(child));
  }
  if (book.others.length) blocks.push({ html: sectionHTML(t('children')), glue: true }, ...book.others.map(child));

  const family = familyBookName(id);
  const title = family ? t('pr.bookFamily', family) : names.join(' · ');
  const cover = `<section class="bk-page bk-cover"><div class="bk-frame">${MARK}<p class="bk-kicker">${t('pr.bookKicker')}</p>`
    + `<div class="bk-names"><h1>${esc(title)}</h1>${family ? `<p class="bk-facts">${esc(names.join('  ·  '))}</p>` : ''}</div>`
    + `<p class="bk-facts">${esc(t('fb.count', book.unions.length, n))}</p>`
    + `<p class="bk-date">${esc(t('pr.printed', today()))}</p><p class="bk-date">${esc(t('fb.notice'))}</p></div></section>`;
  const pages = await paginate(blocks);
  return cover + pages.map((page, i) => pageHTML(page.map((b) => b.html).join(''), i + 2, title)).join('');
}

/** Le livret complet : couverture, sommaire, puis les pages de texte. */
export async function bookletHTML(title) {
  const sections = bookSections();
  const pages = await paginate(blocksOf(sections));
  const FIRST = 3; // couverture et sommaire avant le texte
  const lines = pages.flatMap((page, i) => page.filter((b) => b.chapter).map((b) => {
    const when = span(b.chapter);
    return `<li><span>${esc(t('stat.gen', b.chapter.gen))}${when ? ` <small>${esc(when)}</small>` : ''}</span><i></i><b>${i + FIRST}</b></li>`;
  }));
  const toc = `<h2 class="bk-toc-title">${t('pr.bookToc')}</h2><ol class="bk-toc">${lines.join('')}</ol>`;
  return coverHTML(title, sections) + pageHTML(toc, 2, title)
    + pages.map((page, i) => pageHTML(page.map((b) => b.html).join(''), i + FIRST, title)).join('');
}
