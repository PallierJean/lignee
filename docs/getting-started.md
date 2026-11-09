# Démarrer sur son poste

[← Documentation technique](DEVELOPMENT.md)

De zéro à une modification testée, en un quart d'heure. Aucune dépendance à installer :
Node.js et Git suffisent.

## 1. Prérequis

| Outil | Version | Vérifier |
| --- | --- | --- |
| [Node.js](https://nodejs.org/fr/download) | 26 ou plus (fichier `.nvmrc`) | `node --version` |
| [Git](https://git-scm.com/downloads) | récente | `git --version` |
| Un éditeur | VS Code conseillé | |

Avec [nvm](https://github.com/nvm-sh/nvm), `nvm install` puis `nvm use` à la racine du projet
prennent la bonne version de Node. Pas besoin de `npm install` : il n'y a aucun paquet.

## 2. Récupérer le code

```bash
git clone https://github.com/PallierJean/lignee.git
cd lignee
```

## 3. Lancer l'application

```bash
npm start            # http://localhost:8000 ; autre port : PORT=9000 npm start
```

Les arbres sont enregistrés dans `data/arbres/`, ignoré par Git (sauf la famille d'exemple).
Pour avoir des données, cliquez sur « Importer » et choisissez
`data/arbres/exemple-famille-bertrand.json`, dans l'arbre ouvert ou dans un nouvel arbre. Le bandeau
« Retirer les exemples » efface ensuite cette famille d'un clic.

Ouvrir `index.html` directement (adresse `file://`) ne marche pas : les modules JavaScript
exigent un serveur. Sans Node.js, `python3 -m http.server 8000` dépanne, avec l'arbre gardé dans
le navigateur.

Pas de compilation : modifiez un fichier, rechargez la page.

## 4. Lancer les tests

```bash
npm test                 # tous les tests
npm run test:coverage    # comme la CI : 85 % de lignes couvertes au minimum
node --import ./test/setup.js --test test/dates.test.js   # un seul fichier
```

## 5. Faire une modification

1. Partez de `main` à jour : `git pull`. La CI y ajoute le commit de version après chaque
   fusion.
2. Créez une branche : `git checkout -b fix/nom-court`.
3. Codez, ajoutez ou adaptez le test du module dans `test/`.
4. Vérifiez : `npm run test:coverage`.
5. Committez selon les [règles du projet](guidelines.md#commits), poussez la branche, ouvrez une
   pull request.

## Ensuite

- [Règles du projet](guidelines.md) : conventions de code, de tests et de commits.
- [Architecture](architecture.md) : où se trouve quoi, comment circulent les données.
- [Stockage](storage.md) et [format des données](data-format.md).
