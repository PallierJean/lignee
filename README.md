# Lignée

**L'arbre généalogique de votre famille, simple, beau, et qui reste chez vous.**

Lignée rassemble vos ancêtres, leurs histoires, leurs photos et leurs actes dans un arbre clair,
que l'on parcourt d'un clic et que l'on imprime en grand format pour toute la famille.
Aucun compte, aucun abonnement, aucune publicité : vos données ne quittent pas votre ordinateur.

**[Essayer Lignée maintenant](https://pallierjean.github.io/lignee/)**, sans rien installer :
une famille d'exemple vous attend.

---

## Pourquoi Lignée

- **Vos données vous appartiennent.** Votre arbre reste dans votre navigateur ou dans un fichier
  sur votre ordinateur. Rien ne part sur Internet sans votre clic.
- **Prêt en une minute.** Ouvrez la page et commencez à saisir. Pas d'inscription, rien à
  configurer.
- **Compatible avec tout.** Importez et exportez en GEDCOM, le format standard des logiciels de
  généalogie, en CSV ou en sauvegarde complète.
- **En français et en anglais**, dates comprises : « vers 1850 » ou « about 1850 ».

## Ce que vous pouvez faire

### Construire votre arbre
- Des fiches complètes : naissance, décès, professions, unions, événements, notes et sources.
- Photos de famille, portraits recadrés et galerie de documents, avec les personnes identifiées
  sur chaque photo.
- Numéros Sosa calculés automatiquement, et plusieurs arbres dans la même application.
- Annuler et rétablir à tout moment.

### Explorer votre famille
- L'arbre autour de la personne de votre choix, ses ancêtres et ses descendants, ou toute la
  famille d'un coup.
- La roue d'ascendance, jusqu'à 10 générations.
- La lignée directe mise en lumière, et le lien de parenté entre deux personnes expliqué en
  toutes lettres.

### Vérifier et enrichir
- Un contrôle de cohérence qui repère les dates impossibles et les liens suspects.
- La détection des doublons et leur fusion en un clic.
- Le rapprochement avec le fichier des décès de l'INSEE, pour compléter les fiches.
- Une carte des lieux et des migrations, une frise historique, des statistiques et les
  anniversaires du jour.

### Imprimer et partager
- L'arbre ou la roue en PDF vectoriel, du format A4 au format A0, ou découpés sur plusieurs
  feuilles à assembler.
- Un livre de famille complet, branche par branche, avec récits, frises et albums photo.
- Le livret de famille de chaque personne.
- La sauvegarde de votre arbre sur GitHub, pour le retrouver partout.

### À votre image
- Des thèmes clairs et sombres, des thèmes pour les fêtes et les saisons qui suivent le
  calendrier, et des univers illustrés et animés.
- Des thèmes d'accessibilité : daltonisme, contraste élevé et texte agrandi.

## Démarrer

Lignée s'utilise de deux façons. Choisissez celle qui vous convient : vous pourrez passer de
l'une à l'autre plus tard grâce à l'export et à l'import d'une sauvegarde.

### Version en ligne : rien à installer

Ouvrez <https://pallierjean.github.io/lignee/> dans votre navigateur (Firefox, Chrome, Edge ou
Safari). C'est tout.

- Votre arbre est enregistré **dans votre navigateur**, sur cet ordinateur uniquement.
- Si vous videz les données de navigation ou changez d'ordinateur, il n'y sera plus :
  **exportez une sauvegarde de temps en temps** et gardez le fichier en lieu sûr.
- Pour le retrouver partout et ne jamais le perdre, reliez-le à un dépôt GitHub gratuit :
  suivez le guide [Garder son arbre sur GitHub](docs/guide-github.md).

### Version sur votre ordinateur : vos arbres et vos photos dans des fichiers

Lignée tourne alors sur votre machine, et vos arbres et vos photos sont rangés dans le dossier
`data/` de Lignée, comme des fichiers ordinaires que vous pouvez copier et sauvegarder.
Cela demande une petite installation, à faire une seule fois.

#### 1. Installer Node.js (version 26 ou plus)

Node.js est le programme qui fait tourner Lignée sur votre ordinateur. Il installe aussi
`npm`, la commande qui lance Lignée.

- **Windows et macOS** : allez sur <https://nodejs.org/fr/download>, téléchargez l'installateur
  de la version **26** (ou plus récente), ouvrez-le et cliquez sur « Suivant » jusqu'au bout
  en gardant les choix proposés.
- **Linux** : les versions fournies par les distributions sont souvent trop anciennes.
  Suivez la méthode « nvm » indiquée sur <https://nodejs.org/fr/download>, puis tapez
  `nvm install 26`.

Pour vérifier, ouvrez un terminal :

- Windows : touche Windows, tapez `powershell`, puis Entrée ;
- macOS : Cmd + Espace, tapez `Terminal`, puis Entrée ;
- Linux : Ctrl + Alt + T.

Tapez ensuite ces deux commandes, chacune suivie d'Entrée :

```bash
node --version
npm --version
```

La première doit afficher `v26` ou un nombre plus grand (par exemple `v26.1.0`), la seconde un
numéro de version quelconque. Si le terminal répond « commande introuvable », fermez-le,
rouvrez-le et réessayez ; au besoin, redémarrez l'ordinateur.

#### 2. Télécharger Lignée

Sur <https://github.com/PallierJean/lignee>, cliquez sur le bouton vert **Code**, puis sur
**Download ZIP**. Décompressez le fichier téléchargé (clic droit, « Extraire tout » sous
Windows ; double-clic sous macOS), puis placez le dossier obtenu où vous voulez, par exemple
dans vos Documents.

#### 3. Lancer Lignée

Dans le terminal, placez-vous dans le dossier de Lignée. Le plus simple : tapez `cd` suivi
d'une espace, faites glisser le dossier dans la fenêtre du terminal, puis appuyez sur Entrée.
Tapez ensuite :

```bash
npm start
```

Ouvrez enfin <http://localhost:8000> dans votre navigateur. Laissez le terminal ouvert tant que
vous utilisez Lignée ; pour l'arrêter, revenez dans le terminal et appuyez sur Ctrl + C.

Les fois suivantes, il suffit de refaire l'étape 3.

## Pour les développeurs

Lignée est écrit en HTML, CSS et JavaScript natifs, sans dépendance ni étape de compilation.
Architecture, format des données, tests et publication : voir la
[documentation technique](docs/DEVELOPMENT.md).

## Licence

Lignée est un logiciel libre, publié sous la licence [GNU AGPL 3.0](LICENSE).
Copyright © 2026 Jean Pallier. Mentions des éléments tiers : voir [COPYRIGHT](COPYRIGHT).
