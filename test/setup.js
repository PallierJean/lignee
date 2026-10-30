/**
 * Environnement de test : les modules de js/ sont écrits pour le navigateur.
 * On fournit le strict nécessaire (window, localStorage, document) pour les charger sous Node.
 * Chargé avant chaque fichier de test par « node --import ./test/setup.js ».
 */

class MemoryStorage {
  #m = new Map();
  getItem(k) { return this.#m.has(k) ? this.#m.get(k) : null; }
  setItem(k, v) { this.#m.set(k, String(v)); }
  removeItem(k) { this.#m.delete(k); }
  clear() { this.#m.clear(); }
}

/** Élément factice : garde ce que le code y écrit, pour que les tests puissent le relire. */
export class FakeElement {
  constructor(id = '', tag = 'div') {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.dataset = {};
    this.style = {};
    this.attrs = {};
    this.children = [];
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.className = '';
    this.title = '';
    this.content = '';
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.clientWidth = 800;
    this.clientHeight = 600;
    this.files = [];
    this.classes = new Set();
    this.classList = {
      add: (c) => this.classes.add(c),
      remove: (c) => this.classes.delete(c),
      toggle: (c, on) => (on ? this.classes.add(c) : this.classes.delete(c)),
      contains: (c) => this.classes.has(c),
    };
  }

  get lastElementChild() {
    if (!this.last) this.last = new FakeElement();
    return this.last;
  }

  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  appendChild(el) { this.children.push(el); return el; }
  remove() {}
  focus() { document.activeElement = this; }
  blur() {}
  select() {}
  click() {}
  scrollIntoView() {}
  scrollTo() {}
  addEventListener() {}
  closest(sel) { return sel === '[data-act]' && this.dataset.act ? this : null; }
  matches() { return false; }
  querySelector() { return new FakeElement(); }
  querySelectorAll() { return []; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
  getContext() { return { font: '', measureText: (t) => ({ width: t.length * 7 }), fillRect() {}, drawImage() {} }; }
}

const byId = new Map();
const bySelector = new Map();
const listeners = {};
const memo = (map, key) => {
  if (!map.has(key)) map.set(key, new FakeElement(key.replace(/^#/, '')));
  return map.get(key);
};

// Node 26 a son propre localStorage (vide sans --localstorage-file) : on le remplace
Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true, writable: true });
globalThis.window = globalThis;
globalThis.requestAnimationFrame = (fn) => fn();
globalThis.document = {
  documentElement: new FakeElement('html'),
  body: new FakeElement('body'),
  head: new FakeElement('head'),
  fonts: { ready: Promise.resolve() },
  title: '',
  activeElement: null,
  contains: () => true,
  createElement: (tag) => new FakeElement('', tag),
  querySelector: (sel) => (sel.startsWith('#') ? memo(byId, sel.slice(1)) : memo(bySelector, sel)),
  querySelectorAll: () => [],
  getElementById: (id) => memo(byId, id),
  addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
};

/** Envoie un événement aux écouteurs posés par bindEvents(). */
export const fire = (type, ev) => { for (const fn of listeners[type] || []) fn(ev); };

// Les messages se ferment seuls : leur minuterie ne doit pas retenir les tests
const nativeTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...args) => {
  const timer = nativeTimeout(fn, ms, ...args);
  if (ms >= 1000) timer.unref();
  return timer;
};
