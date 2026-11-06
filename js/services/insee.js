/**
 * Checking records against INSEE's death file, through server.js (file mode):
 * only the birth surname, first given name, sex and birth are sent, one record
 * per second. The certificates found are kept in this browser, per tree and per record, with
 * the question asked: a record is only checked again if that question changes.
 */
import { INSEE_KEY } from '../config.js';
import { S } from '../state.js';
import { inseeQuery, inseeSignature, matchDeath } from '../model/insee.js';
import { sleep } from '../utils/helpers.js';

const PAUSE = 1000;
const KEPT = 10; // certificates kept per record

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(INSEE_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}

function writeAll(all) {
  try {
    localStorage.setItem(INSEE_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage full: the results stay valid until reload */
  }
}

let memo = null; // { [tree]: { [record]: { sig, acts, ignored } } }
const all = () => (memo = memo || readAll());

/** Results for the open tree: { [record]: { sig, acts, ignored } }. */
export const inseeResults = () => all()[S.tree] || {};

/** The search goes through server.js: only available in file mode. */
export const inseeAvailable = () => S.mode === 'file';

/** Ids of the records to check: new ones, or those whose question changed since the last check. */
export function inseePending() {
  const done = inseeResults();
  return [...S.people.keys()].filter((id) => {
    const sig = inseeSignature(inseeQuery(id));
    return sig && (!done[id] || done[id].sig !== sig);
  });
}

/** Keeps a record's result. */
function keep(id, entry) {
  const store = all();
  store[S.tree] = { ...(store[S.tree] || {}), [id]: entry };
  writeAll(store);
}

/** Fingerprint of a certificate: its death and its number. */
const actKey = (a) => [a.last, a.deathDate, a.certificate].join('|');

/**
 * Certificate kept for record `id`: like matchDeath(), but a lead confirmed by
 * the user ("That's them") moves up to the 'confirmed' level.
 */
export function inseeMatch(id) {
  const entry = inseeResults()[id];
  const m = entry && matchDeath(id, entry.acts);
  return m && m.level === 'lead' && entry.confirmed === actKey(m.act) ? { ...m, level: 'confirmed' } : m;
}

/** "That's them": the record's lead becomes its certificate, its differences can be reported. */
export function confirmInsee(id) {
  const entry = inseeResults()[id];
  const m = inseeMatch(id);
  if (entry && m) keep(id, { ...entry, confirmed: actKey(m.act) });
}

/** Stops showing this record's difference, as long as its question doesn't change. */
export function ignoreInsee(id) {
  const entry = inseeResults()[id];
  if (entry) keep(id, { ...entry, ignored: true });
}

/** Forgets the open tree's checks: everything will be checked again. */
export function forgetInsee() {
  const store = all();
  delete store[S.tree];
  writeAll(store);
}

/** Error from a server response; `login`: matchID asks to sign in. */
async function failure(res) {
  const text = await res.text().catch(() => '');
  return Object.assign(new Error(text.startsWith('{') ? '' : text), { login: res.status === 401 });
}

/** matchID sign-in: { connected, user, expires }. */
export async function inseeStatus() {
  const res = await fetch('api/insee/status', { cache: 'no-store' });
  if (!res.ok) throw await failure(res);
  return res.json();
}

async function post(route, body) {
  const res = await fetch('api/insee/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw await failure(res);
  return res.json();
}

/** matchID sends a code to this address. */
export const inseeRegister = (email) => post('register', { email });

/** Code received by e-mail: the server keeps the token. */
export const inseeAuth = (email, code) => post('auth', { email, code });

/** Checks records `ids` one by one; a failure, or a sign-in request, stops the check. */
export async function checkInsee(ids, onProgress) {
  for (const [i, id] of ids.entries()) {
    const q = inseeQuery(id);
    if (q) {
      const res = await fetch('api/insee?' + new URLSearchParams(q));
      if (!res.ok) throw await failure(res);
      keep(id, { sig: inseeSignature(q), acts: (await res.json()).slice(0, KEPT) });
    }
    onProgress(i + 1, ids.length);
    if (i < ids.length - 1) await sleep(PAUSE);
  }
}

/** For tests: reloads the storage. */
export const resetInseeMemo = () => {
  memo = null;
};
