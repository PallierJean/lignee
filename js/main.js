/**
 * Lignée entry point.
 *
 * With the local server (node server.js), the application saves each tree
 * in data/arbres/ (and its photos in data/arbres/<tree name>/photos/).
 * Otherwise, it keeps it in the browser.
 */
import { S, loadPrefs } from './state.js';
import { bindEvents } from './events.js';
import { applyStatic, t } from './i18n.js';
import { renderAll, afterData } from './ui/render.js';
import { loadCommunes } from './model/communes.js';
import { loadLocal, seedExample, loadFile } from './services/storage.js';
import { applyTheme } from './ui/theme.js';
import { connectServices } from './ui/connect.js';
import { checkHtr } from './services/htr.js';
import { initVoice } from './ui/voice.js';
import * as A from './actions.js';

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

  // 1. Data: project file, or the browser
  if (!(await loadFile())) {
    S.mode = 'local';
    await seedExample();
    loadLocal();
  }
  afterData();

  // 2. Reading handwriting on this computer (local server with Kraken): the buttons appear once known
  checkHtr().then(({ ready }) => ready && renderAll()).catch(() => {});

  // 2b. Voice commands: the microphone appears if this device can listen (ui/voice.js)
  initVoice(A).catch(() => {});

  // 3. French communes, loaded after opening: the consistency check then verifies places' departments
  loadCommunes().then(() => renderAll()).catch(() => {});
}

/**
 * True if the page is shown inside another site's frame: that site could trick users into
 * clicking its buttons blindly ("Delete"…). GitHub Pages doesn't allow the header that forbids it
 * (frame-ancestors).
 */
const framedByOtherSite = () => window.top !== window.self;

if (framedByOtherSite()) {
  const p = document.createElement('p');
  p.className = 'framed';
  const a = Object.assign(document.createElement('a'), { href: location.href, target: '_blank', rel: 'noopener', textContent: t('framedOpen') });
  p.append(t('framed'), ' ', a);
  document.body.replaceChildren(p);
} else {
  init();
}
