/**
 * Reading a handwritten document on this computer (HTR), for server.js.
 *
 * Kraken (https://kraken.re, free software) finds the lines of the image, then a recognition
 * model reads them: Manu McFrench V3, trained on French manuscripts. Everything runs here,
 * nothing leaves the computer. Kraken is installed apart, in its own Python environment
 * (see docs/features/htr.md); without it, the application doesn't offer the reading.
 *
 * - LIGNEE_KRAKEN: the kraken program (default ~/lignee-kraken/bin/kraken);
 * - LIGNEE_HTR_MODEL: the model file (default: ManuMcFrenchV3.mlmodel downloaded by `kraken get`).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const HOME = os.homedir();
const KRAKEN = process.env.LIGNEE_KRAKEN || path.join(HOME, 'lignee-kraken', 'bin', 'kraken');
const MODEL_FILE = 'ManuMcFrenchV3.mlmodel';
const MODEL_DIR = path.join(HOME, '.local', 'share', 'htrmopo'); // where `kraken get` puts models
const TIMEOUT = 10 * 60 * 1000; // a big page takes about a minute; beyond ten, something is stuck

const exists = (file) => fs.access(file).then(() => true, () => false);

/** The model file, or '' if it isn't there. */
async function findModel(dir = MODEL_DIR) {
  if (process.env.LIGNEE_HTR_MODEL) return (await exists(process.env.LIGNEE_HTR_MODEL)) ? process.env.LIGNEE_HTR_MODEL : '';
  let subs = [];
  try {
    subs = await fs.readdir(dir);
  } catch (e) {
    return '';
  }
  for (const sub of subs) {
    const file = path.join(dir, sub, MODEL_FILE);
    if (await exists(file)) return file;
  }
  return '';
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unescape = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return ENTITIES[e] ?? all;
});

/** Attributes of an XML tag's text: { NAME: value }. */
function attrs(tag) {
  const out = {};
  for (const [, name, value] of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) out[name] = unescape(value);
  return out;
}

const round = (v) => Math.round(v * 10000) / 10000;

/**
 * Lines of a Kraken ALTO file: [{ box: [x, y, w, h] in fractions of the image, text, conf }], in
 * reading order; `conf` is the model's lowest confidence on the line (0 to 1).
 */
export function parseAlto(xml) {
  const page = attrs((String(xml).match(/<Page\b[^>]*>/) || [''])[0]);
  const W = +page.WIDTH || 0;
  const H = +page.HEIGHT || 0;
  if (!W || !H) return [];
  const lines = [];
  for (const [, open, body] of String(xml).matchAll(/(<TextLine\b[^>]*>)([\s\S]*?)<\/TextLine>/g)) {
    const a = attrs(open);
    const words = [...body.matchAll(/<String\b[^>]*>/g)].map(([tag]) => attrs(tag));
    const text = words.map((w) => w.CONTENT || '').join(' ').replace(/\s+/g, ' ').trim().normalize('NFC');
    if (!text) continue;
    const confs = words.map((w) => +w.WC).filter((c) => c >= 0 && c <= 1);
    lines.push({
      box: [round(+a.HPOS / W), round(+a.VPOS / H), round(+a.WIDTH / W), round(+a.HEIGHT / H)],
      text,
      conf: confs.length ? round(Math.min(...confs)) : 1,
    });
  }
  return lines;
}

/** Can this computer read? { ready, model } (model: the model's name). */
export async function htrStatus() {
  const model = await findModel();
  const ready = Boolean(model) && await exists(KRAKEN);
  return { ready, model: ready ? path.basename(model, '.mlmodel') : '' };
}

/** Runs kraken; resolves when it ends well, otherwise rejects with the end of what it wrote. */
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(KRAKEN, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => { err = (err + d).slice(-2000); });
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT);
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error('kraken: ' + (err.trim().split('\n').pop() || 'code ' + code)));
    });
  });
}

let queue = Promise.resolve(); // one reading at a time: each one uses every core

/** Reads image `file` (a path): { model, lines } (see parseAlto). */
export function readImage(file) {
  const job = queue.then(async () => {
    const model = await findModel();
    if (!model || !(await exists(KRAKEN))) throw Object.assign(new Error('Lecture indisponible sur cet ordinateur'), { status: 503 });
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lignee-htr-'));
    try {
      const out = path.join(dir, 'page.xml');
      const threads = String(Math.max(1, os.availableParallelism() - 2));
      await run(['--threads', threads, '-d', 'cpu', '-a', '-i', file, out, 'segment', '-bl', 'ocr', '-m', model]);
      return { model: path.basename(model, '.mlmodel'), lines: parseAlto(await fs.readFile(out, 'utf8')) };
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
  queue = job.catch(() => {});
  return job;
}
