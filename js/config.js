/**
 * Constantes de l'application : dimensions de l'arbre, zoom, formats de date,
 * clés de stockage du navigateur.
 */

// Dimensions de l'arbre, en pixels (CW et CH doivent correspondre à .card dans tree.css)
export const CW = 176;  // largeur d'une fiche
export const CH = 78;   // hauteur d'une fiche
export const HG = 18;   // écart horizontal entre deux fiches voisines
export const VG = 58;   // écart vertical entre deux générations
export const SG = 32;   // écart entre deux conjoints
export const PAD = 48;  // marge autour de l'arbre

// Niveaux de zoom proposés
export const ZOOMS = [0.55, 0.7, 0.85, 1, 1.15, 1.3];

// Mois en GEDCOM (import/export) ; les mois affichés sont dans i18n.js
export const GM = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Clés du stockage local du navigateur
export const PREF_KEY = 'lignee.view.v1';   // préférences d'affichage
export const TREES_KEY = 'lignee.trees.v1'; // liste des arbres en mode local
export const TREE_KEY = 'lignee.tree.';     // + identifiant : données d'un arbre en mode local
export const LANG_KEY = 'lignee.lang.v1';   // langue de l'interface : 'fr' ou 'en'
export const REPO_KEY = 'lignee.repo.v1';   // dépôt relié à chaque arbre, sans le jeton
export const GEO_KEY = 'lignee.geo.v1';     // coordonnées des lieux déjà localisés

// Arbre de départ (et arbre des données créées avant la gestion de plusieurs arbres) ;
// son nom par défaut est t('ts.default')
export const DEFAULT_TREE = 'principal';
export const EXAMPLE_FILE = 'data/arbres/exemple-famille-bertrand.json'; // famille chargée à la première visite

/**
 * Règle @page d'une feuille, en millimètres : Chrome ne connaît pas le mot-clé A2,
 * ignore toute la règle et coupe la feuille sur son format par défaut.
 */
export const pageRule = (w, h, margin) => `@page { size: ${w}mm ${h}mm; margin: ${margin}mm; }`;

// Préférences du système
export const reduced = window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;
export const narrow = () => (window.matchMedia ? window.matchMedia('(max-width: 900px)').matches : false);

/** Deux anneaux entrelacés (personne mariée), dans une boîte de 20 × 12. */
export const RINGS_PATH = 'M8.86 10.64A5 5 0 1 1 10.93 9.09M11.14 1.36A5 5 0 1 1 9.07 2.91';
