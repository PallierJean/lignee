# Sécurité

[← Documentation technique](DEVELOPMENT.md)

Lignée garde des données de famille : noms, dates, lieux, photos. Sa sécurité repose sur une
règle simple : **ces données restent chez l'utilisateur**, et rien ne part sur Internet sans
un clic de sa part.

## Ce dont on se protège

| Menace | Protection |
| --- | --- |
| Un site ouvert dans un autre onglet lit ou modifie les arbres par le serveur local | Serveur limité à cet ordinateur, contrôle des en-têtes `Host` et `Origin` |
| Un fichier privé du projet est servi (`.git`, jetons, arbres) | Liste blanche des fichiers servis |
| Un texte saisi ou importé (GEDCOM, sauvegarde, dépôt GitHub) exécute du code | Échappement du HTML, politique de sécurité du contenu |
| Un autre site affiche Lignée dans un cadre pour piéger les clics | `frame-ancestors 'none'`, refus de démarrer dans un cadre |
| Deux onglets s'écrasent mutuellement | Version de l'arbre vérifiée à chaque enregistrement |
| Un jeton ou un arbre personnel se retrouve dans le dépôt public | `.gitignore`, jetons jamais enregistrés par la page |

Hors périmètre : Lignée n'a **pas de comptes ni de mots de passe**. Quiconque accède au serveur
local ou au navigateur accède aux arbres. Ne l'exposez pas sur un réseau.

## Serveur local (`server.js`)

- **N'écoute que sur `127.0.0.1`** : les autres machines du réseau ne le voient pas.
- **Contrôle de l'en-tête `Host`** (`localhost`, `127.0.0.1` ou `[::1]` seulement) : bloque le
  « DNS rebinding », par lequel un site piégé se ferait passer pour `localhost` afin de lire les
  arbres.
- **Contrôle de l'en-tête `Origin`** : une requête envoyée par un autre site est refusée, ce qui
  empêche d'écrire des fichiers à distance.
- **Liste blanche des fichiers servis** : `index.html`, `package.json`, `assets/`, `css/`,
  `images/`, `js/` et la famille d'exemple. Tout le reste (`.git`, `.env.test`,
  `data/matchid.json`, chemins qui sortent du projet) répond 403. Les arbres ne passent que par
  l'API `/api/trees`.
- **Noms de fichiers nettoyés** (`safeName`) : un nom d'arbre ou de personne ne peut pas créer
  de chemin (`/`, `\`, `..` et caractères interdits retirés). Seules les références de la forme
  `photos/<fichier>.jpg|png|webp|gif` sont acceptées pour les images.
- **Taille des envois limitée** à 20 Mo (réponse 413 au-delà).
- **Lecture des écritures** (`htr.js`) : le serveur lance le programme `kraken` installé sur
  l'ordinateur, sans passer par un shell, sur une photo de l'arbre désignée par son nom vérifié
  (`photos/<fichier>`) ; une lecture à la fois, arrêtée au bout de dix minutes. Rien ne sort sur
  Internet.
- **Commandes à la voix** (`voice.js`) : l'enregistrement (un WAV vérifié, 20 Mo au plus) est
  écrit dans un dossier temporaire supprimé aussitôt et passé au programme Whisper de l'ordinateur,
  lancé sans shell ; la phrase va à Ollama, sur l'ordinateur (`127.0.0.1`). Rien ne sort sur
  Internet. Le micro n'est ouvert que pendant l'écoute, après un clic ou la touche M.
- **Pas d'écrasement silencieux** : chaque arbre a une version (empreinte SHA-256, en-tête
  `ETag`). Un enregistrement envoie la version reçue au chargement (`If-Match`) ; si l'arbre a
  changé entre-temps (autre onglet, fichier modifié à la main), il est refusé (409) et un message
  demande de recharger.

## Politique de sécurité du contenu (CSP)

Envoyée par `server.js` dans un en-tête, et ajoutée dans la page du site GitHub Pages par
`scripts/build-site.sh` :

| Directive | Effet |
| --- | --- |
| `default-src 'self'`, `script-src 'self'`, `style-src 'self'`, `font-src 'self'` | Seuls les fichiers de l'application se chargent : pas de script, de style ni de police d'un autre site |
| `img-src 'self' data: blob:` | Images de l'application et photos intégrées à l'arbre |
| `connect-src` | Seulement l'application, OpenStreetMap (Nominatim), l'annuaire de service-public.fr et GitHub (`api.github.com`, `raw.githubusercontent.com`) |
| `object-src 'none'`, `base-uri 'none'`, `form-action 'none'` | Ni plugin, ni changement de l'adresse de base, ni envoi de formulaire |
| `frame-ancestors 'none'` | Aucun site ne peut afficher Lignée dans un cadre (serveur local seulement) |

Une balise `<meta>` ne peut pas porter `frame-ancestors` : sur GitHub Pages, `js/main.js` refuse
donc de démarrer dans le cadre d'un autre site et propose de l'ouvrir dans un onglet. Le serveur envoie aussi
`Referrer-Policy: no-referrer`.

## Textes saisis et fichiers importés

Tout ce qui vient de l'utilisateur ou d'un fichier importé (noms, notes, lieux, titres, contenu
GEDCOM ou JSON) est échappé par `esc()` (`js/utils/dom.js`) avant d'entrer dans le HTML. Toute
nouvelle insertion de HTML doit faire de même ; la CSP, qui interdit les scripts en ligne, est
une seconde barrière, pas la première.

`test/xss.test.js` remplit chaque champ d'une fiche, d'une union, d'un événement, d'une source,
d'une image et le nom de l'arbre avec du HTML piégé, puis vérifie qu'il reste du texte dans
l'arbre, la roue, la fiche, le registre, chaque vue de l'onglet Analyse, la fiche en fenêtre et la
visionneuse.

## Ce qui sort sur Internet

L'ouverture de l'application ne contacte aucun service tiers : les polices sont dans
`assets/fonts/`. Les seules sorties ont lieu sur un clic :

| Action | Destination | Ce qui part |
| --- | --- | --- |
| « Localiser », sur la carte | OpenStreetMap (Nominatim), une requête par seconde | Les noms de lieux, et eux seuls |
| « Vérifier », vue INSEE (`npm start` seulement) | matchID, par le serveur local (`GET /api/insee`) | Nom de naissance, premier prénom, sexe, date de naissance ; l'adresse e-mail pour s'inscrire |
| « Trouver la mairie », vue Actes | Annuaire de service-public.fr (`api-lannuaire.service-public.fr`) | Le nom de la commune et son numéro de département |
| Import ou sauvegarde GitHub | `api.github.com`, `raw.githubusercontent.com` | Le jeton ; l'arbre et ses photos à la sauvegarde |

## Secrets

| Secret | Où il vit |
| --- | --- |
| Jeton GitHub de l'utilisateur | En mémoire uniquement, jusqu'à la fermeture de la page ; jamais enregistré, envoyé seulement à `api.github.com` |
| Jeton matchID | `data/matchid.json`, droits `600`, ignoré par Git, jamais servi aux pages ; renouvelé la veille de son expiration |
| Jetons des tests GitHub | `.env.test`, ignoré par Git ; à limiter au seul dépôt de test |

Le dépôt est public : aucun jeton, aucun arbre réel ne doit y entrer. `.gitignore` exclut
`data/arbres/` (sauf la famille d'exemple, fictive), `data/matchid.json` et `.env.test`.

## Données dans le navigateur

En mode navigateur (site GitHub Pages ou autre serveur), les arbres sont dans le `localStorage`
de ce navigateur, sans chiffrement : toute personne qui utilise la même session y a accès.
Effacer les données du site efface l'arbre ; d'où le conseil d'exporter une sauvegarde.

Sur GitHub Pages, cette mémoire appartient à l'adresse `https://pallierjean.github.io`, commune à
tous les sites GitHub Pages du compte `PallierJean`. Lignée est aujourd'hui le seul : un autre
site publié plus tard sous ce compte pourrait lire les arbres gardés par les visiteurs. Pour en
publier un, utilisez un autre compte ou un domaine personnalisé.

## Dépendances

Aucune dépendance npm : pas de risque venant d'un paquet tiers dans l'application.

Les coordonnées obtenues d'OpenStreetMap sont sous licence ODbL : la carte affiche la mention
« © les contributeurs d'OpenStreetMap » exigée par cette licence. Les outils
de la CI (actions GitHub, outils de version) sont figés sur une version exacte et mis à jour
par Renovate (voir [Mises à jour](updates.md)). La CI n'a que la permission de lire le dépôt,
sauf les étapes de publication (version et site).

## Signaler une faille

Ne publiez pas une faille dans une issue publique. Utilisez le signalement privé de GitHub :
onglet **Security** du dépôt, puis **Report a vulnerability**.

## Pour les contributeurs

- Une nouvelle route du serveur passe par `allowed()` et ne sert jamais un fichier hors de la
  liste blanche.
- Un nouveau service en ligne s'ajoute à `connect-src` dans `server.js` **et**
  `scripts/build-site.sh`, part seulement sur un clic, et s'ajoute au tableau
  « Ce qui sort sur Internet ».
- Pas de `innerHTML` avec une donnée non échappée, pas de `eval`, pas de script en ligne.
- Les tests du serveur (`test/server.test.js`) couvrent les chemins refusés : ajoutez-y chaque
  nouveau cas.
