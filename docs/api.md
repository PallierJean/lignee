# API du serveur local

[← Documentation technique](DEVELOPMENT.md)

`server.js` (lancé par `npm start`) sert l'application et expose une petite API REST en JSON.
Elle n'est utilisée que par l'application elle-même, sur `http://localhost:8000`.

- **Accès** : depuis cet ordinateur seulement. Les requêtes dont l'en-tête `Host` n'est pas
  local, ou dont l'`Origin` est un autre site, reçoivent `403` (voir [Sécurité](security.md)).
- **Corps** : JSON en UTF-8, 20 Mo au plus (`413` au-delà).
- **Erreurs** : code HTTP et message en texte brut (en français), par exemple
  `400 JSON illisible`. Une erreur inattendue répond `500`.
- **Identifiant d'arbre** (`:id`) : 1 à 64 caractères parmi `A-Z a-z 0-9 _ -`, sinon `400`.

Types des objets : [Format des données](data-format.md).

## Résumé

| Méthode | Chemin | Rôle | Réponse |
| --- | --- | --- | --- |
| `GET` | `/api/trees` | Liste des arbres | `200` `TreeSummary[]` |
| `GET` | `/api/trees/:id` | Contenu d'un arbre | `200` `Backup` + `ETag` |
| `PUT` | `/api/trees/:id` | Crée ou remplace un arbre | `204` + `ETag` |
| `DELETE` | `/api/trees/:id` | Supprime un arbre et ses photos | `204` |
| `POST` | `/api/trees/:id/photos` | Enregistre une photo | `201` `{ photo }` |
| `POST` | `/api/trees/:id/photos/sweep` | Supprime les photos inutilisées | `204` |
| `GET` | `/api/trees/:id/photos/:file` | Une photo | `200` image |
| `GET` | `/api/insee` | Cherche une personne dans le fichier des décès | `200` `Death[]` |
| `GET` | `/api/insee/status` | État de la connexion à matchID | `200` `InseeStatus` |
| `POST` | `/api/insee/register` | Demande un code de connexion à matchID | `200` `{ sent }` |
| `POST` | `/api/insee/auth` | Se connecte à matchID avec le code | `200` `InseeStatus` |

Une autre méthode sur un chemin connu répond `405`, un sous-chemin inconnu de `/api/trees/:id` `404`.

## Arbres

### `GET /api/trees`

Liste des arbres de `data/arbres/`, du plus ancien au plus récent. Un fichier illisible est
ignoré.

```json
[
  { "id": "principal", "name": "Famille Durand", "count": 128, "createdAt": 1793174000000 }
]
```

| Champ | Type | Description |
| --- | --- | --- |
| `id` | `string` | Identifiant, nom du fichier sans `.json` |
| `name` | `string` | Nom de l'arbre (l'identifiant à défaut) |
| `count` | `number` | Nombre de personnes |
| `createdAt` | `number` | Création, en millisecondes depuis 1970 (`0` si inconnue) |

### `GET /api/trees/:id`

Le fichier de l'arbre tel qu'il est enregistré : une [sauvegarde](data-format.md#sauvegarde-backup).
L'en-tête `ETag` donne sa version, à renvoyer à l'enregistrement.

| Code | Cas |
| --- | --- |
| `200` | L'arbre |
| `404` | L'arbre n'existe pas encore |

### `PUT /api/trees/:id`

Crée ou remplace l'arbre. Corps : une [sauvegarde](data-format.md#sauvegarde-backup) complète.
L'écriture est atomique : un arbre n'est jamais à moitié écrit.

| En-tête ou paramètre | Rôle |
| --- | --- |
| `If-Match: <ETag>` | Facultatif. Refuse l'écriture si l'arbre a changé depuis cette version |
| `?keepPhotos=1` | Garde les photos que l'arbre n'utilise plus (l'action peut encore être annulée) ; sans lui, elles sont supprimées |

| Code | Cas |
| --- | --- |
| `204` | Enregistré ; `ETag` donne la nouvelle version |
| `400` | JSON illisible, ou pas une sauvegarde Lignée (`format`, `people` et `unions` requis) |
| `409` | L'arbre a changé entre-temps (`If-Match` différent) : rien n'est écrit |

### `DELETE /api/trees/:id`

Supprime le fichier de l'arbre et le dossier de ses photos. Répond `204`, même si l'arbre
n'existait pas.

## Photos

### `POST /api/trees/:id/photos`

Enregistre une image dans `data/arbres/:id/photos/`.

```json
{ "label": "DURAND-Henri", "data": "data:image/jpeg;base64,/9j/4AAQ…" }
```

| Champ | Type | Description |
| --- | --- | --- |
| `label` | `string` | Début du nom du fichier (nettoyé ; `photo` à défaut) |
| `data` | `string` | Data URL `image/jpeg`, `image/png`, `image/webp` ou `image/gif` |

Réponse `201` : la référence à mettre dans le champ `photo` de la fiche.

```json
{ "photo": "photos/DURAND-Henri-3f4b2f4e-35f4-4208-9385-3e68594989fd.jpg" }
```

`400` si le JSON est illisible ou si `data` n'est pas une image.

### `POST /api/trees/:id/photos/sweep`

Supprime les photos du dossier que l'arbre enregistré ne cite plus (portraits, documents des
sources, galerie). Ne touche à rien si l'arbre est illisible. Répond `204`.

### `GET /api/trees/:id/photos/:file`

Le fichier image, avec son type (`image/jpeg`…). `400` si le nom n'est pas celui d'une photo,
`404` si elle n'existe pas.

## Fichier des décès (INSEE)

Relais vers [matchID](https://deces.matchid.io), qui publie le fichier des décès de l'INSEE
(décès en France depuis 1970). matchID n'accepte pas les appels directs d'une page web : le
serveur les fait à sa place. Seuls les quatre champs ci-dessous partent.

### `GET /api/insee`

| Paramètre | Requis | Format |
| --- | --- | --- |
| `lastName` | ✅ | Lettres, espaces, `'` et `-`, 60 caractères au plus |
| `firstName` | | Idem |
| `sex` | | `M` ou `F` |
| `birthDate` | | `JJ/MM/AAAA`, `AAAA` ou `AAAA-AAAA` |

Réponse `200` : les actes trouvés (`Death[]`).

```json
[
  {
    "first": ["Henri", "Louis"], "last": "BERTRAND", "sex": "M",
    "birthDate": "19320312", "birth": { "city": "Saint-Étienne", "dept": "42", "country": "France" },
    "deathDate": "20041108", "death": { "city": "Saint-Étienne", "dept": "42", "country": "France" },
    "certificate": "163"
  }
]
```

| Code | Cas |
| --- | --- |
| `400` | Paramètre invalide, ou `lastName` manquant |
| `401` | `{ "error": "login" }` : matchID demande une connexion |
| `502` | matchID indisponible ou en erreur |

### `GET /api/insee/status`

```json
{ "connected": true, "user": "vous@exemple.fr", "expires": "2026-12-09T10:00:00.000Z" }
```

Hors connexion : `{ "connected": false, "user": "", "expires": "" }`.

### `POST /api/insee/register`

Corps `{ "email": "vous@exemple.fr" }`. matchID envoie un code à cette adresse. Réponse
`{ "sent": true }` ; `400` si l'adresse est invalide.

### `POST /api/insee/auth`

Corps `{ "email": "vous@exemple.fr", "code": "…" }`. Garde le jeton dans `data/matchid.json`
et répond comme `/api/insee/status`. `400` si l'adresse ou le code est invalide.
