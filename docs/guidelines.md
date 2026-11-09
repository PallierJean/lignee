# Règles du projet

[← Documentation technique](DEVELOPMENT.md)

## Principes

- **Aucune dépendance, aucune compilation.** HTML, CSS et JavaScript natifs (modules ES). Une
  bibliothèque ne s'ajoute pas : le code nécessaire s'écrit dans le projet.
- **Les données restent chez l'utilisateur.** Rien ne part sur Internet sans un clic explicite.
  Pas de police, de script ou d'image chargés depuis un autre site (voir [Sécurité](security.md)).
- **Bilingue.** Toute l'interface existe en français et en anglais.
- **Accessible.** Les contrastes des thèmes d'accessibilité sont testés ; les animations
  s'arrêtent si le système le demande.

## Langues

| Quoi | Langue |
| --- | --- |
| Code, noms, commentaires | Anglais |
| Messages de commit, Releases GitHub | Anglais, avec le pied `Fr:` (voir plus bas) |
| Documentation (`README.md`, `docs/`) | Français |
| Textes de l'interface | `js/i18n/fr.js` et `js/i18n/en.js` |

## Code

- Un module par responsabilité, rangé selon les couches décrites dans
  [Architecture](architecture.md) : `model/` calcule sans toucher la page, `services/` enregistre
  et échange, `ui/` affiche. Un service prévient l'interface par `services/notify.js`, sans
  l'importer.
- Chaque fichier commence par un commentaire `/** … */` qui dit son rôle ; chaque fonction
  exportée a le sien.
- Les constantes portent un nom et un commentaire, pas de nombre magique.
- Les clics passent par un attribut `data-act`, écouté une seule fois dans `events.js`.
- Une action qui modifie plusieurs fiches passe par `inBatch()` : enregistrée entière ou pas
  du tout, et annulable.
- Tout texte affiché passe par `t('clé')` ou les attributs `data-i18n` ; la clé est ajoutée dans
  les deux langues (un test le vérifie). Le texte saisi par l'utilisateur est échappé avant
  d'entrer dans le HTML.

## Tests

- Un fichier de test par module, dans `test/`, avec `node:test` et le faux navigateur de
  `test/setup.js`.
- Un correctif vient avec le test qui l'aurait détecté.
- La CI exige 85 % de lignes couvertes.
- Un défaut connu mais pas encore corrigé s'écrit en test « todo ».

## Branches

- Une branche par changement, partie de `main` à jour, nommée comme le type de commit :
  `feat/…`, `fix/…`, `docs/…`, `ci/…`, `refactor/…`.
- Elle est fusionnée dans `main` quand les tests passent, puis supprimée.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/fr/), sujet en anglais, à
l'impératif, en minuscules :

```
fix: keep the photo when a record is renamed

Fr: garde la photo quand une fiche est renommée
```

Le type décide de la version (voir [Versions](release.md#versions)). Un `fix`, `feat`, `perf` ou
`refactor` doit porter un pied `Fr:` avec sa traduction : il apparaît dans les notes de
version en français, et la CI refuse le commit sans lui.

## Documentation

- Une nouvelle fonctionnalité visible se décrit dans le [README](../README.md) (pour les
  utilisateurs) et dans `docs/features/` (fonctionnement détaillé).
- Un nouveau fichier s'ajoute à l'arborescence de [Architecture](architecture.md).
- Un changement de format des données se décrit dans [Format des données](data-format.md).
