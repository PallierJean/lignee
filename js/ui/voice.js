/**
 * Voice commands, seen by the user: the microphone at the end of the search field, and the bubble
 * under it that shows what was heard ("« … »"), then what was understood and done.
 *
 * Searching and opening a record are done at once. Adding or changing a person opens the usual
 * form, filled in with what was said: nothing is saved until the user clicks Save (and Ctrl+Z
 * undoes it as any change). Several people with the name said: the bubble asks which one.
 * A relative said who is already in the tree is linked to the record, instead of a new record.
 */
import { S } from '../state.js';
import { $, esc, setHTML } from '../utils/dom.js';
import { norm } from '../utils/helpers.js';
import { t } from '../i18n.js';
import { P, longName, lifeYears, given, surname, maiden, unionBetween } from '../model/people.js';
import { FIELDS, parseCommand } from '../model/voice.js';
import { voiceEngines, warmVoice, record, listen, understandText, needsDownload } from '../services/voice.js';
import { searchPeople, onFindInput } from './search.js';
import { renderSide } from './render.js';

const CONSENT_KEY = 'lignee.voice';

let act = null;     // the application's actions (from events.js)
let engines = null; // { listen, understand, server }
let rec = null;     // recording in progress: { stop, done }
let st = { phase: 'idle' };
let level = 0;
let refused = false; // browser language model declined, this time

/** Shows the microphone if this device can listen. `actions`: setFocus, startNew, startAdd, editPerson. */
export function initVoice(actions) {
  act = actions;
  return voiceEngines().then((e) => {
    engines = e;
    renderVoice();
  });
}

export const voiceOpen = () => st.phase !== 'idle';

function set(next) {
  st = next;
  renderVoice();
}

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
  return understand(st.text, yes);
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
  understand(text);
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

/** The sentence heard (or corrected by hand): understood, then carried out. */
export async function understand(text, model = !refused) {
  text = String(text || '').trim();
  if (!text) return;
  if (model && parseCommand(text).action === 'unknown' && !consent('llm') && (await needsDownload())) {
    return set({ phase: 'consent', what: 'llm', text });
  }
  set({ phase: 'thinking', text, slow: engines && engines.understand === 'server' && parseCommand(text).action === 'unknown' });
  let res;
  try {
    res = await understandText(text, { model, onProgress: progress });
  } catch (e) {
    return set({ phase: 'done', text, note: t('voice.failed', esc(e.message)) });
  }
  if (st.phase !== 'thinking' || st.text !== text) return;
  carryOut(res.command, text);
}

/* ---------- Carrying out the command ---------- */

const words = (s) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);

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
      const d = Math.min(...name.map((n) => distance(w, n)));
      total += d;
      return d <= Math.max(1, Math.floor(w.length / 4));
    });
    if (ok) close.push([id, total]);
  }
  return close.sort((a, b) => a[1] - b[1]).slice(0, 6).map(([id]) => id);
}

function carryOut(c, text) {
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

/** Person chosen among those with the name said (or, for a relative, among those already in the tree). */
export function pickVoice(id) {
  if (st.phase !== 'choose' || !S.people.has(id)) return;
  if (st.linkTo) return link(st.command, st.linkTo, id, st.text);
  apply(st.command, id, st.text);
}

/** "Another person": the relative said is a new record, not the one found in the tree. */
export function newVoice() {
  if (!st.command || !st.linkTo || !S.people.has(st.linkTo)) return;
  if (st.linked && S.edit) act.cancelEdit();
  apply(st.command, st.linkTo, st.text, true);
}

/* ---------- A relative already in the tree ---------- */

/** People of the tree whose full name is the one said for the new relative of `of` (birth name included). */
function relativesNamed(c, of) {
  const o = P(of);
  // "ajoute un fils à Jean Lacoste : Paul": the family name goes without saying
  const last = c.person.surname || (['child', 'sibling', 'father'].includes(c.relation) ? surname(o) : '');
  const said = words(c.person.given + ' ' + last).join(' ');
  if (!c.person.given || !last) return [];
  const sex = c.relation === 'father' ? 'M' : c.relation === 'mother' ? 'F' : c.person.sex;
  const other = { M: 'F', F: 'M' }[sex];
  return [...S.people].filter(([id, p]) => id !== of && (!other || p.sex !== other)
    && [surname(p), maiden(p)].some((n) => n && words(given(p) + ' ' + n).join(' ') === said)).map(([id]) => id);
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
    if (unionBetween(of, rid)) return already();
    act.editPerson(of);
    if (!S.edit) return done(t('voice.failed', ''));
    act.addDraftUnion(rid);
    return done(t('voice.linked', ...label(r, r.sex)) + (said ? ' ' + t('voice.factsLeft', esc(longName(r))) : ''), { check: true, linked: true });
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
  btn.setAttribute('aria-pressed', String(st.phase === 'listening'));
  btn.title = t(st.phase === 'listening' ? 'voice.stop' : 'voice.start');
  btn.setAttribute('aria-label', btn.title);
  box.hidden = st.phase === 'idle';
  if (box.hidden) return setHTML(box, '');
  const close = `<button class="icon-btn" type="button" data-act="voice-close" aria-label="${t('close')}">×</button>`;
  const heard = st.text
    ? `<label class="sr" for="voiceText">${t('voice.heard')}</label><div class="vb-heard"><input id="voiceText" type="text" value="${esc(st.text)}" spellcheck="false">`
      + `<button class="btn small" type="button" data-act="voice-understand">${t('voice.understand')}</button></div>`
    : '';
  const dl = `<p class="hint" id="voiceProgress">${st.progress != null ? t('voice.download', Math.round(st.progress * 100)) : ''}</p>`;
  let body = '';
  if (st.phase === 'listening') {
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
  } else if (st.phase === 'choose') {
    const name = st.linkTo ? [st.command.person.given, st.command.person.surname].filter(Boolean).join(' ') : st.command.who;
    body = `${heard}<p>${t(st.linkTo ? 'voice.whichRelative' : 'voice.which', esc(name))}</p><ul class="vb-choices">${st.ids.map((id) => `<li><button class="link" type="button" data-act="voice-pick" data-id="${esc(id)}">${esc(longName(P(id)))} <span class="hint">${esc(lifeYears(P(id)))}</span></button></li>`).join('')}</ul>`
      + `<div class="vb-row end">${st.linkTo ? `<button class="btn small" type="button" data-act="voice-new">${t('voice.newOne')}</button>` : ''}${close}</div>`;
  } else {
    body = `${heard}<p class="vb-note">${st.note || ''}</p>`
      + (st.check ? `<p class="hint">${t('voice.check')}</p>` : '')
      + (st.examples ? `<p class="hint">${t('voice.examples')}</p>` : '')
      + `<div class="vb-row end">${st.linked ? `<button class="btn small" type="button" data-act="voice-new">${t('voice.other')}</button>` : ''}`
      + `<button class="btn small" type="button" data-act="voice-retry">${t('voice.again')}</button>${close}</div>`;
  }
  setHTML(box, body);
}
