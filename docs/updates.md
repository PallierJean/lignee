# Mises à jour

[← Documentation technique](DEVELOPMENT.md)

## Mettre à jour sa copie de Lignée

**Version en ligne** : rien à faire. Le site est republié à chaque changement de `main` ;
rechargez la page pour avoir la dernière version.

**Version sur votre ordinateur** :

- Avec Git : `git pull` dans le dossier de Lignée, puis relancez `npm start`.
- Avec le fichier ZIP : téléchargez la nouvelle version, puis recopiez-y le dossier `data/` de
  l'ancienne (vos arbres, vos photos et le jeton matchID), avant de supprimer l'ancienne.
- Vérifiez que Node.js a toujours la version demandée (`.nvmrc`, champ `engines` de
  `package.json`) : avec nvm, `nvm install` puis `nvm use`.

Les arbres existants restent lisibles d'une version à l'autre : une sauvegarde porte
`"format": "lignee", "version": 1`, et Lignée relit les arbres des versions précédentes (par
exemple, en mode fichier, les photos encore intégrées sont sorties en fichiers à l'ouverture). Les nouveautés de chaque version sont
dans [CHANGELOG.md](../CHANGELOG.md) et les Releases GitHub.

## Mises à jour automatiques des outils (Renovate)

L'application n'a aucune dépendance. Seuls les outils de la CI se mettent à jour :
[Renovate](https://docs.renovatebot.com/) (`renovate.json`) les propose en pull request.

| Quoi | Où | Fusion |
| --- | --- | --- |
| Actions GitHub | `.github/workflows/ci.yml` | Automatique si la CI est verte |
| Node.js | `.nvmrc` | Automatique si la CI est verte |
| Outils de version (`semantic-release` et ses extensions) | `ci.yml` (`npx -p paquet@version`) | À valider à la main |

- **Quand** : le lundi avant 6 h (heure de Paris).
- **Délai** : une version doit avoir au moins sept jours pour être proposée, le temps qu'un
  défaut éventuel soit repéré.
- **Actions figées** : chaque action GitHub est fixée sur l'empreinte exacte de sa version.
- **Outils de version validés à la main** : ils ne tournent qu'après la fusion, et les tests ne
  les vérifient pas. Ils sont regroupés dans une seule pull request.
- **Exception** : `conventional-changelog-conventionalcommits` reste en 9.x, la version 10
  cassant les notes de version.
- **Tableau de bord** : une issue ouverte en permanence ; y cocher une mise à jour la lance sans
  attendre le lundi.

Les commits de Renovate sont de type `ci` : ils ne créent pas de nouvelle version de Lignée.

## Monter la version de Node.js demandée

Renovate met à jour `.nvmrc`. Le champ `engines` de `package.json` et les mentions de la version
dans le [README](../README.md) et [Démarrer sur son poste](getting-started.md) se changent à la
main, dans la même branche.
