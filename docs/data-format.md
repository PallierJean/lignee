# Format des données

[← Documentation technique](DEVELOPMENT.md)

Référence des objets qu'échangent l'application, le serveur local, les sauvegardes
`.json` et les dépôts GitHub. Où ces données sont rangées : [Stockage](storage.md).

Conventions des tableaux :

- **Type** : `string`, `number`, `boolean`, `null`, `Date` (texte libre, voir [Date](#date)),
  `Place` (texte, voir [Lieu](#lieu)), `Image` (voir [Image](#image)), `Id` (identifiant, voir
  plus bas) ; `T[]` est une liste de `T`.
- **Requis** : ✅ toujours présent ; vide sinon. Un champ absent vaut une valeur vide.
- **GEDCOM** : balise correspondante à l'export et à l'import. `_XXX` est une balise propre à
  Lignée, ignorée par les autres logiciels.

Identifiants : texte de 1 à 200 caractères parmi `A-Z a-z 0-9 _ - . ~ : @ +` (`p_…` pour une
personne, `u_…` pour une union, `S…` pour une source). Un objet à l'identifiant invalide est ignoré à l'import.

## Sauvegarde (`Backup`)

L'enveloppe d'une sauvegarde `.json` et d'un fichier de `data/arbres/`.

| Champ | Type | Requis | Description |
| --- | --- | --- | --- |
| `format` | `"lignee"` | ✅ | Reconnaît une sauvegarde Lignée ; sinon le fichier est refusé |
| `version` | `number` | ✅ | Version du format, actuellement `2` (`1` est lu et converti, voir [Format 1](#format-1)). Une sauvegarde d'une version plus récente est refusée (import, dépôt GitHub, mode fichier) : la lire ferait perdre ce que cette version ne connaît pas. En mode fichier, l'arbre s'ouvre vide et en lecture seule, et le serveur ne l'écrase pas ni ne supprime ses photos |
| `name` | `string` | | Nom de l'arbre |
| `createdAt` | `number` | | Création de l'arbre, en millisecondes depuis 1970 |
| `exportedAt` | `string` | | Date de l'export, ISO 8601 |
| `people` | [`Person[]`](#personne-person) | ✅ | Les personnes |
| `unions` | [`Union[]`](#union-union) | ✅ | Les unions |
| `sources` | [`Source[]`](#source-source) | | Les documents cités, chacun une seule fois (format 2) |

```json
{
  "format": "lignee",
  "version": 2,
  "name": "Famille Bertrand (exemple)",
  "exportedAt": "2026-10-28T08:00:00.000Z",
  "people": [ … ],
  "unions": [ … ],
  "sources": [ … ]
}
```

## Personne (`Person`)

| Champ | Type | Requis | Description | GEDCOM |
| --- | --- | --- | --- | --- |
| `id` | `Id` | ✅ | Identifiant unique dans l'arbre | `@I…@` |
| `given` | `string` | | Prénoms | `NAME`, `GIVN` |
| `surname` | `string` | | Nom d'usage | `NAME` (`TYPE married` si différent du nom de naissance) |
| `maidenName` | `string` | | Nom de jeune fille d'une femme | premier `NAME` ; `_MARNM` reconnu à l'import |
| `sex` | `"M"` \| `"F"` \| `""` | | Sexe ; vide si non précisé | `SEX` |
| `birthDate` | `Date` | | Naissance | `BIRT DATE` |
| `birthPlace` | `Place` | | Lieu de naissance | `BIRT PLAC` |
| `deathDate` | `Date` | | Décès | `DEAT DATE` |
| `deathPlace` | `Place` | | Lieu de décès | `DEAT PLAC` |
| `deceased` | `boolean` | | Décédé, même sans date connue | `DEAT Y` |
| `occupation` | `string` | | Profession (traduite à l'affichage si connue) | `OCCU` |
| `situation` | [`Situation`](#situation-familiale) | | Situation familiale | `_SITU` |
| `situationDate` | `Date` | | Date du mariage ou du pacs, pour ces deux situations | `_SITU DATE` |
| `notes` | `string` | | Notes libres | `NOTE` |
| `fatherId` | `Id` \| `null` | | Père | `FAMC` |
| `motherId` | `Id` \| `null` | | Mère | `FAMC` |
| `photo` | `Image` | | Portrait, 256 × 320 pixels | non exporté |
| `events` | [`Event[]`](#événement-event) | | Autres événements | voir Événement |
| `citations` | [`Citation[]`](#citation-citation) | | Actes cités : renvois vers les sources partagées | `SOUR` sous chaque fait |
| `media` | [`Media[]`](#galerie-media) | | Galerie d'images | non exporté |
| `createdAt` | `number` | | Création de la fiche, en millisecondes depuis 1970 | |
| `updatedAt` | `number` | | Dernière modification, en millisecondes depuis 1970 | |
| `example` | `boolean` | | Fiche de la famille d'exemple (retirée par « Retirer les exemples ») | |
| `tree` | `Id` | | Base en ligne seulement : arbre de la fiche | |

```json
{
  "id": "p_ex_07",
  "given": "Henri", "surname": "Bertrand", "maidenName": "", "sex": "M",
  "birthDate": "12/03/1932", "birthPlace": "Saint-Étienne (42)",
  "deathDate": "08/11/2004", "deathPlace": "Saint-Étienne (42)", "deceased": true,
  "occupation": "Ajusteur", "situation": "married", "situationDate": "1956", "notes": "",
  "fatherId": "p_ex_01", "motherId": "p_ex_02",
  "createdAt": 1793174000000, "updatedAt": 1793174000000
}
```

### Noms

`surname` est le nom d'usage. `maidenName` est le nom de jeune fille d'une femme
(facultatif) : affiché « DUPONT née FAURE » (sur les fiches de l'arbre, « née FAURE » passe
à la ligne sous le nom, à l'écran comme à l'impression), cherchable, et listé dans le registre
sous les deux noms. En GEDCOM, le nom de naissance est exporté en premier `NAME`,
le nom d'usage en second avec `TYPE married` ; à l'import, `_MARNM` est aussi reconnu.

### Situation familiale

| Valeur | Libellé |
| --- | --- |
| `single` | Célibataire |
| `cohabiting` | En concubinage |
| `pacs` | Pacsé(e) |
| `married` | Marié(e) |
| `remarried` | Remarié(e) |
| `separated` | Séparé(e) |
| `divorced` | Divorcé(e) |
| `widowed` | Veuf, veuve |

Dès qu'une personne a une union renseignée, la situation affichée suit sa dernière union : Veuve si
elle a pris fin par un décès ou si le conjoint est décédé, Divorcé, Séparée, Remarié à partir du
second mariage, En concubinage… Choisir Veuf, Divorcé ou Séparé marque la fin de la dernière union.
`situationDate` est la date ou l'année du mariage ou du pacs, saisie comme les autres dates ;
elle n'est demandée que pour ces deux situations. Le libellé s'accorde au sexe (« Mariée »).
En GEDCOM, elle est exportée dans une balise propre à Lignée, `_SITU` (avec `DATE`),
relue à l'import et ignorée par les autres logiciels.

## Union (`Union`)

| Champ | Type | Requis | Description | GEDCOM |
| --- | --- | --- | --- | --- |
| `id` | `Id` | ✅ | Identifiant unique dans l'arbre | `@F…@` |
| `a` | `Id` | ✅ | Premier conjoint | `HUSB` / `WIFE` |
| `b` | `Id` | ✅ | Second conjoint | `HUSB` / `WIFE` |
| `type` | `"married"` \| `"religious"` \| `"pacs"` \| `"cohabiting"` \| `"other"` | | Nature de l'union | `MARR TYPE` (libellé), `_UTYPE` (code) |
| `date` | `Date` | | Début | `MARR DATE` |
| `place` | `Place` | | Lieu | `MARR PLAC` |
| `end` | `"death"` \| `"divorce"` \| `"separation"` | | Comment elle a pris fin | `DIV`, sinon `_UEND` |
| `endDate` | `Date` | | Quand elle a pris fin | |
| `createdAt` | `number` | | Création, en millisecondes depuis 1970 | |
| `example` | `boolean` | | Union de la famille d'exemple | |

```json
{ "id": "u_ex_03", "a": "p_ex_05", "b": "p_ex_06", "type": "married", "date": "18/09/1956", "place": "Saint-Étienne (42)" }
```

Les enfants ne sont pas listés dans l'union : un enfant pointe vers ses parents par `fatherId`
et `motherId`.

`type` (facultatif) : `married`, `religious`, `pacs`, `cohabiting`, `other`. Si une union n'a pas
de type et que l'un des conjoints, dont c'est la dernière union, est indiqué Marié, Pacsé ou En
concubinage, le type en est déduit à l'affichage, et enregistré à la prochaine modification de sa fiche.
`end` (facultatif) dit comment l'union a pris fin : `death` (veuvage), `divorce`, `separation`, et `endDate`
quand. En GEDCOM : `DIV` pour un divorce, `_UEND` (propre à Lignée) pour les autres.

Une personne peut enchaîner autant d'unions que nécessaire, chacune avec son type, ses dates et ses
enfants. Avec plusieurs conjoints, la fiche propose « Ajouter un enfant avec… » pour chacun. Ni l'arbre
ni la fiche ne proposent d'ajouter un enfant à une personne qui a sûrement moins de 17 ans, aujourd'hui
ou à sa mort, ni un conjoint ou une union avant 15 ans, la majorité sexuelle (`isMinor`, `CHILD_AGE`,
`UNION_AGE`, d'après des dates certaines ; on se mariait jadis dès 15 ans). En GEDCOM : `TYPE` (libellé) et `_UTYPE` (code, propre à Lignée)
sous `MARR`. À l'import d'un autre logiciel, le type est déduit de `TYPE`, sinon laissé vide.

## Événement (`Event`)

| Champ | Type | Requis | Description |
| --- | --- | --- | --- |
| `id` | `Id` | ✅ | Identifiant, unique sur la fiche |
| `type` | voir ci-dessous | ✅ | Nature de l'événement |
| `label` | `string` | | Libellé, pour le type `other` |
| `date` | `Date` | | Date |
| `place` | `Place` | | Lieu |
| `note` | `string` | | Note |

| `type` | Événement | GEDCOM |
| --- | --- | --- |
| `baptism` | Baptême | `BAPM` (`CHR` reconnu à l'import) |
| `burial` | Inhumation | `BURI` |
| `cremation` | Crémation | `CREM` |
| `census` | Recensement | `CENS` |
| `residence` | Résidence | `RESI` |
| `occupation` | Profession | `OCCU` daté |
| `emigration` | Émigration | `EMIG` |
| `immigration` | Immigration | `IMMI` |
| `naturalization` | Naturalisation | `NATU` |
| `graduation` | Diplôme | `GRAD` |
| `retirement` | Retraite | `RETI` |
| `will` | Testament | `WILL` |
| `other` | Autre (avec `label`) | `EVEN` + `TYPE` |

Un baptême ou une inhumation reste un événement : il ne remplit pas la date de naissance ou de
décès. Une inhumation marque tout de même la personne comme décédée. Le champ Profession prend un
`OCCU` sans date, sinon le dernier daté ; les `OCCU` datés deviennent des événements.

## Source (`Source`)

Un document (acte, page de recensement, livret…), rangé une seule fois dans la liste `sources` de
la sauvegarde avec sa photo, et cité par une ou plusieurs fiches. Le modifier depuis une fiche le
modifie pour toutes celles qui le citent ; une source que plus personne ne cite est supprimée.
Dans le formulaire, « Ou citer un document déjà dans l'arbre » ajoute une citation d'une source existante.

| Champ | Type | Requis | Description | GEDCOM |
| --- | --- | --- | --- | --- |
| `id` | `Id` | ✅ | Identifiant, unique dans l'arbre | `@S…@` |
| `kind` | voir ci-dessous | | Nature de l'acte | `_KIND` |
| `title` | `string` | | Intitulé | `TITL` |
| `place` | `Place` | | Lieu de l'acte | `_PLAC` |
| `ref` | `string` | | Cote, numéro d'acte | `PAGE` |
| `note` | `string` | | Note | `NOTE` |
| `photo` | `Image` | | Document, 1400 pixels de côté au plus | non exporté |
| `back` | `Image` | | Verso du document (second côté d'un contrat de mariage, d'un acte) ; seulement avec `photo` | non exporté |

`kind` : `birth`, `baptism`, `marriage`, `death`, `burial`, `census`, `military`, `notary`,
`family`, `book`, `web`, `other`.

Les sources d'un mariage sont citées par la fiche d'un conjoint (ou des deux) et exportées sous `MARR`.

## Citation (`Citation`)

Le renvoi d'une fiche vers une source, avec le fait qu'elle appuie.

| Champ | Type | Requis | Description | GEDCOM |
| --- | --- | --- | --- | --- |
| `id` | `Id` | ✅ | Identifiant, unique sur la fiche | |
| `source` | `Id` | ✅ | La [source](#source-source) citée | `SOUR @S…@` |
| `fact` | `string` | | Fait appuyé : `birth`, `death`, l'`id` d'un événement, `union:<id d'union>`, ou vide pour toute la fiche | source citée sous ce fait |
| `role` | `"father"` \| `"mother"` \| `"spouse"` \| `"witness"` | | Rôle de la personne dans l'acte ; absent : la personne concernée | `EVEN` puis `ROLE` (`FATH`, `MOTH`, `SPOU`, `(Witness)`) |

```json
"people": [
  { "id": "p_1", "given": "Jean", "citations": [{ "id": "c_1", "source": "S_mariage", "fact": "union:u_1" }] },
  { "id": "p_2", "given": "Marie", "citations": [{ "id": "c_2", "source": "S_mariage", "fact": "union:u_1" }] }
],
"sources": [
  { "id": "S_mariage", "kind": "marriage", "title": "Acte de mariage", "place": "Lyon", "ref": "n°12", "photo": "photos/acte-….jpg" }
]
```

## Format 1

Avant Lignée 2.0, chaque fiche portait ses propres documents : `sources` était une liste de
sources complètes, chacune avec son `fact`. Lignée 2 lit toujours ce format, d'un fichier, du
navigateur, de la base en ligne ou d'un dépôt GitHub, et le convertit (`migratePeople` dans
`js/model/sources.js`) :

- chaque document devient une source, et la fiche garde une citation vers elle ;
- deux documents identiques qui ont un numéro d'acte (`ref`) ou une image deviennent une seule
  source partagée ; un document sans l'un ni l'autre (un acte pas encore trouvé) reste à part ;
- l'identifiant d'une source convertie vient de son contenu : convertir deux fois, ou depuis deux
  endroits à la fois, donne les mêmes sources.

En mode fichier, le serveur garde l'arbre tel qu'il était avant son premier enregistrement au format 2,
dans `data/arbres/<arbre>/avant-format-2.json` : écrit une seule fois, jamais écrasé, et absent de la
liste des arbres. Pour revenir en arrière, copiez-le à la place de `data/arbres/<arbre>.json`
(Lignée arrêtée). Les photos retirées des fiches après la migration ne sont plus dans le dossier.

L'export « Sauvegarde pour une version de Lignée antérieure à la 2.0 » écrit ce format 1 : chaque
fiche y reprend une copie des documents qu'elle cite. Une Lignée 1.31 ou plus récente refuse une
sauvegarde au format 2 plutôt que d'en perdre une partie.

## Galerie (`Media`)

| Champ | Type | Requis | Description |
| --- | --- | --- | --- |
| `id` | `Id` | ✅ | Identifiant, unique sur la fiche |
| `photo` | `Image` | ✅ | L'image |
| `back` | `Image` | | Verso de l'image (second côté d'un contrat, dos d'une photo annoté) ; les personnes s'identifient sur le recto |
| `title` | `string` | | Titre |
| `date` | `Date` | | Date |
| `note` | `string` | | Légende |
| `tags` | `Tag[]` | | Personnes identifiées sur l'image |

`Tag` : `{ "id": Id, "x": number, "y": number }`, la personne `id` repérée à `x` et `y` pour
cent de la largeur et de la hauteur de l'image.

Une image apparaît sur la fiche de sa propriétaire et sur celles des personnes identifiées. On
identifie quelqu'un en ouvrant la photo, en cliquant sur son visage puis en choisissant la
personne ; les personnes nommées dans la légende (titre et note : prénom et nom proches,
`peopleNamedIn`) sont proposées en premier, et chaque vignette porte le nombre de personnes
identifiées.

La galerie n'est pas exportée en GEDCOM ; la sauvegarde `.json` la conserve.

## Types communs

### Image

Une image est l'un ou l'autre :

- une **data URL** intégrée : `data:image/jpeg;base64,…` (sauvegarde `.json`, mode navigateur,
  base en ligne) ;
- une **référence** `photos/<fichier>` (`.jpg`, `.png`, `.webp` ou `.gif`), avec le serveur local :
  le fichier est dans `data/arbres/<id de l'arbre>/photos/` (voir
  [Stockage](storage.md#où-sont-les-données)).

**Portrait** (`photo` d'une personne) : il est choisi dans le formulaire puis recadré (`ui/crop.js`) : la photo glisse et se zoome
derrière un cadre portrait 4:5, et seule la partie cadrée est gardée, en 256 × 320 pixels (quelques
dizaines de Ko). Il est affiché en haut de la fiche, cadrée vers le haut (le visage) quand une
photo plus ancienne n'a pas ces proportions. Sans photo, la fiche montre
`images/avatar_femme.jpeg` ou `images/avatar_homme.jpeg` selon le sexe
(`images/avatar_neutre.jpeg` s'il n'est pas précisé).

Les images ne sont pas exportées en GEDCOM ; la sauvegarde `.json` les intègre en data URL.

### Date

Les dates sont saisies librement : `12/03/1932`, `03/1932`, `1932`, `12 mars 1932`, `Mars 1932`,
`vers 1850`, `avant 1901`, `après 1790`. Le mois en toutes lettres se lit en français ou en anglais,
sans tenir compte de la casse ni des accents. Elles restent enregistrées telles que saisies et
s'affichent au format `04 Août 1961`. Ce qui n'est pas reconnu (`Javier 1950`, `19/29 Octobre 1861`)
reste du texte libre, affiché tel quel et ignoré par les calculs. L'export GEDCOM les convertit
(`12 MAR 1932`, `ABT 1850`…).

### Lieu

Les lieux (`birthPlace`, `deathPlace`, lieu d'un événement ou d'une union) restent un texte, au
format « Lieu-dit, Ville (Département), Pays » : `Roussely, Orgnac-sur-Vézère (19)`,
`Bruxelles, Belgique`. Le pays n'est écrit que hors de France : un lieu sans pays est en France,
et le champ Pays affiche « France » par défaut. Un pays connu (`model/countries.js`, en français ou
en anglais) est enregistré en français ; à l'étranger, le département n'est ni déduit ni contrôlé,
et la carte cherche un lieu sans pays en France. La carte ne place que des communes : les lieux-dits
y sont réunis à leur commune (« Bourg, Masseret (19) » -> « Masseret (19) »). Elle s'explore
(`ui/places.js`) : zoom par les boutons ou la molette, déplacement en la faisant glisser, recadrage
sur un département ; un clic sur une commune liste ses personnes et met ses migrations en évidence.
Le formulaire les saisit en quatre champs
(ville, pays, lieu-dit, département) et recompose ce texte (`model/places.js`) ;
sous le département, le nom suit le numéro saisi (« 19 » : Corrèze, `model/departments.js`).
La ville prime : quand elle n'existe que dans un département, celui-ci est rempli ou corrigé en
quittant le champ ; la cohérence et la vue Lieux signalent un département contraire à la ville, et
la vue Lieux propose le lieu corrigé. La liste des communes (actuelles, déléguées et associées, avec
leur département) est `js/data/communes.js`, chargée après l'ouverture et sans rien envoyer en ligne.
Elle se régénère depuis le Code officiel géographique de l'INSEE (licence ouverte) :
`node scripts/build-communes.mjs v_commune_<année>.csv v_mvt_commune_<année>.csv`. Le second
fichier (événements depuis 1943) produit aussi `js/data/commune-changes.js` : chaque ancienne commune
(fusionnée, devenue déléguée, renommée) et la commune qui garde ses registres aujourd'hui ;
le GEDCOM, la carte et la recherche le lisent tel quel.
