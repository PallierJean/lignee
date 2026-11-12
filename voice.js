/**
 * Voice commands on this computer, for server.js: listening (Whisper) and understanding (Ollama).
 *
 * - Whisper (faster-whisper, free software) turns the recording into text. It runs in a Python
 *   program (scripts/whisper-worker.py) started at the first sentence, which keeps the model loaded
 *   and stops after a quarter of an hour without use.
 * - Ollama (free software) runs a language model, Qwen by default, which turns the sentence into a
 *   command (js/model/voice.js).
 * Everything runs here, nothing leaves the computer. Both are installed apart (docs/features/voice.md);
 * without them, the page falls back on its own means.
 *
 * - LIGNEE_WHISPER: Python of faster-whisper's environment (default ~/lignee-voice/bin/python);
 * - LIGNEE_WHISPER_MODEL: Whisper model (default: small);
 * - LIGNEE_OLLAMA: Ollama's address (default http://127.0.0.1:11434);
 * - LIGNEE_LLM_MODEL: Ollama model (default: qwen2.5:7b).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROMPT, SCHEMA, commandFromText } from './js/model/voice.js';

const HOME = os.homedir();
const PYTHON = process.env.LIGNEE_WHISPER || path.join(HOME, 'lignee-voice', 'bin', 'python');
const WHISPER_MODEL = process.env.LIGNEE_WHISPER_MODEL || 'small';
const OLLAMA = (process.env.LIGNEE_OLLAMA || 'http://127.0.0.1:11434').replace(/\/$/, '');
const LLM_MODEL = process.env.LIGNEE_LLM_MODEL || 'qwen2.5:7b';
const WORKER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'scripts', 'whisper-worker.py');
const IDLE = 15 * 60 * 1000;     // the model leaves memory after a quarter of an hour without use
const LOADING = 5 * 60 * 1000;   // first use: the model may be downloaded (~500 MB)
const SENTENCE = 2 * 60 * 1000;  // a sentence takes a few seconds; beyond two minutes, it's stuck

const unavailable = (what) => Object.assign(new Error(what + ' indisponible sur cet ordinateur'), { status: 503 });

/* ---------- Whisper ---------- */

let canListen = null; // Promise<boolean>, asked once

/** Is faster-whisper installed? (its Python, and the module) */
function whisperReady() {
  if (!canListen) {
    canListen = new Promise((resolve) => {
      const child = spawn(PYTHON, ['-c', 'import faster_whisper'], { stdio: 'ignore' });
      child.on('error', () => resolve(false));
      child.on('close', (code) => resolve(code === 0));
    });
  }
  return canListen;
}

let worker = null; // { child, lines: [resolve], ready: Promise, timer }

function startWorker() {
  const child = spawn(PYTHON, [WORKER, WHISPER_MODEL], { stdio: ['pipe', 'pipe', 'pipe'] });
  const w = { child, waiting: [], timer: null, err: '' };
  let buf = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      const next = w.waiting.shift();
      if (next) next.resolve(line);
    }
  });
  child.stderr.on('data', (d) => { w.err = (w.err + d).slice(-2000); });
  const stop = () => {
    if (worker === w) worker = null;
    const msg = 'whisper : ' + (w.err.trim().split('\n').pop() || 'arrêté');
    for (const x of w.waiting.splice(0)) x.reject(new Error(msg));
  };
  child.on('error', stop);
  child.on('close', stop);
  w.ready = nextLine(w, LOADING);
  return w;
}

/** The worker's next line, as JSON; kills it if it takes longer than `ms`. */
function nextLine(w, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => w.child.kill('SIGKILL'), ms);
    w.waiting.push({
      resolve: (line) => { clearTimeout(timer); resolve(JSON.parse(line)); },
      reject: (e) => { clearTimeout(timer); reject(e); },
    });
  });
}

let queue = Promise.resolve(); // one sentence at a time

/** Text said in the recording `wav` (a WAV file's bytes). `hint`: names to expect. */
export function transcribe(wav, { lang = 'fr', hint = '' } = {}) {
  const job = queue.then(async () => {
    if (!(await whisperReady())) throw unavailable('Whisper');
    if (!worker) worker = startWorker();
    const w = worker;
    clearTimeout(w.timer);
    await w.ready;
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lignee-voice-'));
    try {
      const file = path.join(dir, 'phrase.wav');
      await fs.writeFile(file, wav);
      const answer = nextLine(w, SENTENCE);
      w.child.stdin.write(JSON.stringify({ wav: file, lang, hint: String(hint).slice(0, 600) }) + '\n');
      const res = await answer;
      if (res.error) throw new Error('whisper : ' + res.error);
      return { text: String(res.text || '').trim() };
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
      w.timer = setTimeout(() => w.child.kill(), IDLE);
      w.timer.unref();
    }
  });
  queue = job.catch(() => {});
  return job;
}

/** Stops Whisper's program now (it would stop by itself after a quarter of an hour). */
export function stopVoice() {
  if (worker) worker.child.kill();
  worker = null;
}

/* ---------- Ollama ---------- */

/** Does Ollama answer, with the model? */
async function ollamaReady() {
  try {
    const res = await fetch(OLLAMA + '/api/tags', { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return false;
    const { models = [] } = await res.json();
    const want = LLM_MODEL.includes(':') ? LLM_MODEL : LLM_MODEL + ':latest';
    return models.some((m) => m.name === want || m.model === want);
  } catch (e) {
    return false;
  }
}

/** The command said in `text` (see js/model/voice.js). */
export async function understand(text) {
  if (!(await ollamaReady())) throw unavailable('Ollama');
  const res = await fetch(OLLAMA + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(SENTENCE),
    body: JSON.stringify({
      model: LLM_MODEL,
      stream: false,
      format: SCHEMA,
      keep_alive: '30m',
      options: { temperature: 0 },
      messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: String(text).slice(0, 1000) }],
    }),
  });
  if (!res.ok) throw new Error('ollama : ' + ((await res.text()).slice(0, 300) || res.status));
  const { message } = await res.json();
  return { command: commandFromText(message && message.content) || commandFromText('{}') };
}

/** Loads Whisper and the language model in memory, so that the sentence being said is quick. */
export async function warmUp() {
  if ((await whisperReady()) && !worker) worker = startWorker();
  if (await ollamaReady()) {
    // The instructions read once: the next sentence only adds its own words
    await fetch(OLLAMA + '/api/chat', {
      method: 'POST',
      signal: AbortSignal.timeout(LOADING),
      body: JSON.stringify({
        model: LLM_MODEL, stream: false, keep_alive: '30m', options: { temperature: 0, num_predict: 1 },
        messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: '.' }],
      }),
    });
  }
}

/** What this computer can do: { listen, understand, whisper, llm } (model names). */
export async function voiceStatus() {
  const [listen, llm] = await Promise.all([whisperReady(), ollamaReady()]);
  return { listen, understand: llm, whisper: listen ? WHISPER_MODEL : '', llm: llm ? LLM_MODEL : '' };
}
