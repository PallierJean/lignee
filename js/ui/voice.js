/**
 * Voice commands, seen by the user: the microphone at the end of the search field, and the bubble
 * under it that shows what was heard ("« … »"), then what was understood and done.
 *
 * Searching and opening a record are done at once. Adding or changing a person opens the usual
 * form, filled in with what was said: nothing is saved until the user clicks Save (and Ctrl+Z
 * undoes it as any change). Several people with the name said: the bubble asks which one.
 * A relative said who is already in the tree is linked to the record, instead of a new record.
 * A conversation, once a sentence is said at the microphone: when the form is filled in, Lignée reads
 * aloud what it understood and listens for the answer ("oui" saves, "non" cancels, a detail completes
 * the form); then it listens for the next command, until "c'est tout" or a silence.
 */
import { S, savePrefs } from '../state.js';
import { $, esc, setHTML } from '../utils/dom.js';
import { norm } from '../utils/helpers.js';
import { t } from '../i18n.js';
import { P, longName, lifeYears, given, surname, maiden, unionBetween, partnersOf } from '../model/people.js';
import { FIELDS, parseCommand, parseReply, parseDetails, parseChoice, isGoodbye, isNoise, fixName, soundKey } from '../model/voice.js';
import { voiceEngines, warmVoice, record, listen, understandText, needsDownload, speak, hush, loadVoices, chime } from '../services/voice.js';
import { parseSpokenPlace, formatPlace } from '../model/places.js';
import { loadCommunes, findCommune } from '../model/communes.js';
import { searchPeople, onFindInput } from './search.js';
import { renderSide } from './render.js';

const CONSENT_KEY = 'lignee.voice';

let act = null;     // the application's actions (from events.js)
let engines = null; // { listen, understand, server }
let rec = null;     // recording in progress: { stop, done }
let st = { phase: 'idle' };
let level = 0;
let refused = false; // browser language model declined, this time
let replies = 0;     // answers listened to for the open form (a few, then the user clicks)
let choices = 0;     // the same, to choose among people with the same name

const REPLY_WAIT = 12000; // the answer: nobody speaks for this long, the listening ends (and the bubble says so)
const MAX_REPLIES = 3;

/** Shows the microphone if this device can listen. `actions`: setFocus, startNew, startAdd, editPerson. */
export function initVoice(actions) {
  act = actions;
  loadVoices();
  return voiceEngines().then((e) => {
    engines = e;
    renderVoice();
  });
}

export const voiceOpen = () => st.phase !== 'idle';

function set(next) {
  // A form filled in by the voice: remembered, for the answer and the buttons of the bubble
  if (next.check && S.edit && !next.token) next.token = S.edit.token;
  st = next;
  renderVoice();
}

/** The form that the voice filled in is still the one open. */
const formOpen = () => !!(st.check && S.edit && S.edit.token === st.token);

/* ---------- Consent to downloads (in the browser only) ---------- */

function consent(what) {
  try {
    return !!JSON.parse(localStorage.getItem(CONSENT_KEY) || '{}')[what];
  } catch (e) {
    return false;
  }
}

function giveConsent(what) {
  try {
    const all = JSON.parse(localStorage.getItem(CONSENT_KEY) || '{}');
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ ...all, [what]: true }));
  } catch (e) {
    // Private browsing: asked again next time
  }
}

/** Answer to a download question: `what` = 'asr' (listening) or 'llm' (understanding). */
export function answerConsent(what, yes) {
  if (what === 'asr') {
    if (!yes) return closeVoice();
    giveConsent('asr');
    return startVoice(true);
  }
  if (yes) giveConsent('llm');
  else refused = true;
  return understand(st.text, { model: yes, spoken: st.spoken });
}

/* ---------- Listening ---------- */

/** The microphone button: starts listening, or ends the sentence. */
export function toggleVoice() {
  if (rec) {
    rec.stop();
    return;
  }
  startVoice();
}

/** Names and places of the tree, most frequent first, to help Whisper write them right (the server's Whisper only). */
function hint() {
  const count = new Map();
  for (const p of S.people.values()) {
    for (const w of [surname(p), ...given(p).split(' '), p.birthPlace].filter(Boolean)) count.set(w, (count.get(w) || 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1]).map(([w]) => w).join(', ').slice(0, 600);
}

export async function startVoice(agreed = false) {
  if (!engines || !engines.listen || rec) return;
  // Several people with the name said: the microphone chooses ("le premier", "celui de 1995")
  if (st.phase === 'choose') {
    choices = 0;
    return listenChoice(true);
  }
  // The form filled in by the voice is open: the microphone answers it ("oui", "non", a detail)
  if (formOpen() && st.phase === 'done') return answerNow();
  if (engines.listen === 'browser' && !agreed && !consent('asr')) return set({ phase: 'consent', what: 'asr' });
  set({ phase: 'listening' });
  warmVoice();
  try {
    rec = await record({ onLevel: showLevel });
  } catch (e) {
    rec = null;
    return set({ phase: 'done', note: t('voice.noMic') });
  }
  renderVoice();
  let samples;
  try {
    samples = await rec.done;
  } catch (e) {
    samples = new Float32Array(0);
  } finally {
    rec = null;
  }
  if (st.phase !== 'listening') return; // closed meanwhile
  if (samples.length < 16000 * 0.3) return set({ phase: 'done', note: t('voice.nothing') });
  set({ phase: 'hearing' });
  let text;
  try {
    text = await listen(samples, { lang: S.lang === 'en' ? 'en' : 'fr', hint: hint(), onProgress: progress });
  } catch (e) {
    return set({ phase: 'done', note: t('voice.failed', esc(e.message)) });
  }
  if (st.phase !== 'hearing') return;
  if (!text) return set({ phase: 'done', note: t('voice.nothing') });
  understand(text, { spoken: true });
}

function showLevel(v) {
  level = v;
  const bar = document.getElementById('voiceLevel');
  if (bar) bar.style.setProperty('--level', String(v));
}

function progress(p) {
  st.progress = p;
  const el = document.getElementById('voiceProgress');
  if (el) el.textContent = t('voice.download', Math.round(p * 100));
}

/**
 * The sentence heard (or corrected by hand): understood, then carried out. `spoken`: it came from the
 * microphone, so the answer is listened to once the form is filled in (typed: the user is at the keyboard).
 */
export async function understand(text, { model = !refused, spoken = false } = {}) {
  text = String(text || '').trim();
  if (!text) return;
  // Typed while the conversation listens: that listening is over
  if (rec && (st.phase === 'reply' || st.phase === 'next')) rec.stop();
  hush();
  if (model && parseCommand(text).action === 'unknown' && !consent('llm') && (await needsDownload())) {
    return set({ phase: 'consent', what: 'llm', text, spoken });
  }
  set({ phase: 'thinking', text, slow: engines && engines.understand === 'server' && parseCommand(text).action === 'unknown' });
  let res;
  try {
    res = await understandText(text, { model, onProgress: progress });
  } catch (e) {
    return set({ phase: 'done', text, note: t('voice.failed', esc(e.message)) });
  }
  if (st.phase !== 'thinking' || st.text !== text) return;
  const command = { ...res.command, person: await placesHeard(res.command.person) };
  if (command.union && command.union.place) command.union = { ...command.union, place: await placeHeard(command.union.place) };
  if (st.phase !== 'thinking' || st.text !== text) return;
  carryOut(command, text);
  replies = 0;
  if (spoken) converse();
}

/* ---------- The conversation: the answer, then the next command ---------- */

const talking = () => !!(S.voiceReply && engines && engines.listen);

/** After a command said: the form filled in is read back and confirmed; otherwise, the next command. */
function converse() {
  if (!talking()) return;
  if (st.phase === 'choose') {
    choices = 0;
    return listenChoice();
  }
  if (formOpen()) return askSave();
  if (st.phase === 'done') return listenNext();
}

/**
 * One short listening (the answer, or the next command), announced by a sound: the text said,
 * '' when nothing was said (silence, or a noise Whisper turned into words), or null when the
 * listening failed or the bubble moved on meanwhile.
 */
async function hearOnce(keep, phase) {
  if (rec) return null;
  set({ ...keep, phase });
  await chime();
  if (st.phase !== phase) return null;
  let r;
  try {
    r = await record({ onLevel: showLevel, wait: REPLY_WAIT, silence: 1000, max: 15000 });
    rec = r;
  } catch (e) {
    rec = null;
    if (st.phase === phase) set(keep);
    return null;
  }
  renderVoice();
  let samples;
  try {
    samples = await r.done;
  } catch (e) {
    samples = new Float32Array(0);
  } finally {
    rec = null;
  }
  if (st.phase !== phase) return null; // saved, cancelled or closed meanwhile
  // Nothing said: the silence is never sent to Whisper (which makes up sentences from it)
  if (!r.spoke() || samples.length < 16000 * 0.3) return '';
  set({ ...keep, phase: 'hearing' });
  try {
    const text = await listen(samples, { lang: S.lang === 'en' ? 'en' : 'fr', hint: hint(), onProgress: progress });
    if (st.phase !== 'hearing') return null;
    return text && !isNoise(text) ? text : '';
  } catch (e) {
    set({ ...keep, extra: t('voice.failed', esc(e.message)) });
    return null;
  }
}

/** What the form holds, as it will be saved: [label, value] lines (the recap of the bubble, and what is read aloud). */
function recap() {
  const e = S.edit;
  if (!e) return [];
  const d = e.draft;
  const name = (id) => (id && P(id) ? longName(P(id)) : '');
  const place = (date, where) => [date, where].filter(Boolean).join(t('voice.at'));
  return [
    [t('voice.r.name'), [d.given, d.surname].filter(Boolean).join(' ')],
    [t('voice.r.father'), name(d.fatherId)],
    [t('voice.r.mother'), name(d.motherId)],
    // The unions added, or completed by what was said
    [t('voice.r.spouse'), e.unions.filter((u) => !u.removed && (!u.uid || u.type || u.date || u.place) && name(u.other))
      .map((u) => [name(u.other), u.type ? t('ut.' + u.type).toLowerCase() : '', place(u.date, u.place)].filter(Boolean).join(', ')).join(' ; ')],
    [t('voice.r.born', d.sex), place(d.birthDate, d.birthPlace)],
    [t('voice.r.died', d.sex), place(d.deathDate, d.deathPlace)],
    [t('voice.r.occupation'), d.occupation],
  ].filter(([, v]) => v);
}

/** Reads back the form and listens for the answer (unless switched off): a few answers at most. */
async function askSave() {
  if (!talking() || rec || !formOpen() || replies >= MAX_REPLIES) return;
  replies++;
  const keep = { ...st, phase: 'done' };
  set({ ...keep, phase: 'speaking' });
  await speak(recap().map(([k, v]) => `${k} : ${v}`).join('. ') + '. ' + t('voice.askSave'), S.lang);
  if (st.phase !== 'speaking' || !formOpen()) return;
  await answerNow(keep);
}

/** Listens for the answer to the form open; nothing heard: the bubble says how to answer. */
async function answerNow(keep = { ...st, phase: 'done' }) {
  const text = await hearOnce(keep, 'reply');
  if (text === '') return set({ ...keep, extra: t('voice.noAnswer') });
  if (text != null) await reply(text, keep, true);
}

/** Listens for the next command: "c'est tout" (or silence) ends the conversation. */
async function listenNext() {
  if (!talking() || rec) return;
  const keep = { ...st, phase: 'done', next: true };
  const text = await hearOnce(keep, 'next');
  if (text === '') return set({ ...keep, extra: t('voice.idle') });
  if (text == null) return;
  if (isGoodbye(text)) return set({ phase: 'done', text: keep.text, answer: text, note: t('voice.bye') });
  understand(text, { spoken: true });
}

/** The answer heard (or given in a test): "oui" saves, "non" cancels, a detail completes the form. */
export async function reply(text, keep = { ...st, phase: 'done' }, spoken = false) {
  if (!formOpen()) return set({ ...keep, check: false });
  const r = parseReply(text);
  if (r.reply === 'yes') return saveVoice(text, spoken);
  if (r.reply === 'no') return cancelVoice(text, spoken);
  const said = await placesHeard(parseDetails(r.rest, { surname: S.edit.draft.surname }));
  if (!formOpen()) return;
  if (!Object.keys(said).length) {
    set({ ...keep, answer: text, extra: t('voice.replyUnknown') });
    return spoken ? askSave() : undefined;
  }
  act.refreshDraft(); // what was typed in the form meanwhile is kept
  Object.assign(S.edit.draft, said);
  renderSide(true);
  set({ ...keep, answer: text, extra: t('voice.completed') });
  return spoken ? askSave() : undefined;
}

/** Saves the form filled in by the voice (the answer "oui", or the bubble's button); then, the next command. */
export async function saveVoice(answer = '', spoken = false) {
  if (!formOpen()) return;
  if (rec) rec.stop();
  hush();
  const keep = { ...st, phase: 'done' };
  set({ ...keep, phase: 'saving' });
  await act.submitEdit();
  // Refused (a name missing…): the form says why, and stays open
  if (S.edit) return set({ ...keep, answer, extra: t('voice.saveFailed') });
  set({ phase: 'done', text: keep.text, answer, note: t('voice.saved') });
  if (spoken) {
    await speak(t('voice.savedNext'), S.lang);
    if (st.phase === 'done') listenNext();
  }
}

/** Closes the form filled in by the voice, without saving; then, the next command. */
export async function cancelVoice(answer = '', spoken = false) {
  if (!formOpen()) return;
  if (rec) rec.stop();
  hush();
  const text = st.text;
  act.cancelEdit();
  set({ phase: 'done', text, answer, note: t('voice.cancelled') });
  if (spoken) {
    await speak(t('voice.cancelledNext'), S.lang);
    if (st.phase === 'done') listenNext();
  }
}

/** The bubble's tick box: listen for the answer, or not. */
export function toggleVoiceReply(on) {
  S.voiceReply = !!on;
  savePrefs();
  if (!S.voiceReply) {
    hush();
    if ((st.phase === 'reply' || st.phase === 'next') && rec) rec.stop();
  }
  renderVoice();
}

/* ---------- Carrying out the command ---------- */

const words = (s) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);

/**
 * A place as said, as the tree writes it: "Confoland, 87" → "Confolens (16)", "Hautefort" →
 * "Hautefort (24)": the commune's department filled in, its name as INSEE writes it.
 */
async function placeHeard(text) {
  if (!text) return text;
  const pl = parseSpokenPlace(text);
  if (!pl.country) {
    await loadCommunes().catch(() => {});
    const c = findCommune(pl.city, pl.dept);
    if (c) Object.assign(pl, { city: c.city, dept: c.dept || pl.dept });
  }
  return formatPlace(pl);
}

/** The places of the fields said, as the tree writes them. */
async function placesHeard(person) {
  const out = { ...person };
  for (const f of ['birthPlace', 'deathPlace']) if (out[f]) out[f] = await placeHeard(out[f]);
  return out;
}

/** Something was said of the union: its kind, date or place. */
const hasUnion = (c) => !!(c.union && (c.union.type || c.union.date || c.union.place));

/** A union of the form (draftUnion), with what was said of it. */
function fillUnion(u, said) {
  if (!u || !said) return;
  for (const f of ['type', 'date', 'place']) if (said[f]) u[f] = said[f];
}

/** The tree's surnames (birth names included), the most frequent first: how the names heard are written. */
function knownSurnames() {
  const count = new Map();
  for (const p of S.people.values()) {
    // As written (surname() is in capitals, for display)
    for (const n of new Set([p.surname, p.maidenName].map((x) => String(x || '').trim()).filter(Boolean))) count.set(n, (count.get(n) || 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1]).map(([n]) => n);
}

/** Words said, each surname that sounds like one of the tree written like it ("cherche les Telié" → "Tellier"). */
function spellSurnames(text, known) {
  const byKey = new Map();
  for (const n of known) if (soundKey(n) && !byKey.has(soundKey(n))) byKey.set(soundKey(n), n);
  return text.split(' ').map((w) => byKey.get(soundKey(w)) || w).join(' ');
}

/** Edits between two words (Levenshtein), to forgive a name heard a little wrong. */
function distance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (x, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** People the name `who` may mean: the best ones first (several: the user chooses). */
export function peopleNamed(who) {
  const said = words(who);
  if (!said.length) return [];
  const { ids } = searchPeople(who, 6);
  const exact = ids.filter((id) => words(given(P(id)) + ' ' + surname(P(id))).join(' ') === said.join(' '));
  if (exact.length) return exact;
  if (ids.length) return ids;
  // Heard a little wrong: each word said close to a word of the name
  const close = [];
  for (const [id, p] of S.people) {
    const name = words([given(p), surname(p), p.maidenName].join(' '));
    let total = 0;
    const ok = said.every((w) => {
      // Sounding the same ("telie" for "tellier") counts as written the same
      const d = Math.min(...name.map((n) => (soundKey(n) && soundKey(n) === soundKey(w) ? 0 : distance(w, n))));
      total += d;
      return d <= Math.max(1, Math.floor(w.length / 4));
    });
    if (ok) close.push([id, total]);
  }
  return close.sort((a, b) => a[1] - b[1]).slice(0, 6).map(([id]) => id);
}

function carryOut(c, text) {
  // The names heard, written as in the tree: surname in its place, its spelling
  const known = knownSurnames();
  c = { ...c, person: { ...c.person, ...fixName(c.person, known) } };
  if (c.action === 'search') c = { ...c, who: spellSurnames(c.who, known) };
  if (c.action === 'unknown') return set({ phase: 'done', text, note: t('voice.unknown'), examples: true });
  if (c.action === 'search') {
    const input = $('#find');
    input.value = c.who;
    input.focus();
    onFindInput();
    return set({ phase: 'done', text, note: t('voice.searched', esc(c.who)) });
  }
  if (c.action === 'add' && !(c.who && c.relation)) return apply(c, null, text);
  const ids = peopleNamed(c.who);
  if (!ids.length) return set({ phase: 'done', text, note: t('voice.notFound', esc(c.who)) });
  if (ids.length > 1) return set({ phase: 'choose', text, command: c, ids });
  apply(c, ids[0], text);
}

/**
 * Person chosen among those with the name said (or, for a relative, among those already in the tree).
 * `spoken`: chosen by voice, the conversation goes on.
 */
export function pickVoice(id, spoken = false) {
  if (st.phase !== 'choose' || !S.people.has(id)) return;
  if (st.linkTo) link(st.command, st.linkTo, id, st.text);
  else apply(st.command, id, st.text);
  if (spoken) converse();
}

/** "Another person": the relative said is a new record, not the one found in the tree. */
export function newVoice(spoken = false) {
  if (!st.command || !st.linkTo || !S.people.has(st.linkTo)) return;
  if (st.linked && S.edit) act.cancelEdit();
  apply(st.command, st.linkTo, st.text, true);
  if (spoken) converse();
}

/** The person meant by `text` among `ids` ("le deuxième", "celui de 1995", "Marc"): an id, 'fresh', or null. */
function chosen(text, ids) {
  const c = parseChoice(text);
  if (!c) return null;
  if (c.fresh) return 'fresh';
  if ('index' in c) return ids.at(c.index) || null;
  const found = c.year ? ids.filter((id) => lifeYears(P(id)).includes(String(c.year)))
    : ids.filter((id) => {
      const name = words([given(P(id)), surname(P(id)), maiden(P(id))].join(' '));
      return words(c.words).every((w) => name.includes(w));
    });
  return found.length === 1 ? found[0] : null;
}

/** Listens for the choice among the people listed (`force`: the microphone was pressed, even without conversation). */
async function listenChoice(force = false) {
  if ((!force && !talking()) || rec || st.phase !== 'choose' || choices >= MAX_REPLIES) return;
  choices++;
  const keep = { ...st };
  const text = await hearOnce(keep, 'pick');
  if (text === '') return set({ ...keep, extra: t('voice.noChoice') });
  if (text != null) answerChoice(text, keep, force);
}

/** The choice heard (or given in a test): the person picked, a new person, or the question again. */
export function answerChoice(text, keep = { ...st }, force = false) {
  if (keep.phase !== 'choose') return;
  const id = chosen(text, keep.ids);
  if (!id && isGoodbye(text)) return set({ phase: 'done', text: keep.text, answer: text, note: t('voice.bye') });
  set({ ...keep, answer: text });
  if (id === 'fresh' && keep.linkTo) return newVoice(true);
  if (!id || id === 'fresh') {
    set({ ...keep, answer: text, extra: t('voice.whichAgain') });
    return listenChoice(force);
  }
  pickVoice(id, true);
}

/* ---------- A relative already in the tree ---------- */

/** People of the tree whose full name is the one said for the new relative of `of` (birth name included). */
function relativesNamed(c, of) {
  const o = P(of);
  if (!c.person.given) return [];
  // The family names the relative may have: the one said; else ("ajoute une fille à Véronique : Sophie")
  // those of the family, the person's and their spouses' (a child often has the father's)
  const family = [o.surname, o.maidenName, ...partnersOf(of).map((x) => P(x.id) && P(x.id).surname)];
  const lasts = (c.person.surname ? [c.person.surname] : c.relation === 'mother' || c.relation === 'spouse' ? [] : family)
    .map(soundKey).filter(Boolean);
  if (!lasts.length) return [];
  const firsts = words(c.person.given).map(soundKey);
  const sex = c.relation === 'father' ? 'M' : c.relation === 'mother' ? 'F' : c.person.sex;
  const other = { M: 'F', F: 'M' }[sex];
  return [...S.people].filter(([id, p]) => {
    if (id === of || (other && p.sex === other)) return false;
    const names = words(p.given).map(soundKey);
    // A record whose surname was glued to the first names ("Marc-Anatole-Octave-Tellier"): its last part
    const theirs = [p.surname, p.maidenName].map(soundKey).filter(Boolean);
    if (!theirs.length && names.length > 1) theirs.push(names.pop());
    // The first names said, the first one first ("Marc" for "Marc-François"), and a family name in common
    return firsts.length && names[0] === firsts[0] && firsts.every((f) => names.includes(f)) && theirs.some((n) => lasts.includes(n));
  }).map(([id]) => id);
}

const relText = (relation, sex) => t('voice.rel.' + relation, sex);

/**
 * Links `rid`, already in the tree, as the `c.relation` of `of`: the form of the record that holds
 * the link opens with it filled in (nothing saved before Save). Already linked: said so.
 */
function link(c, of, rid, text) {
  const o = P(of);
  const r = P(rid);
  const done = (note, extra = {}) => set({ phase: 'done', text, note, command: c, linkTo: of, ...extra });
  const label = (n, rel) => [esc(longName(n)), relText(c.relation, rel), esc(longName(o))];
  if (!S.canWrite) return done(t('voice.readOnly'));
  if (S.edit) {
    act.revealPanel();
    act.setTab('record');
    return done(t('voice.finishFirst'));
  }
  const already = () => done(t('voice.already', ...label(r, r.sex)));
  const said = Object.entries(c.person).some(([f, v]) => v && !['given', 'surname', 'sex'].includes(f));
  let target;
  let fill;
  if (c.relation === 'father' || c.relation === 'mother') {
    const field = c.relation === 'father' ? 'fatherId' : 'motherId';
    if (o[field] === rid) return already();
    target = of;
    fill = (d) => { d[field] = rid; };
  } else if (c.relation === 'child') {
    const field = o.sex === 'F' ? 'motherId' : o.sex === 'M' ? 'fatherId' : !r.fatherId ? 'fatherId' : 'motherId';
    if (r[field] === of) return already();
    target = rid;
    fill = (d) => { d[field] = of; };
  } else if (c.relation === 'sibling') {
    const shared = ['fatherId', 'motherId'].some((f) => o[f] && o[f] === r[f]);
    if (shared) return already();
    // A brother or a sister through the parents: those of the one who has them
    const [from, to] = o.fatherId || o.motherId ? [o, rid] : r.fatherId || r.motherId ? [r, of] : [];
    if (!to) return done(t('voice.noParents', esc(longName(o))));
    target = to;
    fill = (d) => {
      for (const f of ['fatherId', 'motherId']) if (from[f] && !d[f]) d[f] = from[f];
    };
  } else if (c.relation === 'spouse') {
    const told = hasUnion(c);
    // Already united: what is said of the union (married in 1990…) completes it; nothing new, said so
    if (unionBetween(of, rid) && !told) return already();
    act.editPerson(of);
    if (!S.edit) return done(t('voice.failed', ''));
    let u = S.edit.unions.find((x) => x.other === rid && !x.removed);
    if (!u) {
      act.addDraftUnion(rid);
      u = S.edit.unions.at(-1);
    }
    fillUnion(u, c.union);
    renderSide(true);
    const note = unionBetween(of, rid) ? t('voice.unionCompleted', esc(longName(r)), esc(longName(o))) : t('voice.linked', ...label(r, r.sex));
    return done(note + (said ? ' ' + t('voice.factsLeft', esc(longName(r))) : ''), { check: true, linked: true });
  } else {
    return done(t('voice.failed', ''));
  }
  act.editPerson(target);
  if (!S.edit) return done(t('voice.failed', ''));
  fill(S.edit.draft);
  // What was said about the relative goes on their record when it's the one open
  if (target === rid) {
    for (const f of ['birthDate', 'birthPlace', 'deathDate', 'deathPlace', 'occupation']) if (c.person[f]) S.edit.draft[f] = c.person[f];
  }
  renderSide(true);
  const left = said && target !== rid ? ' ' + t('voice.factsLeft', esc(longName(r))) : '';
  done(t('voice.linked', ...label(r, r.sex)) + left, { check: true, linked: true });
}

function apply(c, id, text, fresh = false) {
  if (c.action === 'add' && id && c.relation && !fresh) {
    const known = relativesNamed(c, id);
    if (known.length === 1) return link(c, id, known[0], text);
    if (known.length > 1) return set({ phase: 'choose', text, command: c, ids: known, linkTo: id });
  }
  if (c.action === 'open') {
    act.setFocus(id, true);
    return set({ phase: 'done', text, note: t('voice.opened', esc(longName(P(id)))) });
  }
  if (!S.canWrite) return set({ phase: 'done', text, note: t('voice.readOnly') });
  if (S.edit) {
    // The record being edited: shown, to finish it
    act.revealPanel();
    act.setTab('record');
    return set({ phase: 'done', text, note: t('voice.finishFirst') });
  }
  if (c.action === 'edit') act.editPerson(id);
  else if (id) act.startAdd(c.relation, id);
  else act.startNew();
  if (!S.edit) return set({ phase: 'done', text, note: t('voice.failed', '') });
  // A new spouse: the union said (married in 1990 at…), on the union the form opens with
  if (c.relation === 'spouse' && S.edit.unions[0]) fillUnion(S.edit.unions[0], c.union);
  // The form, filled in with what was said
  for (const f of FIELDS) {
    if (c.person[f] && (f !== 'sex' || c.action === 'add')) S.edit.draft[f] = c.person[f];
  }
  renderSide(true);
  const name = [c.person.given, c.person.surname].filter(Boolean).join(' ');
  const facts = [
    c.person.birthDate || c.person.birthPlace ? t('voice.born', c.person.sex, [c.person.birthDate, c.person.birthPlace].filter(Boolean).join(', ')) : '',
    c.person.deathDate || c.person.deathPlace ? t('voice.died', c.person.sex, [c.person.deathDate, c.person.deathPlace].filter(Boolean).join(', ')) : '',
    c.person.occupation,
  ].filter(Boolean).join(' · ');
  const note = c.action === 'edit' ? t('voice.edited', esc(longName(P(id))), esc(facts))
    : id ? t('voice.addedRel', esc(name), t('voice.rel.' + c.relation, c.person.sex), esc(longName(P(id))), esc(facts))
      : t('voice.added', esc(name), esc(facts));
  // A brother or a sister is linked through a parent: none known yet, the form asks for one
  const orphan = c.relation === 'sibling' && id && !S.edit.draft.fatherId && !S.edit.draft.motherId;
  set({ phase: 'done', text, note: note + (orphan ? ' ' + t('voice.noParents', esc(longName(P(id)))) : ''), check: true });
}

export function closeVoice() {
  if (rec) rec.stop();
  hush();
  set({ phase: 'idle' });
}

/* ---------- Drawing ---------- */

export function renderVoice() {
  const btn = $('#voiceBtn');
  const box = $('#voiceBubble');
  if (!btn || !box) return;
  const can = !!(engines && engines.listen);
  btn.hidden = !can;
  const field = btn.closest('.find');
  if (field) field.classList.toggle('has-mic', can);
  const hearing = ['listening', 'reply', 'next', 'pick'].includes(st.phase);
  btn.setAttribute('aria-pressed', String(hearing));
  btn.title = t(hearing ? 'voice.stop' : 'voice.start');
  btn.setAttribute('aria-label', btn.title);
  box.hidden = st.phase === 'idle';
  if (box.hidden) return setHTML(box, '');
  const close = `<button class="icon-btn" type="button" data-act="voice-close" aria-label="${t('close')}">×</button>`;
  const heard = st.text
    ? `<label class="sr" for="voiceText">${t('voice.heard')}</label><div class="vb-heard"><input id="voiceText" type="text" value="${esc(st.text)}" spellcheck="false">`
      + `<button class="btn small" type="button" data-act="voice-understand">${t('voice.understand')}</button></div>`
    : '';
  const dl = `<p class="hint" id="voiceProgress">${st.progress != null ? t('voice.download', Math.round(st.progress * 100)) : ''}</p>`;
  // The form filled in: what was understood, the answer heard, and Save / Cancel at hand
  const form = formOpen();
  const answer = st.answer ? `<p class="hint">« ${esc(st.answer)} »</p>` : '';
  // The form filled in: what will be saved, line by line
  const lines = form ? recap() : [];
  const sum = lines.length ? `<dl class="vb-recap">${lines.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : '';
  const result = `<p class="vb-note">${st.note || ''}</p>${sum}${answer}${st.extra ? `<p class="vb-note">${st.extra}</p>` : ''}`;
  const live = (label, hintText) => `<div class="vb-row"><span class="vb-dot" aria-hidden="true"></span><b>${label}</b>`
    + `<span class="vb-level" id="voiceLevel" data-style="--level:${level}" aria-hidden="true"></span>${close}</div>`
    + (hintText ? `<p class="hint">${hintText}</p>` : '');
  const formButtons = form ? `<button class="btn small" type="button" data-act="voice-cancel">${t('cancel')}</button>`
    + `<button class="btn small primary" type="button" id="voiceSave" data-act="voice-save">${t('save')}</button>` : '';
  const pref = form && engines && engines.listen ? `<label class="vb-pref hint"><input type="checkbox" data-act="voice-reply-pref"${S.voiceReply ? ' checked' : ''}> ${t('voice.replyPref')}</label>` : '';
  let body = '';
  if (st.phase === 'speaking') {
    body = `${heard}${result}<div class="vb-row"><b>${t('voice.askSave')}</b>${close}</div><div class="vb-row end">${formButtons}</div>${pref}`;
  } else if (st.phase === 'reply') {
    body = `${heard}${result}${live(t('voice.askSave'), t('voice.replyHint'))}<div class="vb-row end">${formButtons}</div>${pref}`;
  } else if (st.phase === 'next') {
    body = `${heard}${result}${live(t('voice.nextListening'), t('voice.nextHint'))}`;
  } else if (st.phase === 'saving') {
    body = `${heard}<div class="vb-row"><b>${t('f.saving')}</b>${close}</div>`;
  } else if (st.phase === 'listening') {
    body = `<div class="vb-row"><span class="vb-dot" aria-hidden="true"></span><b>${t('voice.listening')}</b>`
      + `<span class="vb-level" id="voiceLevel" data-style="--level:${level}" aria-hidden="true"></span>`
      + `<button class="btn small" type="button" data-act="voice">${t('voice.end')}</button>${close}</div><p class="hint">${t('voice.listenHint')}</p>`;
  } else if (st.phase === 'hearing') {
    body = `<div class="vb-row"><b>${t('voice.hearing')}</b>${close}</div>${dl}`;
  } else if (st.phase === 'thinking') {
    body = `${heard}<div class="vb-row"><b>${t('voice.thinking')}</b>${close}</div>${st.slow ? `<p class="hint">${t('voice.slow')}</p>` : ''}${dl}`;
  } else if (st.phase === 'consent') {
    const yes = st.what === 'asr' ? t('voice.consentAsrYes') : t('voice.consentLlmYes');
    const no = st.what === 'asr' ? t('cancel') : t('voice.consentLlmNo');
    body = `${heard}<p>${t(st.what === 'asr' ? 'voice.consentAsr' : 'voice.consentLlm')}</p>`
      + `<div class="vb-row end"><button class="btn" type="button" data-act="voice-consent" data-what="${st.what}" data-yes="0">${no}</button>`
      + `<button class="btn primary" type="button" data-act="voice-consent" data-what="${st.what}" data-yes="1">${yes}</button></div>`;
  } else if (st.phase === 'choose' || st.phase === 'pick') {
    const name = st.linkTo ? [st.command.person.given, st.command.person.surname].filter(Boolean).join(' ') : st.command.who;
    body = `${heard}<p>${t(st.linkTo ? 'voice.whichRelative' : 'voice.which', esc(name))}</p><ol class="vb-choices">${st.ids.map((id) => `<li><button class="link" type="button" data-act="voice-pick" data-id="${esc(id)}">${esc(longName(P(id)))} <span class="hint">${esc(lifeYears(P(id)))}</span></button></li>`).join('')}</ol>`
      + `${answer}${st.extra ? `<p class="vb-note">${st.extra}</p>` : ''}`
      + (st.phase === 'pick' ? live(t('voice.listening'), t(st.linkTo ? 'voice.pickHintNew' : 'voice.pickHint')) : '')
      + `<div class="vb-row end">${st.linkTo ? `<button class="btn small" type="button" data-act="voice-new">${t('voice.newOne')}</button>` : ''}${st.phase === 'pick' ? '' : close}</div>`;
  } else {
    body = `${heard}${result}`
      + (form ? `<p class="hint">${t('voice.check')}</p>` : '')
      + (st.examples ? `<p class="hint">${t('voice.examples')}</p>` : '')
      + `<div class="vb-row end">${st.linked ? `<button class="btn small" type="button" data-act="voice-new">${t('voice.other')}</button>` : ''}`
      + `<button class="btn small" type="button" data-act="voice-retry">${t('voice.again')}</button>${formButtons}${close}</div>${pref}`;
  }
  setHTML(box, body);
  // Enter saves: the button has the focus, unless the user is typing somewhere
  const save = document.getElementById('voiceSave');
  const el = document.activeElement;
  const typing = el && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && el.type !== 'checkbox'));
  if (save && !typing) save.focus();
}
