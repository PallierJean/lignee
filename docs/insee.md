# Relais vers le fichier des décès (INSEE)

[← Documentation technique](DEVELOPMENT.md)

La vue INSEE de l'onglet Analyse (voir [Onglet Analyse](features/analysis.md)) compare les fiches
au fichier des décès de l'INSEE, que publie [matchID](https://deces.matchid.io). matchID
n'accepte pas les appels directs d'une page web (pas d'en-têtes CORS) : le serveur local
(`server.js`, lancé par `npm start`) les fait à sa place, par les quatre routes ci-dessous. Sur
le site GitHub Pages, qui n'a pas de serveur, cette vue n'est donc pas disponible.

- **Accès** : depuis cet ordinateur seulement. Une requête dont l'en-tête `Host` n'est pas local,
  ou dont l'`Origin` est un autre site, reçoit `403` (voir [Sécurité](security.md)).
- **Données envoyées** : seuls le nom de naissance, le premier prénom, le sexe et la date de
  naissance partent vers matchID, et l'adresse e-mail pour s'inscrire.
- **Jeton matchID** : gardé par le serveur dans `data/matchid.json` (ignoré par Git, jamais servi
  aux pages), renouvelé la veille de son expiration.
- **Erreurs** : code HTTP et message en texte brut (en français), par exemple
  `400 Nom manquant`.

| Méthode | Chemin | Rôle | Réponse |
| --- | --- | --- | --- |
| `GET` | `/api/insee` | Cherche une personne dans le fichier des décès | `200` `Death[]` |
| `GET` | `/api/insee/status` | État de la connexion à matchID | `200` `InseeStatus` |
| `POST` | `/api/insee/register` | Demande un code de connexion à matchID | `200` `{ sent }` |
| `POST` | `/api/insee/auth` | Se connecte à matchID avec le code reçu | `200` `InseeStatus` |

## `GET /api/insee`

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

| Champ | Type | Description |
| --- | --- | --- |
| `first` | `string[]` | Prénoms de l'état civil, sans accents |
| `last` | `string` | Nom de naissance, en majuscules sans accents |
| `sex` | `string` | `M` ou `F` |
| `birthDate`, `deathDate` | `string` | Dates au format `AAAAMMJJ` |
| `birth`, `death` | `{ city, dept, country }` | Lieux : commune, numéro de département, pays |
| `certificate` | `string` | Numéro de l'acte de décès |

Le fichier couvre les décès survenus en France depuis 1970. Le rapprochement avec les fiches
(acte « certain », « probable » ou simple piste) se fait ensuite dans l'application
(`js/model/insee.js`).

| Code | Cas |
| --- | --- |
| `400` | Paramètre invalide, ou `lastName` manquant |
| `401` | `{ "error": "login" }` : matchID demande une connexion |
| `502` | matchID indisponible ou en erreur |

## `GET /api/insee/status`

```json
{ "connected": true, "user": "vous@exemple.fr", "expires": "2026-12-09T10:00:00.000Z" }
```

Hors connexion : `{ "connected": false, "user": "", "expires": "" }`.

## `POST /api/insee/register`

Corps `{ "email": "vous@exemple.fr" }`. matchID envoie un code à cette adresse. Réponse
`{ "sent": true }` ; `400` si l'adresse est invalide.

## `POST /api/insee/auth`

Corps `{ "email": "vous@exemple.fr", "code": "…" }`. Garde le jeton dans `data/matchid.json`
et répond comme `/api/insee/status`. `400` si l'adresse ou le code est invalide.
