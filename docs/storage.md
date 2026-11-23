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
| Avec un autre serveur ou un hébergement web | Navigateur : chaque arbre dans IndexedDB (base `lignee`, magasin `trees`, clé `<id>`), la liste des arbres dans le `localStorage` (`lignee.trees.v1`) |

En mode navigateur, un arbre avec ses photos et documents intégrés pèse vite des dizaines de Mo :
le `localStorage` n'en prend qu'environ 5 millions de caractères par site, IndexedDB des centaines
de Mo. L'IndexedDB est lue une fois à l'ouverture de la page, puis gardée en mémoire. Les arbres
qu'une version précédente avait laissés dans le `localStorage` (`lignee.tree.<id>`) y passent à ce
moment-là, et quittent le `localStorage`. Si le navigateur refuse IndexedDB, tout reste dans le
`localStorage`, comme avant. La page demande au navigateur de ne pas effacer ces données quand le
disque se remplit (`navigator.storage.persist()`).

Chaque fichier de `data/arbres/` a le même format que la sauvegarde .json (avec le
nom de l'arbre dans `name`) : il se réimporte tel quel. Il est réécrit en entier à
chaque modification. Au premier lancement de `server.js`, les arbres déjà gardés
dans le navigateur (à la même adresse) y sont recopiés automatiquement.

Les photos n'y sont pas intégrées : chacune est un fichier
`data/arbres/<id de l'arbre>/photos/<dossier>/NOM-Prénom-<uuid>.jpg` (même identifiant que le
fichier `<id>.json`), et la fiche garde `"photo": "photos/<dossier>/<fichier>"`. Le dossier est
`NOM_Prénom` pour le portrait d'une personne et ses actes (un acte partagé va chez la personne
dont il parle), `NOM_Prénom_X_NOM_Prénom` pour les actes d'un mariage (l'homme d'abord, puis
la femme : `DUPONT_Jean_X_FAURE_Marie`), et `galerie` pour les images de la
galerie et les documents que personne ne cite ; deux homonymes sont distingués par leur année de
naissance (`DUPONT_Jean_1850`). À l'ouverture de l'arbre, une photo qui n'est pas dans son
dossier (enregistrée avant les dossiers, personne renommée) y est copiée et la fiche suit ;
l'ancien fichier part au balayage. Dans le dossier d'une personne, un fichier nommé d'après elle
prend aussi son nom à jour (`NOM-Prénom-<uuid>`, même uuid) ; un acte nommé d'après sa source, et
les fichiers des dossiers de couple et de la galerie, gardent le leur. Un dépôt GitHub suit le même rangement : à l'envoi, une photo
déjà présente ailleurs ou sous un ancien nom y est déplacée sans être renvoyée. Renommer l'arbre ne déplace rien. Une
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
