/**
 * Shared sources (format version 2).
 *
 * A source is a document (a birth certificate, a census page…), kept once in S.sources with
 * its photo. A person cites it: person.citations = [{ id, source, fact, role? }], where `fact` is
 * the fact the document supports ('birth', 'death', an event id, 'union:<union id>', or '' for
 * the whole record), and `role` the person's part in it (CITATION_ROLES; missing: the person
 * the document is about). Two people citing the same certificate share it: one photo, one place.
 *
 * The rest of the application still sees each person's sources as one list of documents,
 * as in version 1: sourcesOf() joins each citation with its source. Writers keep handing
 * such lists over; splitSources() turns them back into citations and sources on save.
 * Records from before version 2 (person.sources, the documents themselves) are read as they are.
 */
import { S } from '../state.js';
import { rid } from '../utils/helpers.js';

/** A person's part in a document: the one it is about, a parent, the spouse, a witness. */
export const CITATION_ROLES = ['subject', 'father', 'mother', 'spouse', 'witness'];
const roleOf = (r) => (CITATION_ROLES.includes(r) && r !== 'subject' ? r : '');

/** Fields of the document itself, shared by all who cite it. */
export const SOURCE_FIELDS = ['kind', 'title', 'place', 'ref', 'note', 'photo', 'back'];

const listOf = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);

/** The document's fields of `x`, without the empty ones. */
export function sourceData(x) {
  const out = {};
  for (const key of SOURCE_FIELDS) if (x[key] !== undefined && x[key] !== '' && x[key] !== null) out[key] = x[key];
  return out;
}

/**
 * A person's sources as documents, version 1 style: [{ id, fact, source, kind, title, place, ref,
 * note, photo, back }]; `id` is the citation's, `source` the shared document's (missing for a record
 * from before version 2). A citation whose source hasn't arrived yet (online database) shows empty.
 */
export function sourcesOf(p, sources = S.sources) {
  if (!p) return [];
  if (!Array.isArray(p.citations)) return listOf(p.sources);
  return listOf(p.citations).map((c) => ({
    ...(sources.get(c.source) || {}), id: c.id, fact: c.fact || '', ...(roleOf(c.role) ? { role: roleOf(c.role) } : {}), source: c.source,
  }));
}

/** Short stable hash of a text (cyrb53): the same document always gets the same id. */
function hash(text) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const keyOf = (data) => JSON.stringify(SOURCE_FIELDS.map((k) => (typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k] ?? '')));

/**
 * Id of a version 1 document. Two documents with the same certificate number or the same image,
 * and the same content, are one shared source; a document with neither (a birth certificate not
 * yet found…) stays its own: `own` tells them apart. The id comes from the content, so migrating
 * twice, or from two places at once, gives the same sources.
 */
function legacyId(data, own) {
  const shared = data.ref || data.photo;
  return 'S' + hash(keyOf(data) + (shared ? '' : '|' + own));
}

/**
 * Version 1 records to version 2: people (Map id -> person) whose `sources` become citations,
 * and the documents gathered in a Map id -> source. Records already in version 2 stay as they are.
 */
export function migratePeople(people, sources = new Map()) {
  const out = new Map();
  for (const [id, p] of people) {
    if (!p || !Array.isArray(p.sources) || Array.isArray(p.citations)) {
      out.set(id, p);
      continue;
    }
    const { sources: list, ...rest } = p;
    rest.citations = listOf(list).map((x, i) => {
      const data = sourceData(x);
      const sid = legacyId(data, id + '|' + (x.id || i));
      if (!sources.has(sid)) sources.set(sid, data);
      const citation = { id: x.id || 'c' + i, source: sid, fact: x.fact || '' };
      if (roleOf(x.role)) citation.role = roleOf(x.role); // a format 1 file written by Lignée 2 keeps it
      return citation;
    });
    out.set(id, rest);
  }
  return { people: out, sources };
}

/** Back to version 1: each person carries copies of the documents they cite (JSON for older Lignée). */
export function inlineSources(people, sources) {
  const out = new Map();
  for (const [id, p] of people) {
    if (!p || !Array.isArray(p.citations)) {
      out.set(id, p);
      continue;
    }
    const { citations, ...rest } = p;
    const list = sourcesOf(p, sources).map(({ source, role, ...x }) => (role ? { ...x, role } : x));
    if (list.length) rest.sources = list;
    out.set(id, rest);
  }
  return out;
}

/** Ids of the sources cited by the people of `people` (a Map), other than `except` (a person id). */
export function citedSources(people = S.people, except = null) {
  const used = new Set();
  for (const [id, p] of people) {
    if (id === except || !p) continue;
    for (const c of listOf(p.citations)) used.add(c.source);
  }
  return used;
}

/**
 * A person's sources as documents (version 1 style, as the form or a merge produce them) to save:
 * returns { citations, writes: [[source id, document]], drops: [source id] }. A document keeps its
 * source when it has one: changing it changes it for everyone who cites it. `before`: the person
 * before the change; their sources nobody cites any more are dropped.
 */
export function splitSources(id, list, before) {
  const citations = [];
  const chosen = new Map();
  const seen = new Set();
  for (const x of listOf(list)) {
    if (x.removed) continue;
    const sid = x.source && typeof x.source === 'string' ? x.source : rid('S');
    // The same source cited twice for the same fact (two records merged): once is enough
    const key = sid + '|' + (x.fact || '') + '|' + roleOf(x.role);
    if (x.source && seen.has(key)) continue;
    seen.add(key);
    const data = sourceData(x);
    // The same source cited twice by the form: the copy that changed wins
    const current = S.sources.get(sid);
    if (!chosen.has(sid) || (current && keyOf(chosen.get(sid)) === keyOf(current))) chosen.set(sid, data);
    const citation = { id: x.id || rid('c'), source: sid, fact: x.fact || '' };
    if (roleOf(x.role)) citation.role = roleOf(x.role);
    citations.push(citation);
  }
  const writes = [...chosen].filter(([sid, data]) => !S.sources.has(sid) || keyOf(S.sources.get(sid)) !== keyOf(data));
  const kept = new Set(citations.map((c) => c.source));
  const others = citedSources(S.people, id);
  const drops = [...new Set(listOf(before && before.citations).map((c) => c.source))]
    .filter((sid) => !kept.has(sid) && !others.has(sid) && S.sources.has(sid));
  return { citations, writes, drops };
}
