/**
 * Family booklet: real A4 pages built here. The margins are part of each
 * page, so they don't depend on the print dialog settings. Blocks are
 * measured off screen to lay out the text, which also gives the table of contents page numbers.
 */
import { S } from '../state.js';
import { esc } from '../utils/dom.js';
import { t } from '../i18n.js';
import { yearOf, longDate } from '../utils/dates.js';
import { P, photoOf, photoSrc } from '../model/people.js';
import { bookSections } from '../model/narrative.js';
import { bookChapters } from '../model/book-branches.js';
import { familyBook, familyBookName } from '../model/family-book.js';
import { fanSVG, fanSize } from '../tree/fan.js';

const MM = 96 / 25.4;      // CSS pixels per millimetre
const BODY_H = 256;        // text height of a page, in mm (see .bk-page in print.css)
const COVER_FAN = 150;     // width of the cover fan chart, in mm
const COVER_GENS = 5;      // generations of the cover fan chart: beyond this, unreadable
const SAFETY = 4;          // safety margin for the layout, in mm

/** The Lignée logo, reused on the cover. */
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

/** Years covered by a generation: "1787 – 1892", or empty. */
function span(section) {
  const years = section.people.map((x) => yearOf(P(x.id).birthDate)).filter(Boolean);
  if (!years.length) return '';
  const [lo, hi] = [Math.min(...years), Math.max(...years)];
  return lo === hi ? String(lo) : lo + ' – ' + hi;
}

const chapterHTML = (s) => `<div class="bk-chapter"><span class="bk-num">${s.gen}</span>`
  + `<div><h2>${esc(t('stat.gen', s.gen))}</h2><p>${esc(span(s))}</p></div></div>`;

/** Blocks to lay out: { html, chapter?, glue? }; a heading stays with the record that follows it. */
const blocksOf = (sections) => sections.flatMap((s) => [
  { html: chapterHTML(s), chapter: s, glue: true },
  ...s.people.map((x) => ({ html: entryHTML(x) })),
]);

/** Lays the blocks out on pages, from their real height. */
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

function coverHTML(title, gens, kicker = t('pr.bookKicker')) {
  const size = P(S.focus) ? fanSize(S.focus, COVER_GENS) : { gens: 0 };
  const fan = size.gens > 0 ? fanSVG(FAN_COLORS, (COVER_FAN * MM) / size.W, S.focus, COVER_GENS) : '';
  const years = [...S.people.values()].map((p) => yearOf(p.birthDate)).filter(Boolean);
  const facts = [t('pr.people', S.people.size), t('pr.gens', gens), years.length ? t('sum.since', Math.min(...years)) : '']
    .filter(Boolean).join('  ·  ');
  return `<section class="bk-page bk-cover"><div class="bk-frame">${MARK}<p class="bk-kicker">${esc(kicker)}</p>`
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

/* ---------- A person's booklet ---------- */

/** A person's extract: their name and facts, headed "First child" or "Husband…". */
function extractHTML(x, label) {
  return '<article class="bk-entry bk-extract">'
    + (x.photo ? `<img class="bk-photo" src="${esc(x.photo)}" alt="">` : '')
    + (label ? `<p class="bk-label">${esc(label)}</p>` : '')
    + `<header><h3>${esc(x.name)}</h3></header>`
    + `<dl>${x.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></article>`;
}

const sectionHTML = (title, sub) => `<div class="bk-chapter"><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div></div>`;

/** The family booklet of person `id`, town-hall style: their unions and direct children. */
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

/** The full booklet: cover, table of contents, then the text pages. */
export async function bookletHTML(title) {
  const sections = bookSections();
  const pages = await paginate(blocksOf(sections));
  const FIRST = 3; // cover and table of contents before the text
  const lines = pages.flatMap((page, i) => page.filter((b) => b.chapter).map((b) => {
    const when = span(b.chapter);
    return `<li><span>${esc(t('stat.gen', b.chapter.gen))}${when ? ` <small>${esc(when)}</small>` : ''}</span><i></i><b>${i + FIRST}</b></li>`;
  }));
  const toc = `<h2 class="bk-toc-title">${t('pr.bookToc')}</h2><ol class="bk-toc">${lines.join('')}</ol>`;
  return coverHTML(title, sections.length) + pageHTML(toc, 2, title)
    + pages.map((page, i) => pageHTML(page.map((b) => b.html).join(''), i + FIRST, title)).join('');
}

/* ---------- Full family book ---------- */

const TIMELINE_ROWS = 22;  // timeline rows per block: a block fits on a page
const ALBUM_ITEMS = 6;     // images per album block

const chunks = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

const branchHeadHTML = (ch, n) => `<div class="bk-chapter"><span class="bk-num">${n}</span>`
  + `<div><h2>${esc(ch.title)}</h2>${ch.sub ? `<p>${esc(ch.sub)}</p>` : ''}</div></div>`;

// A block is a single element: the layout measures each child of the measuring box
const timelineHTML = (rows, first) => '<div class="bk-block">' + (first ? `<h3 class="bk-sub">${esc(t('bb.timeline'))}</h3>` : '')
  + '<table class="bk-timeline">' + rows.map((r) => `<tr class="${r.kind}"><th>${r.year}</th><td>${esc(r.label)}</td></tr>`).join('') + '</table></div>';

const albumHTML = (items, first) => '<div class="bk-block">' + (first ? `<h3 class="bk-sub">${esc(t('bb.album'))}</h3>` : '')
  + '<div class="bk-album">' + items.map(({ m }) => `<figure><img src="${esc(photoSrc(m.photo))}" alt="">`
    + `${m.title || m.date ? `<figcaption>${esc([m.title, m.date].filter(Boolean).join(' · '))}</figcaption>` : ''}</figure>`).join('') + '</div></div>';

/** The full book: cover, table of contents, then one chapter per branch, with timeline and album. */
export async function fullBookHTML(title) {
  const chapters = bookChapters(S.focus);
  const blocks = chapters.flatMap((ch, i) => [
    { html: branchHeadHTML(ch, i + 1), chapter: ch, glue: true },
    ...ch.people.map((x) => ({ html: entryHTML(x) })),
    ...chunks(ch.timeline, TIMELINE_ROWS).map((rows, k) => ({ html: timelineHTML(rows, !k) })),
    ...chunks(ch.album, ALBUM_ITEMS).map((items, k) => ({ html: albumHTML(items, !k) })),
  ]);
  const pages = await paginate(blocks);
  const FIRST = 3;
  const lines = pages.flatMap((page, i) => page.filter((b) => b.chapter).map((b) => `<li><span>${esc(b.chapter.title)}`
    + `${b.chapter.sub ? ` <small>${esc(b.chapter.sub)}</small>` : ''}</span><i></i><b>${i + FIRST}</b></li>`));
  const toc = `<h2 class="bk-toc-title">${t('pr.bookToc')}</h2><ol class="bk-toc">${lines.join('')}</ol>`;
  return coverHTML(title, bookSections().length, t('bb.kicker')) + pageHTML(toc, 2, title)
    + pages.map((page, i) => pageHTML(page.map((b) => b.html).join(''), i + FIRST, title)).join('');
}
