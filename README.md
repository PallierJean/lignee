# Lignée

Application web d'arbre généalogique : fiches de personnes, unions, événements, sources,
galerie, numéros Sosa, roue d'ascendance, registre par nom de famille, import et export
GEDCOM, CSV, annuler / rétablir, et un onglet Analyse (lien de parenté, cohérence, doublons,
statistiques, éphémérides, frise, carte, galerie). Gère une collection d'arbres (bouton
« Arbre » de l'en-tête) : chacun a ses propres personnes et unions.

HTML, CSS et JavaScript natifs (modules ES). Aucune dépendance, aucune étape de compilation.

## Arborescence

```
lignee/
├── index.html                  Structure de la page
├── package.json                Scripts npm start et npm test, version de Node (26 ou plus)
├── .nvmrc                      Version de Node pour nvm (26)
├── .gitignore                  Exclut vos arbres et photos du dépôt
├── .github/workflows/ci.yml    Intégration continue : tests, puis version automatique
├── .releaserc.json             Réglages du calcul des versions
├── scripts/build-site.sh       Prépare le site GitHub Pages
├── renovate.json               Mises à jour automatiques proposées par Renovate
├── CHANGELOG.md                Historique des versions (généré)
├── server.js                   Serveur local : sert l'application, écrit data/arbres/
├── assets/
│   └── favicon.svg             Icône de l'onglet
├── images/
│   └── avatar_femme.jpeg, avatar_homme.jpeg   Avatars par défaut des fiches
├── css/
│   ├── tokens.css              Couleurs (thèmes clair et sombre), polices
│   ├── base.css                Remise à zéro, typographie, utilitaires
│   ├── layout.css              Grille de la page, adaptation mobile
│   └── components/
│       ├── controls.css        Boutons, champs de saisie
│       ├── badges.css          Pastille d'état, numéro Sosa, symbole du sexe
│       ├── header.css          En-tête, bandeau
│       ├── tree.css            Barre d'outils, toile, traits, fiches de l'arbre
│       ├── panel.css           Onglets, fiche détaillée
│       ├── form.css            Formulaire d'ajout et de modification
│       ├── registre.css        Liste par nom de famille
│       ├── search.css          Recherche rapide et suggestions
│       ├── modal.css           Fenêtre Importer / exporter
│       ├── person.css          Fiche d'une personne en fenêtre
│       ├── print.css           Fenêtre Imprimer, feuille imprimée
│       ├── trees.css           Bouton « Arbre », fenêtre Mes arbres
│       ├── analyse.css         Onglet Analyse, sources, roue d'ascendance, galerie
│       └── toast.css           Messages de confirmation
├── js/
│   ├── main.js                 Point d'entrée : choix du stockage, démarrage
│   ├── config.js               Constantes (dimensions, zoom, mois, clés)
│   ├── state.js                État partagé, préférences d'affichage
│   ├── events.js               Écoute des clics (attribut data-act) et saisies
│   ├── i18n.js                 Textes en français et en anglais, bouton FR / EN
│   ├── actions.js              Actions : naviguer, ajouter, modifier, supprimer
│   ├── utils/
│   │   ├── dom.js              Sélection, échappement HTML
│   │   ├── helpers.js          Identifiants, recherche sans accents, file d'attente
│   │   ├── dates.js            Lecture et affichage des dates
│   │   └── image.js            Réduction des photos
│   ├── model/
│   │   ├── people.js           Noms, âges, parents, conjoints, enfants, événements, sources, galerie
│   │   ├── kinship.js          Lien de parenté entre deux personnes
│   │   ├── checks.js           Vérification de cohérence
│   │   ├── duplicates.js       Doublons probables, fiche fusionnée
│   │   ├── stats.js            Statistiques de l'arbre
│   │   ├── ephemerides.js      Anniversaires du jour et du mois
│   │   ├── timeline.js         Frise chronologique
│   │   ├── history-data.js     Repères historiques de la frise
│   │   ├── places.js           Lieux cités, migrations
│   │   ├── narrative.js        Récit du livret de famille de l'arbre
│   │   └── family-book.js      Livret de famille d'une personne
│   ├── services/
│   │   ├── storage.js          Enregistrement et collection d'arbres : choisit le mode ci-dessous
│   │   ├── storage/
│   │   │   ├── trees.js        Règles communes à la collection d'arbres
│   │   │   ├── db.js           Mode base en ligne (claude.ai), synchronisation en direct
│   │   │   ├── file.js         Mode fichier (server.js), photos en fichiers
│   │   │   └── local.js        Mode navigateur (localStorage)
│   │   ├── gedcom.js           Export et import GEDCOM 5.5.1
│   │   ├── backup.js           Sauvegarde complète au format JSON
│   │   ├── csv.js              Export du registre en CSV
│   │   ├── history.js          Historique annuler / rétablir
│   │   └── geocode.js          Coordonnées des lieux (OpenStreetMap, sur demande)
│   ├── tree/
│   │   ├── layout.js           Calcul des positions de l'arbre
│   │   ├── full-layout.js      Arbre complet, à plat, par génération
│   │   ├── fan.js              Roue d'ascendance (SVG, écran et impression)
│   │   ├── tiles.js            Découpage d'un dessin sur plusieurs feuilles
│   │   └── render.js           Dessin des fiches et des traits
│   └── ui/
│       ├── render.js           Rendu général
│       ├── header.js           En-tête, bandeau, barre d'outils
│       ├── fiche.js            Fiche détaillée d'une personne
│       ├── person-dlg.js       Fiche d'une personne en fenêtre, au clic dans l'arbre
│       ├── form.js             Formulaire
│       ├── registre.js         Registre par nom de famille
│       ├── search.js           Recherche rapide de l'en-tête
│       ├── transfer.js         Fenêtre Importer / exporter
│       ├── print.js            Impression : arbre, roue (une ou plusieurs feuilles), livret (A4)
│       ├── booklet.js          Pages du livret de famille
│       ├── analyse.js          Onglet Analyse
│       ├── places.js           Carte des lieux en SVG
│       ├── media.js            Visionneuse de la galerie, identification sur les photos
│       ├── trees.js            Fenêtre Mes arbres : ouvrir, créer, renommer, supprimer
│       ├── spouse-pick.js      Choix d'un conjoint existant
│       └── toast.js            Messages
├── test/                       Tests (node --test), un fichier par module
│   ├── setup.js                Faux navigateur minimal (éléments, événements, localStorage)
│   └── helpers.js              Famille d'exemple, arbre en mémoire
└── data/
    └── arbres/                         Vos arbres, un fichier .json chacun (créés par server.js)
        └── exemple-famille-bertrand.json   Famille d'exemple, seul fichier de ce dossier dans git
```

## Langue

Le bouton FR / EN de l'en-tête passe toute l'interface en français ou en anglais ;
le choix est mémorisé dans le navigateur. Les textes sont dans `js/i18n.js` : `t('clé')`
dans le code, attributs `data-i18n`, `data-i18n-html` et `data-i18n-attr` dans `index.html`.
Les dates se saisissent dans les deux langues (« vers 1850 » ou « about 1850 ») et
s'affichent dans la langue choisie. Les données saisies (noms, lieux, notes) ne sont pas traduites.

## Lancer l'application

Les modules JavaScript ne se chargent pas en ouvrant `index.html` directement
(adresse `file://`). Il faut un petit serveur local, au choix :

```bash
# Recommandé : avec Node.js 26 ou plus, les arbres sont enregistrés dans data/arbres/
nvm use              # si vous utilisez nvm (lit .nvmrc)
npm start            # ou : node server.js   (autre port : PORT=9000 node server.js)

# Sans Node.js : l'arbre reste dans le navigateur
python3 -m http.server 8000
```

Puis ouvrez <http://localhost:8000>.

Pour voir l'application avec des données, cliquez sur « Importer / exporter » et
importez `data/arbres/exemple-famille-bertrand.json`, dans l'arbre ouvert ou dans un nouvel
arbre. Le bandeau « Retirer les exemples » efface ensuite cette famille d'un clic.

## Plusieurs arbres

Le bouton « Arbre » de l'en-tête affiche le nom de l'arbre ouvert et ouvre la fenêtre
« Mes arbres » : passer d'un arbre à l'autre, en créer un (vide), le renommer ou le
supprimer avec toutes ses fiches. Il reste toujours au moins un arbre. La personne
centrale de chaque arbre est retenue. À l'import, « Créer un nouvel arbre » range le
fichier dans un arbre à part, nommé d'après la sauvegarde ou le nom du fichier.
Les exports (GEDCOM, .json) portent sur l'arbre ouvert et sont nommés d'après lui.

## Où sont les données

| Où l'application est ouverte | Stockage |
| --- | --- |
| Avec `npm start` (server.js) | Un fichier par arbre dans `data/arbres/` du projet, photos dans `data/arbres/<id>/photos/` |
| Avec un autre serveur ou un hébergement web | Navigateur (`localStorage`, clés `lignee.trees.v1` et `lignee.tree.<id>`) |
| Publiée dans claude.ai | Base de données en ligne de l'artefact, partagée avec les personnes invitées |

Chaque fichier de `data/arbres/` a le même format que la sauvegarde .json (avec le
nom de l'arbre dans `name`) : il se réimporte tel quel. Il est réécrit en entier à
chaque modification. Au premier lancement de `server.js`, les arbres déjà gardés
dans le navigateur (à la même adresse) y sont recopiés automatiquement.

Les photos n'y sont pas intégrées : chacune est un fichier
`data/arbres/<id de l'arbre>/photos/NOM-Prénom-<uuid>.jpg` (même identifiant que le
fichier `<id>.json`), et la fiche garde `"photo": "photos/<fichier>"`. Les documents des
sources et les images de la galerie suivent la même règle. Renommer l'arbre
ne déplace rien. Une
photo retirée ou remplacée, ou celle d'une personne supprimée, reste sur le disque le temps
que l'action puisse être annulée, puis est effacée à la prochaine ouverture de l'arbre. Les photos
encore intégrées (arbre importé, ou enregistré avant ce changement) sont sorties en
fichiers à l'ouverture de l'arbre. La sauvegarde .json exportée les réintègre en data URL.

Dans la base en ligne, les fiches portent un champ `tree` (identifiant de l'arbre) ; celles qui n'en ont pas
appartiennent à « Mon arbre », et les noms des arbres sont dans la collection `trees`.

En stockage navigateur, les données restent sur cet appareil et dans ce navigateur.
Exportez régulièrement une sauvegarde (.json) ou un fichier GEDCOM.

## Format des données

Une personne :

```json
{
  "given": "Henri", "surname": "Bertrand", "maidenName": "", "sex": "M",
  "birthDate": "12/03/1932", "birthPlace": "Saint-Étienne",
  "deathDate": "08/11/2004", "deathPlace": "Saint-Étienne", "deceased": true,
  "occupation": "Ajusteur", "situation": "married", "situationDate": "1956", "notes": "",
  "fatherId": "p_ex_01", "motherId": "p_ex_02",
  "createdAt": 1793174000000, "updatedAt": 1793174000000
}
```

`photo` (facultatif) est une image JPEG intégrée en data URL (`data:image/jpeg;base64,…`),
ou, avec `server.js`, une référence `photos/<fichier>` (voir plus haut).
Elle est choisie dans le formulaire, réduite à 320 pixels de côté au plus (quelques
dizaines de Ko), et affichée en haut de la fiche. Sans photo, la fiche montre
`images/avatar_femme.jpeg` ou `images/avatar_homme.jpeg` selon le sexe (rien si le
sexe n'est pas précisé). Elle n'est pas exportée en GEDCOM ;
la sauvegarde .json la conserve.

`surname` est le nom d'usage. `maidenName` est le nom de jeune fille d'une femme
(facultatif) : affiché « DUPONT née FAURE », cherchable, et listé dans le registre
sous les deux noms. En GEDCOM, le nom de naissance est exporté en premier `NAME`,
le nom d'usage en second avec `TYPE married` ; à l'import, `_MARNM` est aussi reconnu.

`events` (facultatif) liste les autres événements : `{ "id", "type", "date", "place", "note" }`.
Types : `baptism`, `burial`, `cremation`, `census`, `residence`, `occupation`, `emigration`,
`immigration`, `naturalization`, `graduation`, `retirement`, `will`, `other` (avec `label`).
En GEDCOM : `BAPM`, `BURI`, `CREM`, `CENS`, `RESI`, `OCCU`, `EMIG`, `IMMI`, `NATU`, `GRAD`, `RETI`,
`WILL`, `EVEN` + `TYPE`. À l'import, `CHR` devient un baptême. Un baptême ou une inhumation
reste un événement : il ne remplit plus la date de naissance ou de décès. Une inhumation
marque tout de même la personne comme décédée. Le champ Profession prend un `OCCU` sans date,
sinon le dernier daté ; les `OCCU` datés deviennent des événements.

`sources` (facultatif) liste les actes cités :
`{ "id", "fact", "kind", "title", "place", "ref", "note", "photo" }`. `fact` indique le fait
appuyé : `birth`, `death`, l'`id` d'un événement, `union:<id d'union>`, ou vide pour toute la
fiche. `kind` : `birth`, `baptism`, `marriage`, `death`, `burial`, `census`, `military`, `notary`,
`family`, `book`, `web`, `other`. `photo` est le document (1400 pixels de côté au plus). En GEDCOM, chaque
source est une fiche `SOUR` (avec les balises propres à Lignée `_KIND` et `_PLAC`), citée sous le
fait avec `PAGE` (cote) et `NOTE`. Les sources d'un mariage sont gardées sur la fiche d'un
conjoint et exportées sous `MARR`. Les documents ne sont pas exportés en GEDCOM.

`media` (facultatif) est la galerie :
`{ "id", "photo", "title", "date", "note", "tags": [{ "id", "x", "y" }] }`. `tags` : personnes
identifiées, à `x` et `y` pour cent de l'image. Une image apparaît sur la fiche de sa
propriétaire et sur celles des personnes identifiées. Elle n'est pas exportée en GEDCOM ;
la sauvegarde .json la conserve.

`situation` est la situation familiale (facultative) : `single` (célibataire),
`cohabiting` (concubinage), `pacs`, `married`, `remarried`, `separated`, `divorced`, `widowed` (veuf, veuve).
Dès qu'une personne a une union renseignée, la situation affichée suit sa dernière union : Veuve si
elle a pris fin par un décès ou si le conjoint est décédé, Divorcé, Séparée, Remarié à partir du
second mariage, En concubinage… Choisir Veuf, Divorcé ou Séparé marque la fin de la dernière union.
`situationDate` est la date ou l'année du mariage ou du pacs, saisie comme les autres dates ;
elle n'est demandée que pour ces deux situations. Le libellé s'accorde au sexe (« Mariée »).
En GEDCOM, elle est exportée dans une balise propre à Lignée, `_SITU` (avec `DATE`),
relue à l'import et ignorée par les autres logiciels.

Une union : `{ "a": "p_ex_05", "b": "p_ex_06", "type": "married", "date": "18/09/1956", "place": "Saint-Étienne" }`

`type` (facultatif) : `married`, `religious`, `pacs`, `cohabiting`, `other`. Si une union n'a pas
de type et que l'un des conjoints, dont c'est la dernière union, est indiqué Marié, Pacsé ou En
concubinage, le type en est déduit à l'affichage, et enregistré à la prochaine modification de sa fiche.
`end` (facultatif) dit comment l'union a pris fin : `death` (veuvage), `divorce`, `separation`, et `endDate`
quand. En GEDCOM : `DIV` pour un divorce, `_UEND` (propre à Lignée) pour les autres.

Une personne peut enchaîner autant d'unions que nécessaire, chacune avec son type, ses dates et ses
enfants. Avec plusieurs conjoints, la fiche propose « Ajouter un enfant avec… » pour chacun. En GEDCOM : `TYPE` (libellé) et `_UTYPE` (code, propre à Lignée)
sous `MARR`. À l'import d'un autre logiciel, le type est déduit de `TYPE`, sinon laissé vide.

Les dates sont saisies librement : `12/03/1932`, `03/1932`, `1932`, `12 mars 1932`, `Mars 1932`,
`vers 1850`, `avant 1901`, `après 1790`. Le mois en toutes lettres se lit en français ou en anglais,
sans tenir compte de la casse ni des accents. Elles restent enregistrées telles que saisies et
s'affichent au format `04 Août 1961`. Ce qui n'est pas reconnu (`Javier 1950`, `19/29 Octobre 1861`)
reste du texte libre, affiché tel quel et ignoré par les calculs. L'export GEDCOM les convertit
(`12 MAR 1932`, `ABT 1850`…).

## Fonctionnement

- `events.js` écoute les clics une seule fois pour toute la page. Chaque bouton
  porte un attribut `data-act` (par exemple `data-act="add" data-rel="father"`)
  qui renvoie à une fonction de `actions.js`.
- Les actions modifient `S` (dans `state.js`) et enregistrent via `services/storage.js`,
  puis `afterData()` recalcule les liens de parenté et redessine la page.
- `tree/layout.js` place les ascendants au-dessus de la personne centrale
  (numérotation Sosa : père = 2n, mère = 2n + 1) et les descendants en dessous,
  avec tous les conjoints de chaque personne : le premier à droite, le second à gauche, les
  suivants à droite du premier, reliés par un arc.
- Les autres conjoints d'un ancêtre (par exemple le second compagnon d'une grand-mère
  devenue veuve) s'affichent à côté de lui, sans numéro Sosa : à gauche d'un père,
  à droite d'une mère. On les ajoute depuis la fiche de l'ancêtre, avec
  « Ajouter un conjoint ou une conjointe » ou le champ « Ajouter une union ».
- « Tout l'arbre » (`tree/full-layout.js`) affiche toutes les personnes à plat, une ligne
  par génération : conjoints côte à côte, enfants sous leurs parents, familles sans lien
  posées l'une à côté de l'autre. Les numéros Sosa restent ceux de la personne choisie.
- Le titre proposé dans la fenêtre Imprimer se calcule d'après le père et la mère de la personne
  centrale (nom de naissance de la mère) : « Famille DURAND – ROCHE ». À défaut de parents
  connus, il reprend le nom le plus fréquent de l'arbre. Il reste modifiable.
- « Livret de famille », sur chaque fiche, imprime le livret de la personne, sur le modèle de celui
  remis en mairie : la personne, chaque union avec ses enfants directs, chacun en extrait
  (naissance, parents, profession, unions, décès ; sans les unions pour les enfants). Document de famille, sans valeur officielle.
- « Découpage », dans la fenêtre Imprimer, répartit l'arbre ou la roue sur plusieurs feuilles
  A4, A3 ou A2. En « Automatique » (par défaut), le nombre de feuilles dépend du dessin et du
  format : juste assez pour des prénoms de 2,5 mm au moins (2 mm pour le plus petit texte de
  la roue), une seule feuille si elle suffit. Sinon, on choisit le nombre de feuilles de large,
  la hauteur s'en déduit, et en
  orientation automatique l'application suit la forme du dessin. Les feuilles voisines se
  recouvrent de 10 mm (`tree/tiles.js`). Pour l'assemblage, la première page est un plan : le dessin
  entier, quadrillé, avec le code de chaque feuille (A1, A2, B1… : ligne en lettre, colonne en
  chiffre) et la marche à suivre. Chaque feuille porte son code, une mini-carte de sa position,
  ses voisines, et une zone grisée « Coller A2 ici » sur laquelle poser la feuille suivante.
- « Lignée directe » entoure d'un halo vert les ancêtres directs de la personne centrale (ceux
  qui ont un numéro Sosa) et colore les traits qui remontent jusqu'à eux. À l'impression, seul le
  contour des fiches est vert.
- « Éventail » (`tree/fan.js`) remplace l'arbre par la roue d'ascendance de la personne
  centrale, jusqu'à 7 générations, père à gauche et mère à droite de chaque secteur.
- « Imprimer » (`ui/print.js`) propose l'arbre complet, la roue d'ascendance ou le livret de
  famille (`ui/booklet.js`) : couverture avec la roue, sommaire, puis un chapitre par génération,
  couples groupés, portraits et sources. Ses pages A4 portent leurs propres marges, indépendantes
  des réglages de la fenêtre d'impression. L'arbre
  et la roue sont redessinés en SVG, à l'échelle d'une feuille
  A3 ou A2, et l'application ouvre l'impression du navigateur : « Enregistrer au format PDF » donne
  un PDF vectoriel au bon format (règle `@page`).

## Annuler / rétablir

Les boutons Annuler et Rétablir de la barre d'outils, ou Ctrl+Z, Ctrl+Maj+Z et Ctrl+Y (hors
d'un champ de saisie), portent sur les enregistrements, suppressions, fusions, imports et
identifications sur les photos. Une action retient uniquement les fiches qu'elle a modifiées,
avant et après. L'historique (50 actions) reste en mémoire : il disparaît au rechargement de la
page et au changement d'arbre. Avec plusieurs personnes sur la base en ligne, annuler ne touche
donc que les fiches de l'action, mais remet celles-ci dans leur état d'avant l'action.

## Onglet Analyse

- **Parenté** : le lien entre deux personnes, par le sang ou par alliance, l'ancêtre commun le
  plus proche et le chemin, surligné dans « Tout l'arbre ». Depuis une fiche : « Lien de parenté avec… ».
- **Cohérence** : erreurs certaines et points à vérifier (limites dans `model/checks.js`). Les dates
  imprécises ne sont signalées que si l'incohérence est certaine ; « vers » compte pour cinq ans
  de marge, et le texte libre n'est pas contrôlé.
- **Doublons** : fiches au même prénom usuel et au même nom, sans date contradictoire. La fusion
  reporte enfants, unions et identifications sur la fiche gardée ; elle s'annule. « Ce n'est pas
  un doublon » ne vaut que jusqu'au rechargement de la page.
- **Statistiques**, **Éphémérides** (dates exactes seulement ; un 29 février se fête le 28 les
  années non bissextiles), **Frise** (personne ou famille proche, avec repères historiques,
  plutôt français, dans `model/history-data.js`) et **Galerie** (toutes les images de l'arbre).
- **Carte** : lieux et migrations (du lieu de naissance d'un parent à celui de son enfant).
  Le bouton « Localiser » envoie les noms des lieux, et eux seuls, à OpenStreetMap (Nominatim),
  un par seconde. Rien ne part sans ce clic. Les coordonnées sont gardées dans ce navigateur
  (clé `lignee.geo.v1`). Le fond est un contour simplifié de la France, sans fichier externe.

## Sécurité

Le serveur local n'écoute que sur cet ordinateur et refuse les requêtes dont l'en-tête `Host` n'est pas
local ou dont l'`Origin` est un autre site : une page web ouverte en parallèle ne peut ni lire ni écrire
les arbres. Il envoie une politique de sécurité (`Content-Security-Policy`) qui n'autorise que les
fichiers de l'application, les polices Google et le service de localisation. Un enregistrement
porte la version de l'arbre reçue au chargement : si l'arbre a changé ailleurs (autre onglet, fichier
modifié), il est refusé plutôt que d'écraser ces changements, et un message demande de recharger.

Seules sorties vers Internet : les polices (Google Fonts, à chaque ouverture) et, sur clic,
les noms de lieux vers OpenStreetMap. L'application n'a pas de comptes : ne l'exposez pas sur un réseau.

## Tests

```bash
npm test               # tous les tests (Node 26 ou plus, aucune dépendance)
npm run test:coverage  # avec la couverture du code, 85 % de lignes au minimum
```

Les tests utilisent `node:test`. `test/setup.js` fournit un faux navigateur minimal : l'interface s'exécute
réellement et les tests vérifient le HTML produit, sans dépendance. Le stockage en mode fichier est testé
contre le vrai serveur. La CI échoue sous 85 % de lignes couvertes. Chaque fichier de `test/` couvre un module : dates,
GEDCOM (dont un aller-retour export / import de la famille d'exemple), modèle et liens
de parenté, mise en page (numéros Sosa, pas de chevauchement), sauvegarde .json,
analyse, annuler / rétablir, doublons, frise, lieux, livret, roue d'ascendance, galerie,
traductions (mêmes clés en français et en anglais, aucune clé manquante) et serveur
(API, photos, chemins refusés), lancé sur un dossier temporaire :
vos données ne sont jamais touchées. Les tests marqués « todo » décrivent des défauts
connus, pas encore corrigés : ils s'affichent sans faire échouer la suite.

## Intégration continue

GitHub Actions (`.github/workflows/ci.yml`) lance `npm run test:coverage` à chaque push sur `main`
et sur chaque pull request, avec la version de Node de `.nvmrc`. Résultats : onglet Actions du dépôt.

## Versions

Le numéro suit le [versionnage sémantique](https://semver.org/lang/fr/) et se calcule tout seul à partir
des commits ([Conventional Commits](https://www.conventionalcommits.org/fr/)), après des tests réussis sur `main` :

| Commit | Effet | Exemple |
| --- | --- | --- |
| `fix: …` | correctif | 1.2.3 → 1.2.4 |
| `feat: …` | nouvelle fonction | 1.2.3 → 1.3.0 |
| `feat!: …` ou pied `BREAKING CHANGE:` | changement incompatible | 1.2.3 → 2.0.0 |
| `docs`, `ci`, `chore`, `test`, `refactor`… | pas de nouvelle version | |

`semantic-release` met à jour `package.json` et `CHANGELOG.md`, crée le tag `vX.Y.Z` et la Release GitHub.
Ces outils tournent seulement dans GitHub Actions : le projet reste sans dépendance. Le commit de version
est ajouté par GitHub : faites `git pull` avant de repartir de `main`. La version s'affiche à côté du nom.

## Mises à jour

[Renovate](https://docs.renovatebot.com/) propose chaque lundi, en pull request, les mises à jour des actions GitHub,
des outils de version et de Node (`renovate.json`). Une pull request est fusionnée toute seule si la CI est verte,
sauf celle des outils de version : ils ne tournent qu'après la fusion et les tests ne les vérifient pas, elle
attend donc une validation. Une version doit avoir au moins sept jours pour être proposée. Le preset `conventional-changelog-conventionalcommits`
reste en 9.x, la version 10 étant incompatible.
Les actions GitHub sont figées sur l'empreinte exacte de leur version. Le tableau de bord de Renovate est
une issue ouverte en permanence : y cocher une mise à jour la lance sans attendre le lundi.

## Site GitHub Pages

À chaque push sur `main` d'un dépôt public, la CI publie l'application sur
<https://pallierjean.github.io/lignee/>, en mode navigateur : chaque visiteur garde ses arbres dans son
propre navigateur, et rien n'est envoyé au site. Pensez à exporter une sauvegarde `.json` : effacer les données du
navigateur efface l'arbre. La place y est limitée (souvent 5 Mo), photos et documents compris.

`scripts/build-site.sh` prépare le dossier `_site/` : seuls les fichiers de l'application et la famille
d'exemple y figurent, jamais `data/arbres/`, avec la politique de sécurité dans la page. Une seule
activation : Settings > Pages > Source : GitHub Actions, puis Actions > CI > Run workflow.
