/**
 * Tree drawing: cards (positioned buttons) and lines (SVG).
 * Existing cards are reused so their movement is animated.
 */
import { CW, CH, reduced, RINGS_PATH, setCardSize } from '../config.js';
import { S, cardEls, isLoading } from '../state.js';
import { $, esc } from '../utils/dom.js';
import { t } from '../i18n.js';
import {
  P, given, fullName, cardNames, longName, cardDates, situationLabel, currentSituation, passesFilter, photoOf, avatarOf,
} from '../model/people.js';
import { buildLayout } from './layout.js';
import { buildFullLayout } from './full-layout.js';
import { relationship } from '../model/kinship.js';
import { fanSVG } from './fan.js';
import { renderFanNav } from '../ui/fan-hover.js';

const PH_LABEL = {
  father: 'addFather',
  mother: 'addMother',
  child: 'addChild',
  sibling: 'addSibling',
};

/** Small illustration of the empty state: two parents linked to a child. */
const EMPTY_SVG = '<svg viewBox="0 0 120 70" aria-hidden="true">'
  + '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 3">'
  + '<rect x="4" y="4" width="40" height="18" rx="2"/><rect x="76" y="4" width="40" height="18" rx="2"/>'
  + '<path d="M24 22v9h72v-9"/></g>'
  + '<rect x="40" y="48" width="40" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>'
  + '<path d="M60 31v17" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

// Two interlaced rings before a married person's dates
const MARRIED_SVG = '<svg class="wed" viewBox="0 0 20 12" aria-hidden="true">'
  + `<path d="${RINGS_PATH}" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;

const SABERS = ['green', 'blue', 'red'];

/**
 * Laser sword of a person, in the Star Wars theme (css/themes.css): its colour and its hilt, always
 * the same for the same person, drawn from the id. One shown person, drawn at random, has a purple one.
 */
export function saberOf(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return { saber: SABERS[h % 3], hilt: String(Math.floor(h / 3) % 6) };
}

// The one purple sword: a person drawn at random among the shown cards, kept while their card is shown
let purple = null;

/** Draws the holder of the purple sword again if their card is no longer among `shown` (person ids). */
export function pickPurple(shown) {
  if (!shown.includes(purple)) purple = shown.length ? shown[Math.floor(Math.random() * shown.length)] : null;
  return purple;
}

/** Highlighting a kinship link takes precedence over the line halo. */
const lineShown = () => S.line && !S.kinShow;

function fillCard(el, n, purpleSword) {
  const p = P(n.id);
  const names = cardNames(p);
  el.className = 'card' + (p.sex === 'M' || p.sex === 'F' ? ' is-' + p.sex : '')
    + (n.focus ? ' is-focus' : '') + (n.partnerOf ? ' is-partner' : '') + (n.onPath ? ' on-path' : '')
    + (lineShown() && n.sosa && !n.focus ? ' is-line' : '') + (names.maiden ? ' has-maiden' : '')
    + (S.filter && !passesFilter(p, S.filter) ? ' is-faded' : '');
  el.dataset.act = 'person-open';
  el.dataset.id = n.id;
  Object.assign(el.dataset, saberOf(n.id), purpleSword ? { saber: 'purple' } : {});
  delete el.dataset.rel;
  delete el.dataset.of;
  const dates = cardDates(p);
  const wed = ['married', 'remarried'].includes(currentSituation(n.id));
  const spokenDates = (wed ? ', ' + situationLabel('married', p.sex).toLowerCase() : '') + (dates ? ', ' + dates.replace(/°/g, t('card.born')).replace(/†/g, t('card.died')) : '');
  const partnerOf = n.partnerOf ? ', ' + t('card.partnerOf', p.sex === 'F', fullName(P(n.partnerOf))) : '';
  el.setAttribute('aria-label', longName(p) + spokenDates + (n.sosa ? ', Sosa ' + n.sosa : '') + partnerOf);
  if (S.photos) {
    // Photo only; the name and dates show on hover or keyboard focus, in place of the tooltip
    el.removeAttribute('title');
    el.innerHTML = `<img class="ph-img" src="${esc(photoOf(p) || avatarOf(p.sex))}" alt="" draggable="false">`
      + `<span class="tip" aria-hidden="true"><b>${esc(fullName(p))}</b>${dates ? `<span>${esc(dates)}</span>` : ''}</span>`;
    return;
  }
  el.title = longName(p);
  el.innerHTML = `<span class="tp"><i class="sx ${esc(p.sex || 'U')}"></i><span class="g">${esc(given(p) || '—')}</span>`
    + `${n.sosa ? `<span class="sosa" title="${t('sosaTitle')}">${n.sosa}</span>` : ''}</span>`
    + `<span class="s">${esc(names.name || t('card.noSurname'))}</span>`
    + (names.maiden ? `<span class="s m">${esc(names.maiden)}</span>` : '')
    + `<span class="d">${wed ? MARRIED_SVG : ''}${esc(dates || t('card.noDates'))}</span>`;
}

function fillPlaceholder(el, n) {
  el.className = 'card ph';
  el.dataset.act = 'add';
  el.dataset.rel = n.rel;
  el.dataset.of = n.of;
  delete el.dataset.id;
  delete el.dataset.saber;
  delete el.dataset.hilt;
  const of = P(n.of);
  const label = t(n.rel === 'spouse'
    ? (of.sex === 'M' ? 'addSpouseF' : of.sex === 'F' ? 'addSpouseM' : 'addSpouse')
    : PH_LABEL[n.rel]);
  el.setAttribute('aria-label', t('card.of', label, fullName(of)));
  el.innerHTML = `<span class="plus" aria-hidden="true">+</span>`
    + (S.photos ? `<span class="tip" aria-hidden="true">${esc(label)}</span>` : `<span>${esc(label)}</span>`);
}

/** Kinship link path, from one card to the next. */
function pathEdges(L, path, cls = 'kin') {
  const at = new Map();
  for (const n of L.nodes) if (n.t === 'p' && !at.has(n.id)) at.set(n.id, n);
  let d = '';
  for (let i = 1; i < path.length; i++) {
    const a = at.get(path[i - 1]);
    const b = at.get(path[i]);
    if (!a || !b) continue;
    if (a.y === b.y) {
      const [l, r] = a.x < b.x ? [a, b] : [b, a];
      d += `M${l.x + CW},${l.y + CH / 2}H${r.x}`;
    } else {
      const [top, low] = a.y < b.y ? [a, b] : [b, a];
      const mid = (top.y + CH + low.y) / 2;
      d += `M${top.x + CW / 2},${top.y + CH}V${mid}H${low.x + CW / 2}V${low.y}`;
    }
  }
  return d ? `<path class="${cls}" d="${d}"/>` : '';
}

/** Direct-line strokes: from each person to their displayed parents. */
function lineEdges(L) {
  if (!lineShown()) return '';
  return L.nodes.filter((n) => n.sosa).map((n) => {
    const p = P(n.id);
    return [p.fatherId, p.motherId].map((parent) => pathEdges(L, [n.id, parent], 'line')).join('');
  }).join('');
}

function clearCards() {
  for (const el of cardEls.values()) el.remove();
  cardEls.clear();
  $('#edges').innerHTML = '';
  S.lastLayout = null;
}

function renderEmpty(empty) {
  if (isLoading()) {
    empty.innerHTML = EMPTY_SVG + `<p>${t('loading')}</p>`;
  } else if (S.canWrite) {
    empty.innerHTML = EMPTY_SVG
      + `<h2>${t('empty.title')}</h2>`
      + `<p>${t('empty.text')}</p>`
      + `<button class="btn primary" type="button" data-act="new">${t('empty.btn')}</button>`;
  } else {
    empty.innerHTML = EMPTY_SVG
      + `<h2>${t('empty.roTitle')}</h2>`
      + `<p>${t('empty.roText')}</p>`;
  }
}

export function renderTree() {
  const sizer = $('#sizer');
  const tree = $('#tree');
  const svg = $('#edges');
  const empty = $('#empty');
  const fan = $('#fan');

  fan.hidden = !(S.fan && P(S.focus) && !isLoading());
  if (!fan.hidden) {
    clearCards();
    sizer.hidden = true;
    empty.hidden = true;
    fan.innerHTML = fanSVG(undefined, S.zoom);
    renderFanNav(true);
    return;
  }
  fan.innerHTML = '';
  renderFanNav(false);

  if (isLoading() || !S.people.size) {
    clearCards();
    sizer.hidden = true;
    empty.hidden = false;
    renderEmpty(empty);
    return;
  }

  setCardSize(S.photos);
  tree.classList.toggle('photos', S.photos);
  const L = S.full ? buildFullLayout() : buildLayout();
  if (!L) return;
  const path = S.kinShow ? relationship(S.kinA, S.kinB).path : [];
  const onPath = new Set(path);
  for (const n of L.nodes) if (onPath.has(n.id)) n.onPath = true;
  tree.classList.toggle('has-path', path.length > 0);
  empty.hidden = true;
  sizer.hidden = false;

  // Size of the scroll area (zoomed) and of the tree (unzoomed)
  const canvas = $('#canvas');
  sizer.style.width = Math.ceil(L.W * S.zoom) + 'px';
  sizer.style.height = Math.ceil(L.H * S.zoom) + 'px';
  // Margins: a tree that fits on screen is centred in it, with no scrollbar; when larger, the
  // scrollbars follow its size exactly (see treeMargins)
  const w = Math.ceil(L.W * S.zoom);
  const h = Math.ceil(L.H * S.zoom);
  sizer.style.margin = `${Math.max(0, Math.floor((canvas.clientHeight - h) / 2))}px ${Math.max(0, Math.floor((canvas.clientWidth - w) / 2))}px`;
  tree.style.width = L.W + 'px';
  tree.style.height = L.H + 'px';
  tree.style.transform = `scale(${S.zoom})`;
  svg.setAttribute('width', L.W);
  svg.setAttribute('height', L.H);
  svg.setAttribute('viewBox', `0 0 ${L.W} ${L.H}`);

  // Lines and union symbols
  L.sig = L.nodes.map((n) => (n.id || n.key) + n.x + ',' + n.y).join('|');
  const geometryChanged = !S.lastLayout || S.lastLayout.sig !== L.sig;
  svg.innerHTML = L.edges.map((e) => `<path d="${e.d}"${e.dash ? ' class="dash"' : ''}/>`).join('')
    + L.marks.map((m) => `<g class="um${m.dash ? ' dash' : ''}"><circle cx="${m.x}" cy="${m.y}" r="9"/>`
      + `<text x="${m.x}" y="${m.y}" dy="0.36em" text-anchor="middle">×</text></g>`).join('')
    + lineEdges(L) + pathEdges(L, path);
  if (geometryChanged && !reduced && S.lastLayout) {
    // The lines reappear once the cards have reached their place
    svg.classList.add('fresh');
    requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.remove('fresh')));
  }

  // Cards: existing ones are reused
  pickPurple(L.nodes.filter((n) => n.t === 'p').map((n) => n.id));
  let purpleShown = false; // a person shown twice (pedigree collapse) has it only once
  const used = new Set();
  const count = new Map();
  for (const n of L.nodes) {
    let key = n.t === 'p' ? n.id : n.key;
    const c = (count.get(key) || 0) + 1;
    count.set(key, c);
    if (c > 1) key += '~' + c; // same person present twice (pedigree collapse)
    used.add(key);

    let el = cardEls.get(key);
    const isNew = !el;
    if (!el) {
      el = document.createElement('button');
      el.type = 'button';
      cardEls.set(key, el);
      tree.appendChild(el);
    }
    el.style.left = n.x + 'px';
    el.style.top = n.y + 'px';
    const purpleSword = n.t === 'p' && n.id === purple && !purpleShown;
    if (purpleSword) purpleShown = true;
    if (n.t === 'p') fillCard(el, n, purpleSword);
    else fillPlaceholder(el, n);
    if (isNew && !reduced && S.lastLayout) {
      el.classList.add('enter');
      setTimeout(() => el.classList.remove('enter'), 400);
    }
  }
  for (const [key, el] of cardEls) {
    if (!used.has(key)) {
      el.remove();
      cardEls.delete(key);
    }
  }
  S.lastLayout = L;
}

/** Scrolls the canvas to centre the focus person. */
export function scrollToFocus() {
  if (S.fan) {
    const canvas = $('#canvas');
    canvas.scrollTo({
      left: (canvas.scrollWidth - canvas.clientWidth) / 2,
      top: (canvas.scrollHeight - canvas.clientHeight) / 2,
      behavior: reduced ? 'auto' : 'smooth',
    });
    S.scrollPending = false;
    return;
  }
  const L = S.lastLayout;
  if (L) scrollToNode(L.nodes.find((x) => x.focus));
}

/** Scrolls the canvas to a person. */
export function scrollToPerson(id) {
  const L = S.lastLayout;
  if (L) scrollToNode(L.nodes.find((x) => x.id === id));
}

/** Margins around the tree in the scroll area: { x, y } in pixels. */
export function treeMargins() {
  const sizer = $('#sizer');
  return { x: parseFloat(sizer.style.marginLeft) || 0, y: parseFloat(sizer.style.marginTop) || 0 };
}

function scrollToNode(n) {
  if (!n) return;
  const canvas = $('#canvas');
  const m = treeMargins();
  canvas.scrollTo({
    left: m.x + (n.x + CW / 2) * S.zoom - canvas.clientWidth / 2,
    top: m.y + (n.y + CH / 2) * S.zoom - canvas.clientHeight * 0.55,
    behavior: reduced || S.firstScroll ? 'auto' : 'smooth',
  });
  S.firstScroll = false;
  S.scrollPending = false;
}
