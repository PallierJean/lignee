# Garder son arbre sur GitHub

[← README](../README.md)

Dans la version en ligne, votre arbre ne vit que dans votre navigateur. En le reliant à
**GitHub**, un service gratuit de stockage de fichiers, vous en gardez une copie en lieu sûr, avec
ses photos, et vous le retrouvez depuis n'importe quel ordinateur.

Ce guide part de zéro. Vous allez :

1. créer un compte GitHub ;
2. créer un **dépôt** privé, le dossier en ligne qui contiendra votre arbre ;
3. y déposer la famille d'exemple, pour essayer ;
4. créer un **jeton**, la clé qui permet à Lignée d'écrire dans ce dépôt, et seulement dans
   celui-là ;
5. relier Lignée au dépôt et sauvegarder.

Comptez un quart d'heure. Tout est gratuit.

## 1. Créer un compte GitHub

1. Allez sur <https://github.com/signup>.
2. Saisissez votre adresse e-mail, un mot de passe et un nom d'utilisateur (il apparaîtra dans
   l'adresse de vos dépôts : `https://github.com/votre-nom/...`).
3. Résolvez la petite vérification, puis saisissez le code reçu par e-mail.
4. Si GitHub vous propose une offre payante, choisissez l'offre gratuite (**Free**) : elle
   suffit.

## 2. Créer un dépôt privé

1. Une fois connecté, cliquez sur le **+** en haut à droite, puis sur **New repository**.
2. **Repository name** : un nom sans espace, par exemple `ma-famille`.
3. Cochez **Private** : vous seul pourrez voir votre arbre. C'est important, il contient des
   informations sur des personnes vivantes.
4. Laissez le reste tel quel et cliquez sur **Create repository**.

Notez l'adresse du dépôt, affichée dans la barre du navigateur :
`https://github.com/votre-nom/ma-famille`.

## 3. Déposer la famille d'exemple

Pour essayer sans risque, commencez avec la famille Bertrand, une famille fictive.

1. Téléchargez son fichier :
   <https://pallierjean.github.io/lignee/data/arbres/exemple-famille-bertrand.json>
   (clic droit sur le lien, puis « Enregistrer la cible du lien sous… »).
2. Sur la page de votre dépôt, cliquez sur le lien **uploading an existing file** (ou, si le dépôt
   n'est plus vide, sur **Add file** puis **Upload files**).
3. Faites glisser le fichier téléchargé dans la page.
4. Cliquez sur le bouton vert **Commit changes**.

Le fichier apparaît dans la liste du dépôt.

> Pour sauvegarder directement votre propre arbre, sautez cette étape : un dépôt vide convient,
> Lignée y enverra votre arbre.

## 4. Créer un jeton d'accès

Le jeton est une clé que vous donnez à Lignée. Vous le limitez à un seul dépôt : même perdu, il
n'ouvre rien d'autre.

1. Ouvrez <https://github.com/settings/personal-access-tokens/new> (ou : photo de profil en haut à
   droite, **Settings**, **Developer settings**, **Personal access tokens**,
   **Fine-grained tokens**, **Generate new token**).
2. **Token name** : par exemple `Lignée`.
3. **Expiration** : une durée, par exemple 90 jours. À l'échéance, il suffira d'en créer un autre.
4. **Repository access** : choisissez **Only select repositories**, puis votre dépôt
   `ma-famille`.
5. **Permissions** : cliquez sur **Add permissions** (ou ouvrez **Repository permissions**),
   choisissez **Contents**, puis réglez-le sur **Read and write**.
6. Cliquez sur **Generate token** en bas de la page.
7. **Copiez le jeton tout de suite** (il commence par `github_pat_`) : GitHub ne l'affichera plus.
   Gardez-le dans un gestionnaire de mots de passe.

Ne communiquez jamais ce jeton : il permet de modifier votre dépôt. Lignée ne l'enregistre pas,
il reste en mémoire jusqu'à la fermeture de la page.

## 5. Relier Lignée au dépôt

1. Ouvrez Lignée : <https://pallierjean.github.io/lignee/>.
2. Cliquez sur **Importer** dans l'en-tête, puis allez à la partie **Depuis un dépôt GitHub**.
3. **Adresse du dépôt** : collez `https://github.com/votre-nom/ma-famille`.
4. **Jeton** : collez votre jeton.
5. Cliquez sur **Connecter le dépôt**.

Lignée trouve la famille d'exemple dans le dépôt et propose de l'ouvrir : cliquez sur
**Créer un nouvel arbre**. L'arbre s'ouvre, déjà relié au dépôt. Un bandeau
**ATTENTION : LECTURE ET ÉCRITURE** le rappelle.

Avec un dépôt vide, Lignée relie directement l'arbre ouvert.

## 6. Sauvegarder

Modifiez l'arbre comme d'habitude : ajoutez une personne, une photo… Avec un jeton en écriture,
**chaque modification part sur GitHub toute seule**, quelques instants après l'avoir enregistrée :
une fiche, une suppression, une fusion, un import, une annulation. Plusieurs modifications
rapprochées font une seule sauvegarde, dont le message dit ce qui a changé. L'arbre et ses photos
partent ensemble.

Il n'y a donc pas de bouton à cliquer. Le bouton **Sauvegarder sur GitHub** n'apparaît que la
toute première fois, si le dépôt contient une sauvegarde écrite ailleurs : une fenêtre montre ce qui
changerait, et vous choisissez de fusionner ou de remplacer. Si un envoi échoue (connexion coupée),
la modification reste dans l'arbre et repart avec la suivante, ou avec le bouton **Réessayer
l'envoi** qui apparaît alors.

Sur GitHub, le dépôt garde l'historique de chaque sauvegarde : vous pouvez revenir à une version
précédente.

**À plusieurs sur le même arbre.** Invitez vos proches sur le dépôt : chacun crée son propre jeton.
Si quelqu'un a sauvegardé depuis que vous avez chargé l'arbre, Lignée reprend ses modifications
avant d'envoyer les vôtres. Si vous avez changé tous les deux la même information d'une fiche,
le bandeau vous demande laquelle garder.

## Les fois suivantes

Lignée retient à quel dépôt chaque arbre est relié, mais jamais le jeton. Après avoir rechargé
la page, le bandeau indique « Cet arbre est relié au dépôt… » : collez votre jeton et cliquez sur
**Reconnecter**.

Sur un autre ordinateur, refaites l'étape 5 : Lignée ouvre la dernière sauvegarde du dépôt.

## En cas de problème

| Message | Que faire |
| --- | --- |
| « GitHub refuse ce jeton : il est incorrect ou expiré » | Vérifiez que le jeton est copié en entier, ou créez-en un nouveau (étape 4) |
| « GitHub refuse l'accès… » | Le jeton n'a pas accès à ce dépôt, ou pas en écriture : revoyez **Repository access** et **Contents** |
| Bandeau « Lecture seule » | Le jeton n'a que la lecture : réglez **Contents** sur **Read and write** |
| « Le dépôt a changé depuis son chargement » | Le dépôt a encore changé pendant la fusion, plusieurs fois de suite. Réessayez dans un instant, ou rechargez-le |

Pour les détails techniques (dispositions de fichiers acceptées, conflits), voir
[GitHub](features/github.md).
