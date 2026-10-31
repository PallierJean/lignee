/**
 * Dessin de l'arbre : fiches (boutons positionnés) et traits (SVG).
 * Les fiches existantes sont réutilisées pour que leur déplacement soit animé.
 */
import { CW, CH, reduced, RINGS_PATH } from '../config.js';
import { S, cardEls, isLoading } from '../state.js';
import { $, esc } from '../utils/dom.js';
import { t } from '../i18n.js';
import { P, given, fullName, surnameLine, longName, cardDates, situationLabel, currentSituation } from '../model/people.js';
import { buildLayout } from './layout.js';
import { buildFullLayout } from './full-layout.js';
import { relationship } from '../model/kinship.js';
import { fanSVG } from './fan.js';

const PH_LABEL = {
  father: 'addFather',
  mother: 'addMother',
  child: 'addChild',
  sibling: 'addSibling',
};

/** Petite illustration de l'état vide : deux parents reliés à un enfant. */
const EMPTY_SVG = '<svg viewBox="0 0 120 70" aria-hidden="true">'
  + '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 3">'
  + '<rect x="4" y="4" width="40" height="18" rx="2"/><rect x="76" y="4" width="40" height="18" rx="2"/>'
  + '<path d="M24 22v9h72v-9"/></g>'
  + '<rect x="40" y="48" width="40" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>'
  + '<path d="M60 31v17" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

// Deux anneaux entrelacés devant les dates d'une personne mariée
const MARRIED_SVG = '<svg class="wed" viewBox="0 0 20 12" aria-hidden="true">'
  + `<path d="${RINGS_PATH}" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;

/** Le surlignage d'un lien de parenté passe avant le halo de la lignée. */
const lineShown = () => S.line && !S.kinShow;

function fillCard(el, n) {
  const p = P(n.id);
  el.className = 'card' + (p.sex === 'M' || p.sex === 'F' ? ' is-' + p.sex : '')
    + (n.focus ? ' is-focus' : '') + (n.partnerOf ? ' is-partner' : '') + (n.onPath ? ' on-path' : '')
    + (lineShown() && n.sosa && !n.focus ? ' is-line' : '');
  el.dataset.act = 'person-open';
  el.dataset.id = n.id;
  delete el.dataset.rel;
  delete el.dataset.of;
  const dates = cardDates(p);
  const wed = ['married', 'remarried'].includes(currentSituation(n.id));
  const spokenDates = (wed ? ', ' + situationLabel('married', p.sex).toLowerCase() : '') + (dates ? ', ' + dates.replace(/°/g, t('card.born')).replace(/†/g, t('card.died')) : '');
  const partnerOf = n.partnerOf ? ', ' + t('card.partnerOf', p.sex === 'F', fullName(P(n.partnerOf))) : '';
  el.title = longName(p);
  el.setAttribute('aria-label', longName(p) + spokenDates + (n.sosa ? ', Sosa ' + n.sosa : '') + partnerOf);
  el.innerHTML = `<span class="tp"><i class="sx ${esc(p.sex || 'U')}"></i><span class="g">${esc(given(p) || '—')}</span>`
    + `${n.sosa ? `<span class="sosa" title="${t('sosaTitle')}">${n.sosa}</span>` : ''}</span>`
    + `<span class="s">${esc(surnameLine(p) || t('card.noSurname'))}</span>`
    + `<span class="d">${wed ? MARRIED_SVG : ''}${esc(dates || t('card.noDates'))}</span>`;
}

function fillPlaceholder(el, n) {
  el.className = 'card ph';
  el.dataset.act = 'add';
  el.dataset.rel = n.rel;
  el.dataset.of = n.of;
  delete el.dataset.id;
  const of = P(n.of);
  const label = t(n.rel === 'spouse'
    ? (of.sex === 'M' ? 'addSpouseF' : of.sex === 'F' ? 'addSpouseM' : 'addSpouse')
    : PH_LABEL[n.rel]);
  el.setAttribute('aria-label', t('card.of', label, fullName(of)));
  el.innerHTML = `<span class="plus" aria-hidden="true">+</span><span>${esc(label)}</span>`;
}

/** Tracé du lien de parenté, d'une fiche à la suivante. */
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

/** Traits de la lignée directe : de chaque personne à ses parents affichés. */
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
    return;
  }
  fan.innerHTML = '';

  if (isLoading() || !S.people.size) {
    clearCards();
    sizer.hidden = true;
    empty.hidden = false;
    renderEmpty(empty);
    return;
  }

  const L = S.full ? buildFullLayout() : buildLayout();
  if (!L) return;
  const path = S.kinShow ? relationship(S.kinA, S.kinB).path : [];
  const onPath = new Set(path);
  for (const n of L.nodes) if (onPath.has(n.id)) n.onPath = true;
  tree.classList.toggle('has-path', path.length > 0);
  empty.hidden = true;
  sizer.hidden = false;

  // Taille de la zone de défilement (zoomée) et de l'arbre (non zoomé)
  const canvas = $('#canvas');
  sizer.style.width = Math.ceil(L.W * S.zoom) + 'px';
  sizer.style.height = Math.ceil(L.H * S.zoom) + 'px';
  // Marges de défilement : même au bord de l'arbre, ou si tout tient à l'écran, on peut centrer
  sizer.style.margin = `${canvas.clientHeight / 2}px ${canvas.clientWidth / 2}px`;
  tree.style.width = L.W + 'px';
  tree.style.height = L.H + 'px';
  tree.style.transform = `scale(${S.zoom})`;
  svg.setAttribute('width', L.W);
  svg.setAttribute('height', L.H);
  svg.setAttribute('viewBox', `0 0 ${L.W} ${L.H}`);

  // Traits et symboles d'union
  L.sig = L.nodes.map((n) => (n.id || n.key) + n.x + ',' + n.y).join('|');
  const geometryChanged = !S.lastLayout || S.lastLayout.sig !== L.sig;
  svg.innerHTML = L.edges.map((e) => `<path d="${e.d}"${e.dash ? ' class="dash"' : ''}/>`).join('')
    + L.marks.map((m) => `<g class="um${m.dash ? ' dash' : ''}"><circle cx="${m.x}" cy="${m.y}" r="9"/>`
      + `<text x="${m.x}" y="${m.y}" dy="0.36em" text-anchor="middle">×</text></g>`).join('')
    + lineEdges(L) + pathEdges(L, path);
  if (geometryChanged && !reduced && S.lastLayout) {
    // Les traits réapparaissent une fois les fiches arrivées à leur place
    svg.classList.add('fresh');
    requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.remove('fresh')));
  }

  // Fiches : on réutilise celles qui existent déjà
  const used = new Set();
  const count = new Map();
  for (const n of L.nodes) {
    let key = n.t === 'p' ? n.id : n.key;
    const c = (count.get(key) || 0) + 1;
    count.set(key, c);
    if (c > 1) key += '~' + c; // même personne présente deux fois (implexe)
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
    if (n.t === 'p') fillCard(el, n);
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

/** Fait défiler la toile pour centrer la personne centrale. */
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

/** Fait défiler la toile jusqu'à une personne. */
export function scrollToPerson(id) {
  const L = S.lastLayout;
  if (L) scrollToNode(L.nodes.find((x) => x.id === id));
}

function scrollToNode(n) {
  if (!n) return;
  const canvas = $('#canvas');
  canvas.scrollTo({
    left: (n.x + CW / 2) * S.zoom,
    top: (n.y + CH / 2) * S.zoom + canvas.clientHeight / 2 - canvas.clientHeight * 0.55,
    behavior: reduced || S.firstScroll ? 'auto' : 'smooth',
  });
  S.firstScroll = false;
  S.scrollPending = false;
}
