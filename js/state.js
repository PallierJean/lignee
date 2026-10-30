/**
 * État partagé de l'application.
 * Un seul objet S, lu et modifié par les autres modules.
 */
import { ZOOMS, PREF_KEY, DEFAULT_TREE } from './config.js';

export const S = {
  mode: 'loading',       // 'loading' | 'db' (base en ligne) | 'file' (data/arbres/) | 'local' (navigateur)
  tree: DEFAULT_TREE,    // identifiant de l'arbre ouvert
  trees: new Map(),      // id -> { name, count, createdAt } : tous les arbres de la collection
  loadedT: false,        // liste des arbres reçue de la base
  treeEdit: null,        // fenêtre « Mes arbres » : { id, kind: 'rename' | 'delete' } ou null
  people: new Map(),     // id -> personne
  unions: new Map(),     // id -> union { a, b, date, place }
  loadedP: false,        // personnes reçues de la base
  loadedU: false,        // unions reçues de la base

  focus: null,           // id de la personne au centre de l'arbre
  foci: {},              // id d'arbre -> personne centrale, retrouvée en revenant sur l'arbre
  up: 3,                 // générations d'ascendants affichées
  down: 2,               // générations de descendants affichées
  zoom: 1,
  full: false,           // arbre complet, à plat (sinon vue centrée sur la personne)
  fan: false,            // roue d'ascendance à la place de l'arbre
  line: true,            // halo sur la lignée directe de la personne centrale
  tab: 'fiche',          // onglet du panneau : 'fiche' | 'registre' | 'analyse'
  analyse: 'kin',        // vue de l'onglet Analyse : voir VIEWS dans ui/analyse.js
  timeFamily: false,     // frise : la famille proche plutôt que la personne seule
  dupIgnored: new Set(), // paires de doublons écartées pendant cette session
  calMonth: null,        // mois affiché dans les éphémérides (1 à 12), null = mois en cours
  kinA: '',              // personnes comparées dans le lien de parenté
  kinB: '',
  kinShow: false,        // chemin de parenté surligné dans l'arbre
  kinWasFull: false,     // vue de l'arbre à retrouver en retirant le surlignage
  popup: null,           // id de la personne dont la fiche est ouverte en fenêtre, ou null

  edit: null,            // brouillon du formulaire en cours, ou null
  confirmDel: false,     // confirmation de suppression affichée
  repoLink: null,        // dépôt GitHub lié à un arbre ; jamais enregistré, le jeton reste en mémoire
  repoConfirm: false,    // confirmation d'envoi vers le dépôt affichée
  repoError: '',         // échec du dernier envoi
  confirmEx: false,      // confirmation de retrait des exemples affichée
  query: '',             // recherche du registre

  canWrite: true,        // l'utilisateur peut modifier l'arbre
  writeKnown: false,     // le droit d'écriture a été confirmé par la plateforme
  busy: false,           // enregistrement en cours
  pending: null,         // import lu, en attente de confirmation

  scrollPending: true,   // recentrer l'arbre au prochain rendu
  lastLayout: null,      // dernière mise en page calculée
  firstScroll: true,
};

/** Index recalculés à chaque changement : enfants et conjoints de chaque personne. */
export const idx = {
  children: new Map(),   // id parent -> [id enfants]
  partners: new Map(),   // id -> Map(id conjoint -> id union | null)
};

/** Éléments DOM des fiches de l'arbre, réutilisés d'un rendu à l'autre. */
export const cardEls = new Map();

/** Services fournis par claude.ai quand l'application y est publiée (sinon null). */
export const services = {
  db: null,
  downloads: null,
};

export const isLoading = () => S.mode === 'loading' || (S.mode === 'db' && (!S.loadedP || !S.loadedT));

/** Nom de l'arbre ouvert. */
export const treeName = () => (S.trees.get(S.tree) || {}).name || '';

export function loadPrefs() {
  try {
    const v = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    if (v.up >= 1 && v.up <= 7) S.up = v.up;
    if (v.down >= 0 && v.down <= 3) S.down = v.down;
    if (ZOOMS.includes(v.zoom)) S.zoom = v.zoom;
    if (typeof v.tree === 'string') S.tree = v.tree;
    if (v.foci && typeof v.foci === 'object') S.foci = v.foci;
    if (typeof S.foci[S.tree] === 'string') S.focus = S.foci[S.tree];
    S.full = v.full === true;
    S.fan = v.fan === true;
    S.line = v.line !== false;
  } catch (e) {
    /* stockage indisponible : on garde les valeurs par défaut */
  }
}

export function savePrefs() {
  try {
    if (S.focus) S.foci[S.tree] = S.focus;
    else delete S.foci[S.tree];
    localStorage.setItem(PREF_KEY, JSON.stringify({ up: S.up, down: S.down, zoom: S.zoom, full: S.full, fan: S.fan, line: S.line, tree: S.tree, foci: S.foci }));
  } catch (e) {
    /* stockage indisponible : préférences non mémorisées */
  }
}
