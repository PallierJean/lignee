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

const stubEl = () => ({ dataset: {}, setAttribute() {}, textContent: '', title: '', content: '' });

// Node 26 a son propre localStorage (vide sans --localstorage-file) : on le remplace
Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true, writable: true });
globalThis.window = globalThis;
globalThis.document = {
  documentElement: {},
  querySelector: stubEl,
  querySelectorAll: () => [],
  getElementById: stubEl,
};
