# Thèmes

[← Documentation technique](../DEVELOPMENT.md)

Le menu « Aa » de l'en-tête change l'apparence de Lignée : couleurs, décor animé et taille du
texte. Le choix est mémorisé dans le navigateur ; l'impression garde toujours ses propres couleurs.

## Les thèmes

### Classiques

| Thème | Rendu |
| --- | --- |
| Automatique | Clair ou sombre, selon le réglage du système |
| Clair | Fond clair |
| Sombre | Fond sombre |

### Fêtes et saisons

Un décor animé sur un calque sous l'arbre. Chaque objet a sa taille, sa vitesse et son
balancement, tirés au hasard.

| Thème | Décor |
| --- | --- |
| 🎄 Noël | Neige, guirlande tout autour de la toile |
| 🎃 Halloween | Lune et nuages, citrouilles à la bougie vacillante, brume, araignée, chauves-souris et leurs nuées, fantômes |
| 🌸 Printemps | Branches de cerisier en fleur, prairie de tulipes et de pâquerettes, pétales, papillons, hirondelles |
| ☀️ Été | Plage : vagues, écume, baigneurs flous, petit requin, mouettes |
| 🍂 Automne | Arbres qui perdent leurs feuilles de couleur au gré du vent, tapis de feuilles au sol |

**Selon la saison** passe de l'un à l'autre avec la date : Noël du 1er décembre à l'Épiphanie,
Halloween du 20 octobre au 2 novembre, puis printemps, été et automne. Au cœur de l'hiver, il
reprend le thème du système.

### Univers

Des thèmes illustrés qui habillent aussi les fiches.

- **🪄 Carte du Maraudeur** : parchemin à plan de demeure, bordures à devise, plis ; des
  empreintes rouges se promènent, suivies du nom d'une personne de l'arbre.
- **✨ Constellations** : le vrai ciel de Bordeaux, 28 constellations placées d'après le temps
  sidéral. Il part de l'heure réelle et tourne en accéléré.
- **🏺 Porcelaine de Limoges** : décor de faïence en bleu de four et or, fiches en plaques
  émaillées.
- **🕶️ Matrix** : pluie de signes verts.
- **🏴‍☠️ Grand Line** : une planche de manga, avec trait d'encre, trame et cadre de case.
  - Décor : navire pirate à tête de mouton qui vogue, îles, mouettes, chapeau de paille emporté
    par le vent, monstre marin qui surgit avec lignes de vitesse et « ドン!! », « ザザーン » des vagues.
  - Fiches en avis de recherche ; la personne au centre est « WANTED ».
- **🌌 Star Wars** : l'espace profond.
  - Ciel : étoiles qui défilent sur trois profondeurs, nébuleuses, planète à anneaux qui tourne
    avec sa tempête et sa lune, soleils jumeaux.
  - Combat spatial : le cargo en soucoupe ou le chasseur à ailes en X, poursuivis par des
    chasseurs à panneaux hexagonaux, tirs laser et explosions ; saut en hyperespace, puis un
    croiseur en forme de dague à tourelles.
  - Bataille sur la glace : un marcheur quadrupède entouré d'airspeeders qui l'enroulent d'un
    câble jusqu'à ce qu'il tombe et explose, d'autres marcheurs au loin dans la brume, une
    tranchée tenue par des soldats et des tourelles qui ripostent, gerbes de neige.
  - Au démarrage : « Il y a bien longtemps, dans une famille lointaine, très lointaine… ».
  - Fiches en hologrammes. Chaque personne a son sabre laser (vert, bleu ou rouge, poignée à
    elle ; un seul violet, tiré au hasard parmi les fiches affichées). La lignée directe brille
    en vert.

### Accessibilité

Sans motif, avec des contours de fiche plus épais.

| Thème | Pour qui |
| --- | --- |
| Daltonisme | Palette d'Okabe et Ito : hommes en bleu, femmes en orange, alertes sans opposition rouge-vert |
| Contraste élevé | Noir sur blanc, texte contrasté à 7:1 au moins |
| Contraste élevé sombre | Clair sur noir, pour qui la lumière gêne |

La lignée directe y est cerclée de noir (de blanc sur fond noir), reconnaissable quelle que soit
la forme de daltonisme. L'élément actif au clavier a un épais cadre noir et jaune.

Si le système demande moins d'animations, tous les décors s'arrêtent et seul le motif fixe du
fond reste (ciel immobile pour Constellations).

## Taille du texte

Normal, grand (125 %) ou très grand (150 %). Les fiches de l'arbre, de taille fixe, et
l'impression ne changent pas ; l'arbre a son propre zoom.

## Pour les développeurs

| Fichier | Rôle |
| --- | --- |
| `js/ui/theme.js` | Applique le thème (attribut `data-theme` de `<html>`) et la taille du texte, calcule le thème de saison |
| `css/tokens.css` | Couleurs des thèmes clair, sombre et d'accessibilité, polices |
| `css/themes.css` | Palettes et motifs des Univers, générés par `scripts/build-themes.py` |
| `js/ui/ambient.js`, `js/ui/ambient/scenes.js` | Décors des fêtes et saisons ; les scènes ne sont chargées que quand un de ces thèmes est affiché |
| `js/ui/footprints.js` | Empreintes de la Carte du Maraudeur |
| `js/model/sky.js`, `js/ui/sky.js` | Position des constellations (temps sidéral), animation du ciel |
| `js/ui/rain.js` | Pluie de signes de Matrix |

Les tailles du CSS sont en `rem` : elles suivent le réglage de taille du texte et celui du
navigateur. Les fiches de l'arbre et l'impression restent en pixels. Les tests vérifient les
contrastes des thèmes d'accessibilité.
