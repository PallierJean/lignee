# Stockage des données

[← Documentation technique](DEVELOPMENT.md)

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

Partout, les sources partagées (`S.sources`) passent par la même écriture que les fiches :
`storage.js` découpe les documents d'une fiche en citations et en sources (`planSources` dans
`model/sources.js`), envoie les actes de mariage à l'union, dans le même lot, et supprime les sources
que plus personne ne cite.

En stockage navigateur, les données restent sur cet appareil et dans ce navigateur.
Exportez régulièrement une sauvegarde (.json) ou un fichier GEDCOM.

Le contenu des fichiers est décrit dans [Format des données](data-format.md).
