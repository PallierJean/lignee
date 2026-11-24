/**
 * Recognising faces on this computer, for server.js: who may be on an image of the gallery.
 *
 * OpenCV (free software) runs two models of its model zoo, in a Python program
 * (scripts/faces-worker.py): YuNet finds the faces, SFace describes each one by a vector. The faces
 * already identified in the tree (markers of the gallery and archives, portraits) are compared with
 * those of the image (js/model/faces.js). Everything runs here, nothing leaves the computer. OpenCV
 * and the models are installed apart (docs/features/faces.md); without them, the application doesn't
 * suggest anyone.
 *
 * - LIGNEE_FACES: Python of OpenCV's environment (default ~/lignee-faces/bin/python);
 * - LIGNEE_FACES_MODELS: folder of the two models (default ~/.local/share/lignee-faces).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { knownFaces, suggestFaces, unknownGroups, portraitFaces } from './js/model/faces.js';

const HOME = os.homedir();
const PYTHON = process.env.LIGNEE_FACES || path.join(HOME, 'lignee-faces', 'bin', 'python');
const MODELS = process.env.LIGNEE_FACES_MODELS || path.join(HOME, '.local', 'share', 'lignee-faces');
const DETECTOR = 'face_detection_yunet_2023mar.onnx';
const RECOGNIZER = 'face_recognition_sface_2021dec.onnx';
const WORKER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'scripts', 'faces-worker.py');
const TIMEOUT = 5 * 60 * 1000; // a hundred images take a few seconds; beyond five minutes, it's stuck
const CHUNK = 100;             // images per run of the worker (length of the command line)
const CACHE = 5000;            // images whose faces stay in memory

const exists = (file) => fs.access(file).then(() => true, () => false);

let hasOpenCv = null; // Promise<boolean>; asked again while the answer is no (installed meanwhile)

function openCvReady() {
  if (!hasOpenCv) {
    hasOpenCv = new Promise((resolve) => {
      const child = spawn(PYTHON, ['-c', 'import cv2; cv2.FaceDetectorYN; cv2.FaceRecognizerSF'], { stdio: 'ignore' });
      child.on('error', () => resolve(false));
      child.on('close', (code) => resolve(code === 0));
    }).then((ok) => {
      if (!ok) hasOpenCv = null;
      return ok;
    });
  }
  return hasOpenCv;
}

/** Can this computer recognise faces? { ready } */
export async function facesStatus() {
  const models = await exists(path.join(MODELS, DETECTOR)) && await exists(path.join(MODELS, RECOGNIZER));
  return { ready: models && await openCvReady() };
}

/** Runs the worker on `files`: one result per file, { faces } or { error }. */
function run(files) {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, [WORKER, path.join(MODELS, DETECTOR), path.join(MODELS, RECOGNIZER), ...files], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err = (err + d).slice(-2000); });
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT);
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      const lines = out.split('\n').filter(Boolean);
      if (code !== 0 || lines.length !== files.length) {
        reject(new Error('faces : ' + (err.trim().split('\n').pop() || 'code ' + code)));
        return;
      }
      resolve(lines.map((l) => JSON.parse(l)));
    });
  });
}

const cache = new Map(); // path -> { stamp, faces, size }: an image changes name when it changes, but who knows

/** Faces of each image of `files` (paths): Map path -> { faces, size }; an unreadable image has none. */
async function facesOf(files) {
  const result = new Map();
  const todo = [];
  for (const file of new Set(files)) {
    let st;
    try {
      st = await fs.stat(file);
    } catch (e) {
      continue; // gone: no faces
    }
    const stamp = `${st.size}:${st.mtimeMs}`;
    const hit = cache.get(file);
    if (hit && hit.stamp === stamp) result.set(file, hit);
    else todo.push({ file, stamp });
  }
  for (let i = 0; i < todo.length; i += CHUNK) {
    const part = todo.slice(i, i + CHUNK);
    const lines = await run(part.map((x) => x.file));
    part.forEach(({ file, stamp }, k) => {
      const seen = { stamp, faces: Array.isArray(lines[k].faces) ? lines[k].faces : [], size: lines[k].size || null };
      if (cache.size >= CACHE) cache.clear();
      cache.set(file, seen);
      result.set(file, seen);
    });
  }
  return result;
}

let queue = Promise.resolve(); // one search at a time: each one uses every core

/** Runs `fn` after the searches before it, once the computer is known to recognise faces. */
function inTurn(fn) {
  const job = queue.then(async () => {
    if (!(await facesStatus()).ready) throw Object.assign(new Error('Reconnaissance des visages indisponible sur cet ordinateur'), { status: 503 });
    return fn();
  });
  queue = job.catch(() => {});
  return job;
}

/** `refs` ({ file, … }) with the faces and size of their image ({ faces, size, … }). */
const withFaces = (refs, seen) => refs.map(({ file, ...r }) => ({ ...r, faces: (seen.get(file) || {}).faces || [], size: (seen.get(file) || {}).size }));

/**
 * Who may be on image `file` (a path): [{ x, y, id, score }] (see suggestFaces). `refs` are the
 * known faces, [{ id, file, x?, y? }] in order of preference; `tags` the markers already on the image.
 */
export function findFaces(file, refs, tags) {
  return inTurn(async () => {
    const seen = await facesOf([file, ...refs.map((r) => r.file)]);
    const known = knownFaces(withFaces(refs.filter((r) => r.file !== file), seen));
    return suggestFaces((seen.get(file) || {}).faces || [], known, tags);
  });
}

/**
 * The whole gallery at once: { groups, portraits }. `images` are the gallery's images,
 * [{ photo, file, tags }]; `refs` the known faces (as for findFaces, with `photo`); `ids` the people
 * without a portrait. groups: unknown faces seen on several images (unknownGroups); portraits: the
 * clearest face of each person without a portrait (portraitFaces).
 */
export function faceOverview(images, refs, ids) {
  return inTurn(async () => {
    const seen = await facesOf([...images.map((x) => x.file), ...refs.map((r) => r.file)]);
    const known = knownFaces(withFaces(refs, seen));
    return {
      groups: unknownGroups(withFaces(images, seen), known),
      portraits: portraitFaces(withFaces(refs, seen), ids),
    };
  });
}
