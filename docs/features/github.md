# GitHub

[← Documentation technique](../DEVELOPMENT.md)

Pas à pas pour les utilisateurs : [Garder son arbre sur GitHub](../guide-github.md).

« Importer » ouvre aussi un dépôt GitHub, avec un seul bouton « Connecter le dépôt ». Il ouvre dans un nouvel arbre, sans toucher à l'arbre ouvert, la sauvegarde d'un dépôt contenant une sauvegarde `.json` et ses photos, disposées
comme dans `data/arbres/` (`principal.json` et `principal/photos/`) ou à côté du fichier (`photos/`). Les
photos sont intégrées à l'arbre, en data URL. Un dépôt public se lit sans rien de plus. Un dépôt privé demande un
[jeton à portée limitée](https://github.com/settings/personal-access-tokens/new) sur ce seul dépôt, avec la
permission Contents en lecture : il n'est jamais enregistré et ne part que vers `api.github.com`.

Pour sauvegarder un arbre sur GitHub, indiquez l'adresse d'un dépôt, même vide, et un jeton avec la permission
Contents en lecture et écriture, puis cliquez sur « Connecter le dépôt » : l'arbre ouvert est relié directement ; à la place de la
famille d'exemple, un nouvel arbre porte le nom du dépôt. Si le dépôt contient une autre sauvegarde et que l'arbre
ouvert est le vôtre, Lignée propose de l'ouvrir dans un nouvel arbre ou de relier quand même l'arbre ouvert, qui ne la
remplacera qu'après confirmation. Le bandeau
« ATTENTION : LECTURE ET ÉCRITURE » apparaît, avec le bouton « Sauvegarder sur GitHub » : le `.json` et les photos
partent en un seul commit sur la branche par défaut, et une photo retirée de l'arbre quitte le dépôt (elle reste
dans son historique). Remplacer une sauvegarde que ce navigateur n'a pas écrite demande une confirmation.
L'envoi est refusé si le dépôt a changé depuis sa lecture.

Le site retient le dépôt de chaque arbre, jamais le jeton : il reste en mémoire jusqu'à la fermeture de la page.
Après un rechargement, le bandeau propose de reconnecter l'arbre avec le jeton. Une importation avec « Charger le
dépôt » relie aussi l'arbre créé, ou vide avant l'import ; avec un jeton en lecture, le bandeau indique « Lecture seule ».
