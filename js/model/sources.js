/**
 * Shared sources (format version 2).
 *
 * A source is a document (a birth certificate, a census page…), kept once in S.sources with
 * its photo. A person cites it: person.citations = [{ id, source, fact, role? }], where `fact` is
 * the fact the document supports ('birth', 'death', an event id, 'union:<union id>', or '' for
 * the whole record), and `role` the person's part in it (CITATION_ROLES; missing: the person
 * the document is about). Two people citing the same certificate share it: one photo, one place.
 *
 * The rest of the application sees each person's sources as one list of documents: sourcesOf()
 * joins each citation with its source, sourcesOfPerson() adds the person's unions' documents.
 * Writers hand such lists over; planSources() turns them back into citations and sources on save.
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
 * Id of an imported document. Two documents with the same certificate number or the same image,
 * and the same content, are one shared source; a document with neither (a birth certificate not
 * yet found…) stays its own: `own` tells them apart. The id comes from the content: importing
 * twice gives the same sources.
 */
function documentId(data, own) {
  const shared = data.ref || data.photo;
  return 'S' + hash(keyOf(data) + (shared ? '' : '|' + own));
}

/**
 * People (Map id -> person) whose `sources` (documents) become citations, and the documents
 * gathered in a Map id -> source. Records already citing sources stay as they are.
 */
function peopleFromDocuments(people, sources = new Map()) {
  const out = new Map();
  for (const [id, p] of people) {
    if (!p || !Array.isArray(p.sources) || Array.isArray(p.citations)) {
      out.set(id, p);
      continue;
    }
    const { sources: list, ...rest } = p;
    rest.citations = listOf(list).map((x, i) => {
      const data = sourceData(x);
      const sid = documentId(data, id + '|' + (x.id || i));
      if (!sources.has(sid)) sources.set(sid, data);
      const citation = { id: x.id || 'c' + i, source: sid, fact: x.fact || '' };
      if (roleOf(x.role)) citation.role = roleOf(x.role);
      return citation;
    });
    out.set(id, rest);
  }
  return { people: out, sources };
}

/**
 * Marriage documents cited by a spouse ('union:<id>' on the person) move to the union, which
 * both spouses share: returns { people, unions } (new Maps; records not concerned stay as they are).
 * The same document cited by both spouses becomes one citation. Nothing is dropped: a fact naming a
 * union the person isn't part of stays on the person.
 */
function marriagesToUnions(people, unions) {
  const outPeople = new Map(people);
  const outUnions = new Map(unions);
  for (const [id, p] of people) {
    if (!p || !Array.isArray(p.citations)) continue;
    const moving = p.citations.filter((c) => {
      const u = unions.get(unionOfFact(c && c.fact));
      return u && (u.a === id || u.b === id);
    });
    if (!moving.length) continue;
    const rest = p.citations.filter((c) => !moving.includes(c));
    const next = { ...p };
    if (rest.length) next.citations = rest;
    else delete next.citations;
    outPeople.set(id, next);
    for (const c of moving) {
      const uid = unionOfFact(c.fact);
      const u = { ...outUnions.get(uid) };
      const list = listOf(u.citations);
      if (!list.some((x) => x.source === c.source && roleOf(x.role) === roleOf(c.role))) {
        const citation = { id: c.id, source: c.source };
        if (roleOf(c.role)) citation.role = roleOf(c.role);
        u.citations = [...list, citation];
        outUnions.set(uid, u);
      }
    }
  }
  return { people: outPeople, unions: outUnions };
}

/**
 * Records whose people carry their documents (`sources`: [{ id, fact, kind, title, … }], as
 * the GEDCOM import reads them) to the tree's form: shared sources cited by the people, and
 * marriage documents cited by their union. Returns { people, unions, sources } (Maps).
 */
export function fromDocuments(people, unions = new Map()) {
  const step = peopleFromDocuments(people);
  const moved = marriagesToUnions(step.people, unions);
  return { people: moved.people, unions: moved.unions, sources: step.sources };
}

/** Ids of the sources cited by anyone: people (but `exceptPerson`) and unions. */
export function citedSources(people = S.people, exceptPerson = null, unions = S.unions) {
  const used = new Set();
  for (const [id, p] of people) {
    if (id === exceptPerson || !p) continue;
    for (const c of listOf(p.citations)) used.add(c.source);
  }
  for (const u of unions.values()) for (const c of listOf(u && u.citations)) used.add(c.source);
  return used;
}

/** Union of a fact 'union:<id>', or null. */
export const unionOfFact = (fact) => {
  const m = /^union:(.+)$/.exec(String(fact || ''));
  return m ? m[1] : null;
};

/**
 * All of a person's sources as documents: their own, and those of their unions (a marriage
 * certificate is cited by the union, so both spouses see it), with fact 'union:<id>'.
 * The same document cited both ways (a record from before unions held citations) shows once.
 */
export function sourcesOfPerson(id, { people = S.people, unions = S.unions, sources = S.sources } = {}) {
  const own = sourcesOf(people.get(id), sources);
  const seen = new Set(own.filter((x) => x.source).map((x) => x.source + '|' + x.fact));
  const fromUnions = [];
  for (const [uid, u] of unions) {
    if (!u || (u.a !== id && u.b !== id)) continue;
    for (const c of listOf(u.citations)) {
      const fact = 'union:' + uid;
      if (seen.has(c.source + '|' + fact)) continue;
      seen.add(c.source + '|' + fact);
      fromUnions.push({ ...(sources.get(c.source) || {}), id: c.id, fact, ...(roleOf(c.role) ? { role: roleOf(c.role) } : {}), source: c.source });
    }
  }
  return [...own, ...fromUnions];
}

/**
 * Documents (version 1 style, as the form or a merge produce them) to citations:
 * { citations, docs: Map source id -> document }. A document keeps its source when it has one:
 * changing it changes it for everyone who cites it. `withFact`: citations keep their fact
 * (a person's), or not (a union's: always its marriage).
 */
export function toCitations(list, withFact = true, chosen = new Map()) {
  const citations = [];
  const seen = new Set();
  for (const x of listOf(list)) {
    if (x.removed) continue;
    const sid = x.source && typeof x.source === 'string' ? x.source : rid('S');
    // The same source cited twice for the same fact (two records merged): once is enough
    const key = sid + '|' + (withFact ? x.fact || '' : '') + '|' + roleOf(x.role);
    if (x.source && seen.has(key)) continue;
    seen.add(key);
    const data = sourceData(x);
    // The same source cited twice: the copy that changed wins
    const current = S.sources.get(sid);
    if (!chosen.has(sid) || (current && keyOf(chosen.get(sid)) === keyOf(current))) chosen.set(sid, data);
    const citation = { id: x.id || rid('c'), source: sid };
    if (withFact) citation.fact = x.fact || '';
    if (roleOf(x.role)) citation.role = roleOf(x.role);
    citations.push(citation);
  }
  return { citations, docs: chosen };
}

/** Documents of `docs` (Map) that are new or changed compared with S.sources: [[id, document]]. */
export const changedDocs = (docs) => [...docs].filter(([sid, data]) => !S.sources.has(sid) || keyOf(S.sources.get(sid)) !== keyOf(data));

/**
 * Plan for saving person `id` whose `sources` are documents: { person citations, unions: Map union
 * id -> citations, writes }. A document of fact 'union:<id>' of one of the person's unions goes to
 * that union. A union's citations are replaced only if the caller saw them all: listed in
 * `shownUnions` (the form), or cited in the list (a list built with sourcesOfPerson); otherwise
 * the union keeps its own.
 */
export function planSources(id, list, shownUnions = []) {
  const member = new Set([...S.unions].filter(([, u]) => u && (u.a === id || u.b === id)).map(([uid]) => uid));
  const unionOf = (x) => {
    const uid = unionOfFact(x.fact);
    return uid && member.has(uid) ? uid : null;
  };
  const items = listOf(list).filter((x) => !x.removed);
  const docs = new Map();
  const person = toCitations(items.filter((x) => !unionOf(x)), true, docs);
  const touched = new Set([...shownUnions.filter((uid) => member.has(uid)), ...items.map(unionOf).filter(Boolean)]);
  const unions = new Map([...touched].map((uid) => [uid, toCitations(items.filter((x) => unionOf(x) === uid), false, docs).citations]));
  return { citations: person.citations, unions, writes: changedDocs(docs) };
}

/** Sources among `candidates` nobody cites any more (after the changes, in memory): to delete. */
export const orphanSources = (candidates) => {
  const used = citedSources();
  return [...new Set(candidates)].filter((sid) => sid && !used.has(sid) && S.sources.has(sid));
};
