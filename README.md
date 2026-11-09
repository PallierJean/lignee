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

**En ligne** : ouvrez <https://pallierjean.github.io/lignee/>. Votre arbre est gardé dans votre
navigateur : pensez à exporter une sauvegarde de temps en temps.

**Sur votre ordinateur**, pour garder vos arbres et vos photos dans des fichiers (Node.js 26 ou plus) :

```bash
npm start
```

Puis ouvrez <http://localhost:8000>.

## Pour les développeurs

Lignée est écrit en HTML, CSS et JavaScript natifs, sans dépendance ni étape de compilation.
Architecture, format des données, tests et publication : voir la
[documentation technique](docs/DEVELOPMENT.md).

## Licence

Lignée est un logiciel libre, publié sous la licence [GNU AGPL 3.0](LICENSE).
Copyright © 2026 Jean Pallier. Mentions des éléments tiers : voir [COPYRIGHT](COPYRIGHT).
