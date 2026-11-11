/**
 * Model: people, names, life dates and kinship links.
 *
 * A person: { given, surname, maidenName, sex ('M'|'F'|'U'), birthDate, birthPlace,
 *   deathDate, deathPlace, deceased, occupation, situation, situationDate, notes, fatherId, motherId,
 *   createdAt, updatedAt, photo?, example? }
 *   situation is the family situation (a SITUATIONS code, or empty); situationDate,
 *   the date or year of the marriage or civil partnership (optional).
 *   photo is a downscaled JPEG image (optional): embedded as a data URL, or, with the
 *   local server, "photos/<file>" in the tree's photo folder.
 *   surname is the surname in use; maidenName, a woman's maiden name (optional).
 *   events (optional): other events [{ id, type, date, place, note, label? }].
 *   sources (optional): certificates cited [{ id, fact, kind, title, place, ref, note, photo? }];
 *   fact is the supported fact: 'birth', 'death', an event id, 'union:<union id>',
 *   or empty for the record in general.
 *   media (optional): gallery [{ id, photo, title, date, note, tags: [{ id, x, y }] }];
 *   tags: people identified on the image (x, y as percentages).
 * A union: { a, b, type?, date, place, end?, endDate?, cause?, formerId?, createdAt, example? };
 * type: a UNION_TYPES code; end: end of the union, a UNION_ENDS code (missing while it lasts);
 * cause: for a remarriage, a REMARRIAGE_CAUSES code; formerId: the deceased spouse of a widowhood.
 */
import { S, idx } from '../state.js';
import { yearOf, shortDate, longDate, fullDate, dateBounds, yearsBetween } from '../utils/dates.js';
import { norm } from '../utils/helpers.js';
import { t, getLang } from '../i18n.js';
import { sourcesOf } from './sources.js';

/* ---------- Access and names ---------- */

export const P = (id) => (id ? S.people.get(id) : undefined);
export const given = (p) => String((p && p.given) || '').trim();
export const surname = (p) => String((p && p.surname) || '').trim().toUpperCase();

/** Maiden name, only for a woman and if it differs from the surname in use. */
export function maiden(p) {
  if (!p || p.sex !== 'F') return '';
  const m = String(p.maidenName || '').trim().toUpperCase();
  return m && m !== surname(p) ? m : '';
}

/** A family's name: birth surnames of both parents, "DURAND – ROCHE" (just one if they are identical). */
export function coupleName(father, mother) {
  const names = [father, mother].filter(Boolean).map((p) => maiden(p) || surname(p)).filter(Boolean);
  return [...new Set(names)].join(' – ');
}

/** Name of the family a person is a child of, from their father and mother; empty if they are unknown. */
export function parentsName(id) {
  const p = P(id);
  return p ? coupleName(P(p.fatherId), P(p.motherId)) : '';
}

/** Birth surname derived from the parents: the father's, failing that the mother's birth surname. */
export function birthSurname(fatherId, motherId) {
  const f = P(fatherId);
  if (f && surname(f)) return f.surname.trim();
  const m = P(motherId);
  if (!m) return '';
  return (maiden(m) ? m.maidenName : m.surname || '').trim();
}

/* ---------- Family situation ---------- */

/** Situation codes; [masculine, feminine] labels in i18n.js ("situ.<code>"). */
export const SITUATIONS = [['single'], ['cohabiting'], ['pacs'], ['married'], ['remarried'], ['separated'], ['divorced'], ['widowed']];

/** Situations for which a date can be given. */
export const DATED_SITUATIONS = new Set(['married', 'remarried', 'pacs']);

/** Label inflected for the sex: "Mariée", "Pacsé(e)" if the sex isn't specified. */
export function situationLabel(code, sex) {
  if (!SITUATIONS.some(([c]) => c === code)) return '';
  const [m, f] = t('situ.' + code);
  if (sex === 'M') return m;
  if (sex === 'F' || m === f) return f;
  return m + ' / ' + f;
}

/** "Non précisée", inflected for the sex; "Non précisé(e)" if it isn't specified. */
export function situationNoneLabel(sex) {
  return t('situ.none')[sex === 'M' ? 0 : sex === 'F' ? 1 : 2];
}

/** Situation given by a union (Widowed, Divorced, Remarried, Partnered…); empty if its type says nothing. */
export function situationOfUnion(type, end) {
  const ended = { death: 'widowed', divorce: 'divorced', separation: 'separated' }[end];
  if (ended) return ended;
  if (type === 'religious') return 'married';
  return ['married', 'remarried', 'pacs', 'cohabiting'].includes(type) ? type : '';
}

const diedBefore = (a, b) => isDead(a) && yearOf(a.deathDate) && yearOf(b.deathDate) && yearOf(a.deathDate) < yearOf(b.deathDate);

/**
 * Current situation, from the last union: Widowed, Divorced, Separated, Married, Remarried…
 * With no union given, it is the situation entered on the record.
 */
export function currentSituation(id) {
  const p = P(id);
  const list = partnersOf(id).filter((x) => x.uid && S.unions.has(x.uid));
  const last = list[list.length - 1];
  if (!p || !last) return (p && p.situation) || '';
  const u = S.unions.get(last.uid);
  const partner = P(last.id);
  let end = u.end || (partner && isDead(partner) && !isDead(p) ? 'death' : '');
  // Union ended by the person's own death: they are not widowed
  if (end === 'death' && isDead(p) && !(partner && diedBefore(partner, p))) end = '';
  if (end) return situationOfUnion('', end) || p.situation || '';
  const type = unionType(u);
  if (MARRIAGE_TYPES.includes(type)) {
    const before = list.slice(0, -1).some((x) => MARRIAGE_TYPES.includes(unionType(S.unions.get(x.uid))));
    return before || p.situation === 'remarried' ? 'remarried' : 'married';
  }
  return type === 'pacs' || type === 'cohabiting' ? type : p.situation || '';
}

/** "Mariée (12 Mars 1956)" if a date is known. With `id`, the current situation. */
export function situationText(p, id) {
  const code = id ? currentSituation(id) : p && p.situation;
  const label = situationLabel(code, p && p.sex);
  if (!label) return '';
  let date = code === p.situation ? p.situationDate : '';
  if (id && !date) {
    const last = partnersOf(id).filter((x) => x.uid).pop();
    date = last ? S.unions.get(last.uid).date : '';
  }
  const d = DATED_SITUATIONS.has(code) ? longDate(date) : '';
  return d ? label + ' (' + d + ')' : label;
}

/* ---------- Events and sources ---------- */

/** Union types; labels in i18n.js ("ut.<type>"). */
export const UNION_TYPES = ['married', 'remarried', 'religious', 'pacs', 'cohabiting', 'other'];

const MARRIAGE_TYPES = ['married', 'remarried', 'religious'];

/** Causes of a remarriage; labels in i18n.js ("urc.<code>", "urt.<code>"). */
export const REMARRIAGE_CAUSES = ['divorce', 'widowed'];

/**
 * Type of a union: the one saved, otherwise the situation of a spouse (Married, Partnered, Cohabiting,
 * same codes) whose last union it is. Empty if nothing tells.
 */
export function unionType(u) {
  if (!u) return '';
  if (UNION_TYPES.includes(u.type)) return u.type;
  for (const [id, other] of [[u.a, u.b], [u.b, u.a]]) {
    const situation = P(id) && P(id).situation;
    if (['married', 'remarried', 'pacs', 'cohabiting'].includes(situation)) {
      const last = partnersOf(id).pop();
      if (last && last.id === other) return situation;
    }
  }
  return '';
}

/** Union ends; labels in i18n.js ("ue.<code>"). */
export const UNION_ENDS = ['death', 'divorce', 'separation'];

/** "Divorce, 1980", or empty if the union has no end given. */
export function unionEndText(u) {
  if (!u || !UNION_ENDS.includes(u.end)) return '';
  return [t('ue.' + u.end), longDate(u.endDate)].filter(Boolean).join(', ');
}

/** "after the death of Marc GARNIER", or empty if it isn't a remarriage with a known cause. */
export function unionCauseText(u) {
  if (!u || u.type !== 'remarried' || !REMARRIAGE_CAUSES.includes(u.cause)) return '';
  const former = u.cause === 'widowed' && P(u.formerId);
  return t('urt.' + u.cause, former ? fullName(former) : '');
}

/**
 * Default end date of a union: the death of the first of the two spouses.
 * null if both are alive; empty if the date of death isn't known.
 */
export function unionDeathEnd(a, b) {
  const dead = [a, b].filter((p) => p && isDead(p));
  if (!dead.length) return null;
  const dates = dead.map((p) => String(p.deathDate || '').trim()).filter(Boolean);
  return dates.sort((x, y) => (yearOf(x) || 9999) - (yearOf(y) || 9999))[0] || '';
}

/** Label of a union's type, or empty if it isn't known. */
export function unionTypeLabel(u) {
  const code = unionType(u);
  return code ? t('ut.' + code) : '';
}

/** Event types; labels in i18n.js ("ev.<type>"), tags in gedcom.js. */
export const EVENT_TYPES = ['baptism', 'burial', 'cremation', 'census', 'residence', 'occupation', 'emigration',
  'immigration', 'naturalization', 'graduation', 'retirement', 'will', 'other'];

/** Source types; labels in i18n.js ("src.<kind>"). */
export const SOURCE_KINDS = ['birth', 'baptism', 'marriage', 'death', 'burial', 'census', 'military', 'notary',
  'family', 'book', 'web', 'other'];

const listOf = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);

export { sourcesOf } from './sources.js';
export const mediaList = (p) => listOf(p && p.media);

// File names a camera, a phone or a scanner gives: they say nothing of the image
const DEVICE_NAME = /^(img|image|photo|pic|picture|dsc|dscn|dcim|pxl|mvimg|scan|scanned|numérisation|capture|screenshot|whatsapp image|signal|wp|p)?[\s_\-.]*[\d\s_\-.:()]*$/i;

/** Title from a file's name, when it means something ("mariage.jpg"); '' for "IMG_1234.jpg" or "photo.jpg". */
export function fileTitle(name) {
  const base = String(name || '').replace(/\.[^.]+$/, '').trim();
  return !base || DEVICE_NAME.test(base) || /^whatsapp image /i.test(base) ? '' : base;
}

/**
 * Name of a gallery image: its title, or else the people identified on it (three at most) and its
 * date, or else '' (the caller shows "Untitled image").
 */
export function mediaLabel(m) {
  if (!m) return '';
  if (String(m.title || '').trim()) return String(m.title).trim();
  const ids = [...new Set((Array.isArray(m.tags) ? m.tags : []).map((x) => x && x.id))].filter((id) => P(id));
  const names = ids.slice(0, 3).map((id) => fullName(P(id))).join(', ') + (ids.length > 3 ? ' +' + (ids.length - 3) : '');
  return [names, String(m.date || '').trim()].filter(Boolean).join(' · ');
}

/** A person's gallery: their images, and those where they are identified: [{ owner, m }]. */
export function mediaOf(id) {
  const out = mediaList(P(id)).map((m) => ({ owner: id, m }));
  for (const [owner, p] of S.people) {
    if (owner === id) continue;
    for (const m of mediaList(p)) if (listOf(m.tags).some((x) => x.id === id)) out.push({ owner, m });
  }
  return out;
}

/**
 * People named in a text (a photo caption): first given name and surname (in use or at
 * birth) both present, ignoring accents and hyphens. In the order of the text.
 */
export function peopleNamedIn(text) {
  const split = (s) => norm(s).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  // A person is named within a single chunk: commas, full stops, brackets and lone dashes separate
  const parts = String(text || '').split(/[,;:.()–—]|\s-\s/).map(split);
  const found = [];
  for (const [id, p] of S.people) {
    const givens = split(p.given);
    const first = split(String(p.given || '').trim().split(/[\s,]+/)[0]);
    const names = [p.surname, p.maidenName].map(split).filter((x) => x.length);
    let pos = -1;
    parts.forEach((words, part) => {
      const starts = (seq) => words.map((_, i) => i).filter((i) => seq.every((w, k) => words[i + k] === w));
      for (const g of first.length ? starts(first) : []) {
        const after = g + first.length;
        const near = names.some((name) => starts(name).some((n) =>
          // The surname after the first name, separated only by their other given names; or just before ("LEMAIRE Geneviève")
          (n >= after && words.slice(after, n).every((w) => givens.includes(w))) || n + name.length === g));
        if (near && pos < 0) pos = part * 1000 + g;
      }
    });
    if (pos >= 0) found.push({ id, pos });
  }
  return found.sort((a, b) => a.pos - b.pos).map((x) => x.id);
}

/** All the images in the tree. */
export const allMedia = () => [...S.people].flatMap(([owner, p]) => mediaList(p).map((m) => ({ owner, m })));

/** A person's events, in date order (with no readable date: at the end). */
export function eventsOf(p) {
  const key = (e) => {
    const b = dateBounds(e.date);
    return b && Number.isFinite(b.lo) ? b.lo : b ? b.hi : Infinity;
  };
  return listOf(p && p.events).sort((a, b) => key(a) - key(b));
}

export const eventLabel = (e) => (e.type === 'other' && e.label) || t(EVENT_TYPES.includes(e.type) ? 'ev.' + e.type : 'ev.other');

/** Label of the fact supported by a source of person `id`; empty for the record in general. */
export function factLabel(id, fact) {
  if (fact === 'birth') return t('birth');
  if (fact === 'death') return t('death');
  if (String(fact || '').startsWith('union:')) {
    const u = S.unions.get(fact.slice(6));
    if (!u) return '';
    return t('with', fullName(P(u.a === id ? u.b : u.a)));
  }
  const e = listOf(P(id) && P(id).events).find((x) => x.id === fact);
  return e ? eventLabel(e) : '';
}

/** Tree card: the name on one line, "née FAURE" on the next (empty with no maiden name). */
export function cardNames(p) {
  const s = surname(p);
  const m = maiden(p);
  return { name: s || m, maiden: s && m ? t('nee') + ' ' + m : '' };
}

/** Full name with the maiden name: "Marguerite DUPONT née FAURE". */
export function longName(p) {
  const m = maiden(p);
  return fullName(p) + (m && surname(p) ? ' ' + t('nee') + ' ' + m : '');
}

export const isPhotoData = (s) => /^data:image\/(jpeg|png|webp|gif);base64,/.test(String(s || ''));
/** Start of a photo's file name: "GARNIER-Paul", "photo" for a record with no name. */
export function photoLabel(p) {
  const name = [surname(p) || String(p.maidenName || '').trim().toUpperCase(), given(p)].join(' ').normalize('NFC');
  return name.replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'photo';
}

export const isPhotoFile = (s) => /^photos\/[^/\\]+\.(jpg|png|webp|gif)$/.test(String(s || ''));

/**
 * Displayable address of a saved photo (photo field of a record), or '':
 * data URL as is, local server file; other addresses are ignored.
 */
export function photoSrc(s) {
  if (isPhotoData(s)) return s;
  if (isPhotoFile(s) && S.mode === 'file') {
    return `api/trees/${encodeURIComponent(S.tree)}/photos/${encodeURIComponent(s.slice(7))}`;
  }
  return '';
}

/** The person's photo (displayable address), or ''. */
export const photoOf = (p) => photoSrc(p && p.photo);

const AVATARS = { F: 'images/avatar_femme.jpeg', M: 'images/avatar_homme.jpeg', U: 'images/avatar_neutre.jpeg' };

/** Default avatar by sex; neutral if the sex isn't specified. */
export const avatarOf = (sex) => AVATARS[sex] || AVATARS.U;

export function fullName(p) {
  if (!p) return t('unknownPerson');
  const g = given(p);
  const s = surname(p) || maiden(p);
  return g || s ? [g, s].filter(Boolean).join(' ') : t('noName');
}

export function cmpName(pa, pb) {
  return (surname(pa) || '~').localeCompare(surname(pb) || '~', getLang()) || given(pa).localeCompare(given(pb), getLang());
}

/* ---------- Search ---------- */

/** Search words, lowercase and without accents. */
export const queryWords = (query) => norm(query).split(/\s+/).filter(Boolean);

/**
 * True if every search word appears in the person's name, places, occupation
 * or dates, in any order.
 */
export function matchesWords(p, words) {
  if (!words.length) return true;
  const text = norm([given(p), surname(p), maiden(p), p.birthPlace, p.deathPlace, p.occupation, p.birthDate, p.deathDate].join(' '));
  return words.every((w) => text.includes(w));
}

/** Sort by birth year, then by name. */
export function byBirth(a, b) {
  const pa = P(a);
  const pb = P(b);
  const ya = yearOf(pa && pa.birthDate) || 9999;
  const yb = yearOf(pb && pb.birthDate) || 9999;
  if (ya !== yb) return ya - yb;
  return fullName(pa).localeCompare(fullName(pb), getLang());
}

/* ---------- Life dates ---------- */

export const isDead = (p) =>
  !!(String(p.deathDate || '').trim() || String(p.deathPlace || '').trim() || p.deceased);

/**
 * Whether a death certificate number is known for `p`: a source of the death (a death record, or
 * one citing the death) with a number in its reference, or in its title ("Acte n°412", as INSEE adds it).
 */
export const hasDeathNumber = (p) => sourcesOf(p).some((s) => (s.kind === 'death' || s.fact === 'death')
  && (/\d/.test(String(s.ref || '')) || /\b(n|no|num[ée]ro)\s*[°º.]?\s*\d/i.test(String(s.title || ''))));

/** Whether `p` passes tree filter `filter` ('' lets everyone through). */
export function passesFilter(p, filter) {
  if (filter === 'living') return !isDead(p);
  if (filter === 'certificate') return hasDeathNumber(p);
  return true;
}

/** "1932 – 2004", "° 1958" or "† 1971". */
export function lifeYears(p) {
  const b = shortDate(p.birthDate);
  const d = shortDate(p.deathDate);
  if (b && d) return b + ' – ' + d;
  if (b) return '° ' + b;
  if (d) return '† ' + d;
  return '';
}

/** Dates line of a tree card. */
export function cardDates(p) {
  const b = shortDate(p.birthDate);
  const d = shortDate(p.deathDate);
  const out = [];
  if (b) out.push('° ' + b);
  if (d) out.push('† ' + d);
  else if (isDead(p)) out.push('†');
  return out.join('  ');
}

/** Current age or age at death, or null if it can't be computed. */
export function ageInfo(p) {
  const by = yearOf(p.birthDate);
  if (!by) return null;
  const bf = fullDate(p.birthDate);

  if (isDead(p)) {
    const dy = yearOf(p.deathDate);
    if (!dy) return null;
    const df = fullDate(p.deathDate);
    if (bf && df) {
      let a = df.y - bf.y;
      if (df.m < bf.m || (df.m === bf.m && df.d < bf.d)) a--;
      return { label: t('ageDeath'), text: t('years', a), dead: true };
    }
    return { label: t('ageDeath'), text: t('about', dy - by), dead: true };
  }

  const now = new Date();
  const approx = now.getFullYear() - by;
  if (approx > 105 || approx < 0) return null;
  if (bf) {
    let a = now.getFullYear() - bf.y;
    const mm = now.getMonth() + 1;
    const dd = now.getDate();
    if (mm < bf.m || (mm === bf.m && dd < bf.d)) a--;
    return { label: t('age'), text: t('years', a) };
  }
  return { label: t('age'), text: t('about', approx) };
}

// Ages below which the tree and the record don't offer additions
export const CHILD_AGE = 17; // a child
export const UNION_AGE = 15; // a spouse or a union: age of consent (people used to marry from 15)

/**
 * True if the person is surely under `age`, today or at their death: the tree and the record
 * don't offer to add a child (CHILD_AGE) or a spouse (UNION_AGE). An uncertain
 * or missing date proves nothing.
 */
export function isMinor(p, now = new Date(), age = CHILD_AGE) {
  const birth = dateBounds(p && p.birthDate);
  if (!birth || !Number.isFinite(birth.lo)) return false;
  let end = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  if (isDead(p)) {
    const death = dateBounds(p.deathDate);
    if (!death || !Number.isFinite(death.hi)) return false;
    end = death.hi;
  }
  return yearsBetween(birth.lo, end) < age;
}

/* ---------- Kinship links ---------- */

/** Number of generations of ancestors above person `id` (0 with no known parent). */
export function ancestorDepth(id) {
  let depth = 0;
  let row = [id];
  const seen = new Set(row);
  for (;;) {
    const next = row.flatMap((x) => [P(x).fatherId, P(x).motherId]).filter((k) => P(k) && !seen.has(k) && seen.add(k));
    if (!next.length) return depth;
    depth++;
    row = next;
  }
}

/** Descendants of person `id`, generation by generation: [[children], [grandchildren], …]. */
export function descendantRows(id) {
  const rows = [];
  let row = [id];
  const seen = new Set(row);
  for (;;) {
    const next = row.flatMap((x) => childrenOf(x)).filter((k) => !seen.has(k) && seen.add(k));
    if (!next.length) return rows;
    rows.push(next);
    row = next;
  }
}

/** Number of generations of descendants under person `id` (0 with no child). */
export const descendantDepth = (id) => descendantRows(id).length;

/** Recomputes the children and spouses indexes from the people and unions. */
// Changes each time the data may have changed: computations kept in memory (checks.js) start over
let version = 0;
export const dataVersion = () => version;
export const dataChanged = () => { version++; };

export function reindex() {
  version++;
  idx.children = new Map();
  idx.partners = new Map();

  const addPartner = (a, b, uid) => {
    if (!a || !b || a === b) return;
    let m = idx.partners.get(a);
    if (!m) {
      m = new Map();
      idx.partners.set(a, m);
    }
    m.set(b, uid || m.get(b) || null);
  };

  // Declared unions
  for (const [uid, u] of S.unions) {
    if (S.people.has(u.a) && S.people.has(u.b)) {
      addPartner(u.a, u.b, uid);
      addPartner(u.b, u.a, uid);
    }
  }

  // Children, and couples deduced from shared parents
  for (const [id, p] of S.people) {
    const seen = new Set();
    for (const key of ['fatherId', 'motherId']) {
      const parent = p[key];
      if (parent && parent !== id && S.people.has(parent) && !seen.has(parent)) {
        seen.add(parent);
        if (!idx.children.has(parent)) idx.children.set(parent, []);
        idx.children.get(parent).push(id);
      }
    }
    if (p.fatherId && p.motherId && S.people.has(p.fatherId) && S.people.has(p.motherId)) {
      addPartner(p.fatherId, p.motherId, null);
      addPartner(p.motherId, p.fatherId, null);
    }
  }

  for (const list of idx.children.values()) list.sort(byBirth);
}

export const childrenOf = (id) => idx.children.get(id) || [];

/** Spouses, sorted by union date. `uid` is null for a couple deduced from the children. */
export function partnersOf(id) {
  const m = idx.partners.get(id);
  if (!m) return [];
  const list = [...m].map(([pid, uid]) => ({ id: pid, uid }));
  const key = (x) => {
    if (!x.uid) return 99999;
    const u = S.unions.get(x.uid);
    return yearOf(u && u.date) || (u && u.createdAt ? 5000 : 9000);
  };
  return list.sort((a, b) => key(a) - key(b));
}

/** Siblings, with "same father" or "same mother" for half-siblings. */
export function siblingsOf(id) {
  const p = P(id);
  if (!p || (!p.fatherId && !p.motherId)) return [];
  const out = [];
  for (const [k, q] of S.people) {
    if (k === id) continue;
    const sameFather = !!p.fatherId && q.fatherId === p.fatherId;
    const sameMother = !!p.motherId && q.motherId === p.motherId;
    if (sameFather || sameMother) {
      let half = '';
      if (!(sameFather && sameMother) && p.fatherId && p.motherId && q.fatherId && q.motherId) {
        half = t(sameFather ? 'sameFather' : 'sameMother');
      }
      out.push({ id: k, half });
    }
  }
  return out.sort((a, b) => byBirth(a.id, b.id));
}

export function unionBetween(a, b) {
  return !!unionIdBetween(a, b);
}

/** Id of the union between two people, or empty. */
export function unionIdBetween(a, b) {
  for (const [uid, u] of S.unions) {
    if ((u.a === a && u.b === b) || (u.a === b && u.b === a)) return uid;
  }
  return '';
}

function ancestorCount(id, gen, limit) {
  if (gen >= limit) return 0;
  const p = P(id);
  if (!p) return 0;
  let n = 0;
  for (const key of ['fatherId', 'motherId']) {
    const q = p[key];
    if (q && S.people.has(q)) n += 1 + ancestorCount(q, gen + 1, limit);
  }
  return n;
}

/** Person to centre by default: the one with the most known ancestors over 3 generations. */
export function defaultFocus() {
  let best = null;
  let bestScore = -1;
  let bestYear = -1;
  for (const [id, p] of S.people) {
    const score = ancestorCount(id, 0, 3);
    const y = yearOf(p.birthDate) || 0;
    if (score > bestScore || (score === bestScore && y > bestYear)) {
      best = id;
      bestScore = score;
      bestYear = y;
    }
  }
  return best;
}
