/**
 * Voice commands: recording the microphone, turning the sentence into text (Whisper), then into a
 * command (a language model, or the fixed sentences of model/voice.js).
 *
 * Where it runs, chosen once:
 * - with the local server (server.js) and Whisper / Ollama installed there: on this computer;
 * - without a server (GitHub Pages): in the browser, with Whisper (Transformers.js) and Qwen
 *   (WebLLM, needs WebGPU), downloaded once from a CDN and Hugging Face, then kept by the browser.
 *   The local server's security policy forbids these scripts: with it, only its own engines.
 * Fixed sentences ("ouvre la fiche de …") are understood at once, without a language model.
 */
import { parseCommand, commandFromText, PROMPT, SCHEMA } from '../model/voice.js';

/* ---------- What runs where ---------- */

let adapter = null; // Promise of the graphics card (WebGPU), or null

/** The graphics card the browser can compute with, or null (WebGPU announced is not enough). */
function gpu() {
  if (!adapter) {
    adapter = typeof navigator !== 'undefined' && navigator.gpu
      ? navigator.gpu.requestAdapter().catch(() => null)
      : Promise.resolve(null);
  }
  return adapter;
}

let engines = null; // Promise<{ listen: 'server'|'browser'|'', understand: 'server'|'browser'|'' , server }>

/** Asks once: { listen, understand } ('' when there is none: only fixed sentences). */
export function voiceEngines() {
  engines = engines || fetch('api/voice', { cache: 'no-store' })
    .then((r) => (r.ok && /json/.test(r.headers.get('content-type') || '') ? r.json() : null))
    .catch(() => null)
    .then(async (o) => {
      if (o) return { server: true, listen: o.listen ? 'server' : '', understand: o.understand ? 'server' : '' };
      const media = typeof navigator !== 'undefined' && navigator.mediaDevices && typeof MediaRecorder !== 'undefined';
      return { server: false, listen: media ? 'browser' : '', understand: (await gpu()) ? 'browser' : '' };
    });
  return engines;
}

/** For the tests. */
export function resetVoiceEngines() {
  engines = null;
  adapter = null;
  asr = null;
  llm = null;
}

/** Loads the server's models while the user speaks. */
export async function warmVoice() {
  const e = await voiceEngines();
  if (e.server) fetch('api/voice/warm', { method: 'POST' }).catch(() => {});
}

/* ---------- Recording ---------- */

const RATE = 16000; // what Whisper hears

/**
 * Is someone speaking? A gate fed with the loudness of each tenth of a second: true while a voice is
 * heard. The threshold follows the room's background noise: a quiet "oui" in a calm room is heard
 * (0.006), never stricter than 0.02; two loud tenths in a row, so that a click isn't a voice.
 */
export function voiceGate() {
  let floor = null;
  let loud = 0;
  let speaking = false;
  return (rms) => {
    floor = floor === null ? rms : Math.min(rms, floor * 1.02 + 1e-5); // the lowest, rising slowly
    const threshold = Math.min(0.02, Math.max(0.006, floor * 4));
    if (rms > threshold) loud++;
    else {
      loud = 0;
      speaking = false;
    }
    if (loud >= 2) speaking = true;
    return speaking;
  };
}

/**
 * Starts recording the microphone. Returns { stop(), done, spoke() }: `done` resolves to the samples
 * (Float32Array, mono, 16 kHz) when `stop()` is called, after `silence` ms of silence once
 * the user has spoken, after `max` ms, or after `wait` ms if nobody spoke (`spoke()` then false).
 * `onLevel(0..1)` follows the voice's loudness.
 */
export async function record({ onLevel = () => {}, silence = 1500, max = 30000, wait = 0 } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const ctx = new AudioContext();
  // Started after awaiting the microphone: the browser may hold it paused
  await ctx.resume().catch(() => {});
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const rec = new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const ended = new Promise((resolve) => { rec.onstop = resolve; });
  rec.start();

  // Silence after speaking: the sentence is over
  const buf = new Float32Array(analyser.fftSize);
  const start = Date.now();
  const gate = voiceGate();
  let spoke = false;
  let quietSince = 0;
  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
    onLevel(Math.min(1, rms * 8));
    const now = Date.now();
    if (gate(rms)) {
      spoke = true;
      quietSince = 0;
    } else if (spoke) {
      quietSince = quietSince || now;
      if (now - quietSince > silence) stop();
    }
    if (now - start > max) stop();
    // Nobody speaks (an answer waited for): over, without sending silence to Whisper
    if (wait && !spoke && now - start > wait) stop();
  }, 100);

  let stopped = false;
  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    if (rec.state !== 'inactive') rec.stop();
  }

  const done = ended.then(async () => {
    for (const track of stream.getTracks()) track.stop();
    const blob = new Blob(chunks, { type: rec.mimeType });
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    ctx.close();
    return resample(decoded);
  });
  return { stop, done, spoke: () => spoke };
}

/** The recording, mono, at 16 kHz. */
async function resample(decoded) {
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * RATE)), RATE);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  return (await off.startRendering()).getChannelData(0);
}

/** Samples as a WAV file (PCM 16 bits, mono, 16 kHz), for the server. */
export function toWav(samples) {
  const out = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (at, s) => [...s].forEach((c, i) => out.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  out.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);     // PCM
  out.setUint16(22, 1, true);     // mono
  out.setUint32(24, RATE, true);
  out.setUint32(28, RATE * 2, true);
  out.setUint16(32, 2, true);
  out.setUint16(34, 16, true);
  text(36, 'data');
  out.setUint32(40, samples.length * 2, true);
  samples.forEach((v, i) => out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true));
  return new Blob([out.buffer], { type: 'audio/wav' });
}

/* ---------- Text of the sentence ---------- */

// In the browser: Transformers.js, exact version (the CDN serves it with its own dependencies resolved)
const TRANSFORMERS = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/+esm';
let asr = null; // Promise of the pipeline

async function browserAsr(onProgress) {
  if (!asr) {
    asr = (async () => {
      const { pipeline } = await import(TRANSFORMERS);
      const progress_callback = (p) => { if (p.status === 'progress' && p.total) onProgress(p.loaded / p.total); };
      // Small model on the graphics card; on the processor, a lighter one
      if (await gpu()) {
        return pipeline('automatic-speech-recognition', 'onnx-community/whisper-small', {
          device: 'webgpu', dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' }, progress_callback,
        });
      }
      return pipeline('automatic-speech-recognition', 'onnx-community/whisper-base', { device: 'wasm', dtype: 'q8', progress_callback });
    })();
    asr.catch(() => { asr = null; });
  }
  return asr;
}

/** Text said in `samples`. `hint`: names to expect (on the server only). */
export async function listen(samples, { lang = 'fr', hint = '', onProgress = () => {} } = {}) {
  const e = await voiceEngines();
  if (e.listen === 'server') {
    const q = new URLSearchParams({ lang, hint: hint.slice(0, 600) });
    const r = await fetch('api/voice/listen?' + q, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: toWav(samples) });
    if (!r.ok) throw new Error((await r.text().catch(() => '')) || 'whisper');
    return (await r.json()).text || '';
  }
  if (e.listen !== 'browser') throw new Error('no-listen');
  const pipe = await browserAsr(onProgress);
  const out = await pipe(samples, { language: lang === 'en' ? 'english' : 'french', task: 'transcribe' });
  return String((out && out.text) || '').trim();
}

/* ---------- Command ---------- */

// In the browser: WebLLM (exact version) and a small Qwen
const WEBLLM = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.86/lib/index.js';
const BROWSER_LLM = 'Qwen2.5-3B-Instruct';
let llm = null; // Promise of the engine

async function browserLlm(onProgress) {
  if (!llm) {
    llm = (async () => {
      const webllm = await import(WEBLLM);
      const card = await gpu();
      const f16 = card && card.features.has('shader-f16');
      return webllm.CreateMLCEngine(`${BROWSER_LLM}-${f16 ? 'q4f16_1' : 'q4f32_1'}-MLC`, {
        initProgressCallback: (p) => onProgress(p.progress || 0),
      });
    })();
    llm.catch(() => { llm = null; });
  }
  return llm;
}

/** True when the browser's language model has to be downloaded first (asked to the user). */
export async function needsDownload() {
  const e = await voiceEngines();
  return e.understand === 'browser' && !llm;
}

/**
 * The command said in `text`: a fixed sentence at once, otherwise the language model when there is
 * one (`model: false` to do without). Returns { command, by: 'rules'|'server'|'browser' }.
 */
export async function understandText(text, { model = true, onProgress = () => {} } = {}) {
  const fixed = parseCommand(text);
  const e = await voiceEngines();
  if (fixed.action !== 'unknown' || !model || !e.understand) return { command: fixed, by: 'rules' };
  if (e.understand === 'server') {
    const r = await fetch('api/voice/understand', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    if (!r.ok) throw new Error((await r.text().catch(() => '')) || 'ollama');
    return { command: (await r.json()).command, by: 'server' };
  }
  const engine = await browserLlm(onProgress);
  const res = await engine.chat.completions.create({
    messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: text }],
    temperature: 0,
    response_format: { type: 'json_object', schema: JSON.stringify(SCHEMA) },
  });
  return { command: commandFromText(res.choices[0].message.content) || parseCommand(''), by: 'browser' };
}

/**
 * Says `text` aloud with a voice installed on this device: never an online voice (Chrome's
 * "Google" voices send the text to Google), so names and dates stay here. No such voice: silent,
 * the bubble shows it all. Resolves once said, at once without a voice, and after 15 s at most:
 * the listening that follows must not hear Lignée itself.
 */
export function speak(text, lang = 'fr') {
  const synth = globalThis.speechSynthesis;
  if (!synth || typeof globalThis.SpeechSynthesisUtterance !== 'function' || !text) return Promise.resolve();
  // The voices not known yet (loaded late by some browsers, see loadVoices): silent rather than a default voice, maybe online
  const voice = localVoice(synth.getVoices(), lang);
  if (!voice) return Promise.resolve();
  return new Promise((resolve) => {
    const u = new globalThis.SpeechSynthesisUtterance(text);
    u.lang = lang === 'en' ? 'en-GB' : 'fr-FR';
    u.voice = voice;
    const timer = setTimeout(done, 15000);
    function done() {
      clearTimeout(timer);
      resolve();
    }
    u.onend = done;
    u.onerror = done;
    synth.cancel();
    synth.speak(u);
  });
}

/**
 * The voice to speak `lang` with: installed on the device only; the language's own country first
 * (fr-FR, en-GB), and the plain voice before its variants ("French (France)+Adam espeak-ng").
 */
export function localVoice(voices, lang) {
  const own = lang === 'en' ? 'en-gb' : 'fr-fr';
  const rank = (v) => (v.lang.toLowerCase().replace('_', '-') === own ? 0 : 2) + (/\+/.test(v.name) ? 1 : 0);
  return voices.filter((v) => v.localService && v.lang && v.lang.toLowerCase().startsWith(lang))
    .sort((a, b) => rank(a) - rank(b))[0] || null;
}

/** Asks the browser for its voices early: Chrome lists them only after a first call. */
export function loadVoices() {
  if (globalThis.speechSynthesis) globalThis.speechSynthesis.getVoices();
}

/** Stops what is being said. */
export function hush() {
  if (globalThis.speechSynthesis) globalThis.speechSynthesis.cancel();
}

let chimeCtx = null;

/**
 * A short sound, made here (nothing is downloaded): 'listen' (two rising notes) when Lignée listens
 * without a click, so that the user knows it waits for an answer. Resolves once played.
 */
export function chime() {
  const AC = globalThis.AudioContext;
  if (!AC) return Promise.resolve();
  try {
    chimeCtx = chimeCtx || new AC();
    if (chimeCtx.state === 'suspended') chimeCtx.resume().catch(() => {});
    const now = chimeCtx.currentTime;
    [[660, 0], [880, 0.12]].forEach(([freq, at]) => {
      const osc = chimeCtx.createOscillator();
      const gain = chimeCtx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.15, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.11);
      osc.connect(gain).connect(chimeCtx.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.12);
    });
  } catch (e) {
    return Promise.resolve();
  }
  // The microphone opens after the sound: it must not hear it
  return new Promise((resolve) => setTimeout(resolve, 300));
}
