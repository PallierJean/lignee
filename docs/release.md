# Tests et publication

[← Documentation technique](DEVELOPMENT.md)

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
| `refactor: …` | refonte, sans changement visible | 1.2.3 → 1.2.4 |
| `feat!: …` ou pied `BREAKING CHANGE:` | changement incompatible | 1.2.3 → 2.0.0 |
| `docs`, `ci`, `chore`, `test`… | pas de nouvelle version | |

`semantic-release` met à jour `package.json` et `CHANGELOG.md`, crée le tag `vX.Y.Z` et la Release GitHub.
Les notes de version donnent la liste en anglais (sujet du commit), puis en français : ajoutez au corps
d'un `fix`, `feat`, `perf` ou `refactor` un pied `Fr: …` avec la traduction, sinon la ligne anglaise est reprise.
La CI refuse un tel commit sans pied `Fr:` (`scripts/check-french.mjs`).
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

## Tests sur le vrai GitHub

`npm run test:github` vérifie l'import et la sauvegarde sur un vrai dépôt de test : détection des jetons, envoi, relecture,
photos et conflits. Il lit `.env.test`, ignoré par Git, qui contient `LIGNEE_TEST_REPO`, `LIGNEE_TEST_READ_TOKEN` et
`LIGNEE_TEST_WRITE_TOKEN`. Les jetons ne doivent jamais entrer dans le dépôt, qui est public : limitez-les au dépôt de test.
Sans ce fichier, `npm test` et la CI ignorent ces tests. Le cas du dépôt vide ne se rejoue pas, car le premier envoi le remplit.

## Site GitHub Pages

À chaque push sur `main` d'un dépôt public, la CI publie l'application sur
<https://pallierjean.github.io/lignee/>, en mode navigateur : chaque visiteur garde ses arbres dans son
propre navigateur, et rien n'est envoyé au site. Pensez à exporter une sauvegarde `.json` : effacer les données du
navigateur efface l'arbre. La place y est limitée (souvent 5 Mo), photos et documents compris.

À la première visite, quand ce navigateur ne contient aucun arbre, la famille d'exemple s'ouvre sous le nom
« Famille Bertrand (exemple) ». Elle ne remplace jamais un arbre existant, et le bandeau « Retirer les exemples » l'efface.

`scripts/build-site.sh` prépare le dossier `_site/` : seuls les fichiers de l'application et la famille
d'exemple y figurent, jamais vos arbres de `data/arbres/`, avec la politique de sécurité dans la page. Une seule
activation : Settings > Pages > Source : GitHub Actions, puis Actions > CI > Run workflow.

L'import et la sauvegarde sur GitHub sont décrits dans [GitHub](features/github.md).
