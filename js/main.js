/**
 * Lignée entry point.
 *
 * In claude.ai, the application uses the artifact's online database
 * (window.claude). With the local server (node server.js), it saves each tree
 * in data/arbres/ (and its photos in data/arbres/<tree name>/photos/).
 * Otherwise, it keeps it in the browser.
 */
import { S, services, loadPrefs } from './state.js';
import { bindEvents } from './events.js';
import { applyStatic, t } from './i18n.js';
import { renderAll, afterData } from './ui/render.js';
import { loadCommunes } from './model/communes.js';
import { loadLocal, seedExample, loadFile, subscribe } from './services/storage.js';
import { applyTheme } from './ui/theme.js';
import { connectServices } from './ui/connect.js';

/** Service provided by claude.ai, or null outside claude.ai. */
async function useService(name) {
  try {
    return window.claude && window.claude.use ? await window.claude.use(name) : null;
  } catch (e) {
    return null;
  }
}

/** Shows the version number, taken from package.json. Without it, nothing is shown. */
async function showVersion() {
  try {
    const { version } = await (await fetch('package.json', { cache: 'no-store' })).json();
    document.getElementById('appVersion').textContent = 'v' + version;
  } catch (e) {
    /* hosting without package.json */
  }
}

async function init() {
  connectServices();
  loadPrefs();
  showVersion();
  applyStatic();
  applyTheme();
  bindEvents();
  renderAll(); // "Opening the tree…" state

  // 1. Data: online database, project file or browser
  const db = await useService('db');
  if (db) {
    services.db = db;
    S.mode = 'db';
    subscribe();
  } else {
    if (!(await loadFile())) {
      S.mode = 'local';
      await seedExample();
      loadLocal();
    }
    S.loadedP = true;
    S.loadedU = true;
  }
  afterData();

  // 2. Edit permission (online database only)
  if (S.mode === 'db') {
    const user = await useService('user');
    if (user) {
      try {
        const canWrite = await user.can('data.write');
        if (canWrite === false) S.canWrite = false;
        S.writeKnown = canWrite !== null && canWrite !== undefined;
        renderAll(true);
      } catch (e) {
        /* information unavailable: let the save decide */
      }
    }
  }

  // 3. French communes, loaded after opening: the consistency check then verifies places' departments
  loadCommunes().then(() => renderAll()).catch(() => {});

  // 3. File downloads in claude.ai
  services.downloads = await useService('downloads');
}

/**
 * True if the page is shown inside another site's frame: that site could trick users into
 * clicking its buttons blindly ("Delete"…). GitHub Pages doesn't allow the header that forbids it
 * (frame-ancestors). claude.ai, which provides window.claude, shows the application in a frame.
 */
const framedByOtherSite = () => window.top !== window.self && !window.claude;

if (framedByOtherSite()) {
  const p = document.createElement('p');
  p.className = 'framed';
  const a = Object.assign(document.createElement('a'), { href: location.href, target: '_blank', rel: 'noopener', textContent: t('framedOpen') });
  p.append(t('framed'), ' ', a);
  document.body.replaceChildren(p);
} else {
  init();
}
