/**
 * Saving a record from the form: the record itself, then what follows from it — the new
 * parent's links, the unions of the form, and the situations kept in step with the unions
 * (the spouse's situation, the end of a union at a death, a remarriage's previous union).
 *
 * These functions only write through opSet / opUpdate / opDelete: run them in inBatch()
 * so the whole record is stored at once, or not at all.
 */
import { S } from '../state.js';
import { rid } from '../utils/helpers.js';
import {
  P, partnersOf, unionBetween, unionIdBetween, unionDeathEnd, currentSituation, reindex, unionType, isDead, DATED_SITUATIONS,
} from '../model/people.js';
import { opSet, opUpdate, opDelete, storePhoto, GALLERY_LABEL } from './storage.js';

/** Situations shared with the current spouse. */
const COUPLE_SITUATIONS = new Set(['married', 'remarried', 'pacs', 'cohabiting']);

/** Situation of a single person -> end of their last union. */
const ENDING_SITUATIONS = { widowed: 'death', divorced: 'divorce', separated: 'separation' };

/** Saved fields of a union row: the cause only applies to a remarriage. */
export function unionFields(u) {
  const cause = u.type === 'remarried' ? u.cause : '';
  return {
    type: u.type, date: u.date.trim(), place: u.place.trim(), end: u.end, endDate: u.endDate.trim(),
    cause, formerId: cause === 'widowed' ? u.formerId : '',
  };
}

/** The person's unions: with no other end given, they stop at the death of the first spouse. */
export async function closeUnionsAtDeath(id) {
  for (const x of partnersOf(id)) {
    const date = x.uid ? unionDeathEnd(P(id), P(x.id)) : null;
    if (date === null) continue;
    const u = S.unions.get(x.uid);
    if (!u.end) await opUpdate('unions', x.uid, { end: 'death', endDate: date });
    else if (u.end === 'death' && !u.endDate && date) await opUpdate('unions', x.uid, { endDate: date });
  }
}

/** A remarriage's cause gives the end of the previous union, if it has none. */
async function endFormerUnion(id, row) {
  const { cause, formerId } = unionFields(row);
  if (row.removed || !cause) return;
  const uid = cause === 'widowed'
    ? unionIdBetween(id, formerId) || unionIdBetween(row.other, formerId)
    : (partnersOf(id).filter((x) => x.uid && x.id !== row.other).pop() || {}).uid;
  if (uid && !S.unions.get(uid).end) await opUpdate('unions', uid, { end: cause === 'widowed' ? 'death' : 'divorce' });
}

/** Record to store from the form's draft: trimmed fields, events and sources (the gallery: saveGallery). */
async function recordData(e, id, previous) {
  const d = e.draft;
  const data = {
    given: d.given.trim(),
    surname: d.surname.trim(),
    maidenName: d.sex === 'F' ? d.maidenName.trim() : '',
    sex: d.sex || 'U',
    birthDate: d.birthDate.trim(),
    birthPlace: d.birthPlace.trim(),
    deathDate: d.deathDate.trim(),
    deathPlace: d.deathPlace.trim(),
    deceased: !!(d.deceased || d.deathDate.trim() || d.deathPlace.trim()),
    occupation: d.occupation.trim(),
    situation: d.situation || '',
    situationDate: DATED_SITUATIONS.has(d.situation) ? d.situationDate.trim() : '',
    notes: d.notes.trim(),
    fatherId: d.fatherId || null,
    motherId: d.motherId || null,
    createdAt: (previous && previous.createdAt) || Date.now(),
    updatedAt: Date.now(),
  };
  if (d.photo) data.photo = await storePhoto(d.photo, data);
  if (previous && previous.example) data.example = true;

  const events = e.events.filter((x) => !x.removed).map(({ removed, ...x }) => ({
    ...x, date: x.date.trim(), place: x.place.trim(), note: x.note.trim(),
  }));
  if (events.length) data.events = events;
  const facts = new Set(events.map((x) => x.id));
  const sources = [];
  for (const { removed, ...x } of e.sources) {
    const s = { ...x, title: x.title.trim(), place: x.place.trim(), ref: x.ref.trim(), note: x.note.trim() };
    if (removed || !(s.title || s.place || s.ref || s.note || s.photo)) continue;
    // Fact removed from the form: the source stays, for the record in general
    if (/^e_/.test(s.fact) && !facts.has(s.fact)) s.fact = '';
    if (s.photo) s.photo = await storePhoto(s.photo, data);
    else delete s.photo;
    if (s.photo && s.back) s.back = await storePhoto(s.back, data); // back of the document
    else delete s.back;
    sources.push(s);
  }
  data.sources = sources; // even empty: the sources nobody cites any more are then deleted
  data.unionSources = e.unionSources || [];
  return data;
}

const listOf = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);

/**
 * The form's gallery, in the tree's gallery (model/media.js): each image kept shows the person
 * (identified on it, with a marker or not); an image removed from the form no longer shows them,
 * but stays in the tree's gallery.
 */
async function saveGallery(e, id) {
  for (const { removed, id: mid, ...x } of e.media) {
    const before = S.media.get(mid);
    if (removed) {
      if (before && listOf(before.tags).some((tag) => tag.id === id)) {
        await opUpdate('media', mid, { tags: listOf(before.tags).filter((tag) => tag.id !== id) });
      }
      continue;
    }
    const tags = listOf(x.tags);
    if (!tags.some((tag) => tag.id === id)) tags.unshift({ id });
    const m = {
      ...(before || { createdAt: Date.now() }), ...x, tags,
      title: x.title.trim(), date: x.date.trim(), note: x.note.trim(), photo: await storePhoto(x.photo, GALLERY_LABEL),
    };
    // Its back: a contract's second side, a photo's annotated back
    if (x.back) m.back = await storePhoto(x.back, GALLERY_LABEL);
    else delete m.back;
    if (JSON.stringify(m) !== JSON.stringify(before)) await opSet('media', mid, m);
  }
}

/** New parent: linked to the child, and the union with the other parent is created if known. */
async function linkNewParent(e, id) {
  if ((e.rel !== 'father' && e.rel !== 'mother') || !S.people.has(e.of)) return;
  const field = e.rel === 'father' ? 'fatherId' : 'motherId';
  await opUpdate('people', e.of, { [field]: id });
  const child = P(e.of);
  const other = e.rel === 'father' ? child.motherId : child.fatherId;
  if (other && S.people.has(other) && !unionBetween(id, other)) {
    await opSet('unions', rid('u'), { a: other, b: id, date: '', place: '', createdAt: Date.now() });
  }
}

/** Unions changed, removed or added in the form. */
async function saveUnions(e, id) {
  for (const u of e.unions) {
    if (u.uid) {
      if (u.removed) await opDelete('unions', u.uid);
      else if (Object.entries(unionFields(u)).some(([k, v]) => v !== u.orig[k])) await opUpdate('unions', u.uid, unionFields(u));
    } else if (!u.removed && S.people.has(u.other) && !unionBetween(id, u.other)) {
      await opSet('unions', rid('u'), { a: u.other, b: id, ...unionFields(u), createdAt: Date.now() });
    }
  }
}

/** Situations and unions kept in step after the record `data` was saved. */
async function syncSituations(e, id, data, previous) {
  reindex();
  await closeUnionsAtDeath(id);
  for (const u of e.unions) await endFormerUnion(id, u);

  // Last union changed, situation unchanged: the union sets the situation
  const latest = partnersOf(id).pop();
  const row = latest && e.unions.find((u) => !u.removed && u.other === latest.id);
  if (row && (!row.uid || row.type !== row.orig.type || row.end !== row.orig.end)
    && data.situation === ((previous && previous.situation) || '')) {
    const code = currentSituation(id);
    const now = code === 'married' && row.type === 'remarried' ? 'remarried' : code;
    if (now !== data.situation) {
      data.situation = now;
      data.situationDate = DATED_SITUATIONS.has(now) ? row.date.trim() : '';
      await opUpdate('people', id, { situation: now, situationDate: data.situationDate });
    }
  }

  // Married, in a civil partnership or cohabiting: the date (marriage or partnership) is that of
  // the most recent union (previous unions keep theirs), and the current
  // spouse takes the same situation
  // Widowed, divorced or separated: it's the end of the last union, if it doesn't already have one
  if (ENDING_SITUATIONS[data.situation]) {
    reindex();
    const last = partnersOf(id).pop();
    if (last && last.uid && !S.unions.get(last.uid).end) await opUpdate('unions', last.uid, { end: ENDING_SITUATIONS[data.situation] });
  }
  if (COUPLE_SITUATIONS.has(data.situation)) {
    reindex();
    const current = partnersOf(id).pop();
    // The spouse hasn't necessarily remarried: for them, "remarried" means "married"
    const shared = data.situation === 'remarried' ? 'married' : data.situation;
    // Union of unspecified type or status changed: the situation gives the type (same codes)
    if (current && current.uid) {
      const { type } = S.unions.get(current.uid);
      const changed = !previous || previous.situation !== data.situation;
      const same = type === data.situation || (type === 'religious' && shared === 'married')
        || (type === 'remarried' && data.situation === 'married');
      if (!type || (changed && !same)) await opUpdate('unions', current.uid, { type: data.situation });
    }
    let date = data.situationDate;
    if (DATED_SITUATIONS.has(data.situation)) {
      const u = current && current.uid && S.unions.get(current.uid);
      // A situation date changed in the form prevails; otherwise, the union's
      const typed = date && date !== ((previous && previous.situationDate) || '');
      const unionDate = u ? String(u.date || '').trim() : '';
      if (u && date && (typed || !unionDate) && date !== unionDate) await opUpdate('unions', current.uid, { date });
      else if (unionDate) date = unionDate;
      if (date !== data.situationDate) await opUpdate('people', id, { situationDate: date });
    }

    // Only if the person is also the spouse's last union
    const spouse = current && P(current.id);
    const spouseCurrent = spouse && partnersOf(current.id).pop();
    if (spouseCurrent && spouseCurrent.id === id && !(current.uid && S.unions.get(current.uid).end)
      && (spouse.situation !== shared || (spouse.situationDate || '') !== date)
      && !(spouse.situation === 'remarried' && shared === 'married')) {
      await opUpdate('people', current.id, { situation: shared, situationDate: date, updatedAt: Date.now() });
    }
  } else if (!data.situation || data.situation === 'single') {
    // With no couple status: the person takes that of the current union
    reindex();
    const current = partnersOf(id).pop();
    const u = current && current.uid && S.unions.get(current.uid);
    const type = u && !u.end && !isDead(P(current.id)) && partnersOf(current.id).pop().id === id ? unionType(u) : '';
    const shared = type === 'religious' ? 'married' : type;
    if (COUPLE_SITUATIONS.has(shared)) {
      if (!u.type) await opUpdate('unions', current.uid, { type: shared });
      await opUpdate('people', id, { situation: shared, situationDate: DATED_SITUATIONS.has(shared) ? String(u.date || '').trim() : '' });
    }
  }

  // Union ended: the spouse whose last union it is is also widowed, divorced or separated
  reindex();
  const ended = partnersOf(id).pop();
  if (ended && ended.uid && S.unions.get(ended.uid).end && partnersOf(ended.id).pop().id === id) {
    const code = currentSituation(ended.id);
    if (ENDING_SITUATIONS[code] && P(ended.id).situation !== code) {
      await opUpdate('people', ended.id, { situation: code, situationDate: '', updatedAt: Date.now() });
    }
  }
}

/** Saves the form `e` (S.edit) and returns the record's id. */
export async function savePerson(e) {
  const id = e.id || rid('p');
  const previous = e.id ? P(e.id) : null;
  const data = await recordData(e, id, previous);
  await opSet('people', id, data);
  await saveGallery(e, id);
  await linkNewParent(e, id);
  await saveUnions(e, id);
  await syncSituations(e, id, data, previous);
  return id;
}
