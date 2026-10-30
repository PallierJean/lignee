/**
 * Point d'entrée de Lignée.
 *
 * Dans claude.ai, l'application utilise la base de données en ligne de l'artefact
 * (window.claude). Avec le serveur local (node server.js), elle enregistre chaque arbre
 * dans data/arbres/ (et ses photos dans data/arbres/<nom de l'arbre>/photos/).
 * Sinon, elle le garde dans le navigateur.
 */
import { S, services, loadPrefs } from './state.js';
import { bindEvents } from './events.js';
import { applyStatic } from './i18n.js';
import { renderAll, afterData } from './ui/render.js';
import { loadLocal, loadFile, subscribe } from './services/storage.js';

/** Service fourni par claude.ai, ou null hors de claude.ai. */
async function useService(name) {
  try {
    return window.claude && window.claude.use ? await window.claude.use(name) : null;
  } catch (e) {
    return null;
  }
}

async function init() {
  loadPrefs();
  applyStatic();
  bindEvents();
  renderAll(); // état « Ouverture de l'arbre… »

  // 1. Données : base en ligne, fichier du projet ou navigateur
  const db = await useService('db');
  if (db) {
    services.db = db;
    S.mode = 'db';
    subscribe();
  } else {
    if (!(await loadFile())) {
      S.mode = 'local';
      loadLocal();
    }
    S.loadedP = true;
    S.loadedU = true;
  }
  afterData();

  // 2. Droit de modification (base en ligne seulement)
  if (S.mode === 'db') {
    const user = await useService('user');
    if (user) {
      try {
        const canWrite = await user.can('data.write');
        if (canWrite === false) S.canWrite = false;
        S.writeKnown = canWrite !== null && canWrite !== undefined;
        renderAll(true);
      } catch (e) {
        /* information indisponible : on laisse l'enregistrement décider */
      }
    }
  }

  // 3. Téléchargement de fichiers dans claude.ai
  services.downloads = await useService('downloads');
}

init();
