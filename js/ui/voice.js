/**
 * Voice commands, seen by the user: the microphone at the end of the search field, and the bubble
 * under it that shows what was heard ("« … »"), then what was understood and done.
 *
 * Searching and opening a record are done at once. Adding or changing a person opens the usual
 * form, filled in with what was said: nothing is saved until the user clicks Save (and Ctrl+Z
 * undoes it as any change). Several people with the name said: the bubble asks which one.
 */
import { S } from '../state.js';
import { $, esc, setHTML } from '../utils/dom.js';
import { norm } from '../utils/helpers.js';
import { t } from '../i18n.js';
import { P, longName, lifeYears, given, surname } from '../model/people.js';
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

/** Person chosen among those with the name said. */
export function pickVoice(id) {
  if (st.phase !== 'choose' || !S.people.has(id)) return;
  apply(st.command, id, st.text);
}

function apply(c, id, text) {
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
  set({ phase: 'done', text, note, check: true });
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
    body = `${heard}<p>${t('voice.which', esc(st.command.who))}</p><ul class="vb-choices">${st.ids.map((id) => `<li><button class="link" type="button" data-act="voice-pick" data-id="${esc(id)}">${esc(longName(P(id)))} <span class="hint">${esc(lifeYears(P(id)))}</span></button></li>`).join('')}</ul>`
      + `<div class="vb-row end">${close}</div>`;
  } else {
    body = `${heard}<p class="vb-note">${st.note || ''}</p>`
      + (st.check ? `<p class="hint">${t('voice.check')}</p>` : '')
      + (st.examples ? `<p class="hint">${t('voice.examples')}</p>` : '')
      + `<div class="vb-row end"><button class="btn small" type="button" data-act="voice-retry">${t('voice.again')}</button>${close}</div>`;
  }
  setHTML(box, body);
}
