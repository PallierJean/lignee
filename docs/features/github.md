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
« ATTENTION : LECTURE ET ÉCRITURE » apparaît. Chaque action terminée (événement `changed` de `notify.js` :
fiche enregistrée, suppression, fusion, import, annuler, rétablir) programme un envoi 1,5 s plus tard
(`scheduleRepoSave` dans `ui/repo-link.js`) : les changements rapprochés font un seul commit, dont le message
nomme l'action ; un contenu inchangé n'en fait aucun. Le bouton « Sauvegarder sur GitHub » n'apparaît
que pour la première sauvegarde d'un dépôt écrit ailleurs, et « Réessayer l'envoi » après un échec ;
les envois, automatiques ou par ces boutons, passent un par un. Rien ne part seul avant la première sauvegarde confirmée
d'une sauvegarde écrite ailleurs, ni tant qu'un choix de conflit attend. Le `.json` et les photos
partent en un seul commit sur la branche par défaut, et une photo retirée de l'arbre quitte le dépôt (elle reste
dans son historique). Une photo déjà dans le dépôt n'est pas renvoyée : elle est reconnue à son contenu.
Les fichiers que Lignée a nommés dans le dossier des photos de la sauvegarde (`<nom>-<uuid>.jpg`) et
que l'arbre ne cite plus sont retirés aussi ; un fichier posé à la main dans ce dossier reste.

Avant d'envoyer sur une sauvegarde que ce navigateur n'a pas écrite, une fenêtre liste ce que l'arbre
ouvert changerait dans le dépôt (`repoPreview` dans `ui/repo-link.js`) : fiches ajoutées, fiches
seulement dans le dépôt, fiches différentes avec les champs concernés, unions, sources, photos
envoyées et retirées. « Fusionner » reprend d'abord dans l'arbre ouvert ce que seul le dépôt
contient (l'arbre ouvert l'emporte là où les deux diffèrent), puis envoie ; « Remplacer le dépôt »
envoie l'arbre tel quel.
Si le dépôt a changé depuis sa lecture, par exemple parce qu'une autre personne a sauvegardé entre-temps, Lignée relit
sa dernière version et fusionne champ par champ ([merge.js](../../js/services/merge.js)), en partant de la version
chargée. Un champ modifié d'un seul côté garde cette modification, et les ajouts et suppressions des deux côtés sont
conservés. La fusion entre dans l'arbre ouvert en une seule action, annulable avec Ctrl+Z, puis l'arbre part. Si un
même champ a été modifié différemment des deux côtés, ou si une fiche a été supprimée d'un côté et modifiée de l'autre,
rien n'est envoyé : le bandeau nomme ces fiches et demande de garder « Mes modifications » ou « Celles du dépôt ».

Le site retient le dépôt de chaque arbre, jamais le jeton : il reste en mémoire jusqu'à la fermeture de la page.
Après un rechargement, le bandeau propose de reconnecter l'arbre avec le jeton. Une importation avec « Charger le
dépôt » relie aussi l'arbre créé, ou vide avant l'import ; avec un jeton en lecture, le bandeau indique « Lecture seule ».
