# Format des données

[← Documentation technique](DEVELOPMENT.md)

Une sauvegarde `.json`, un fichier de `data/arbres/` et un enregistrement de la base en ligne
contiennent les mêmes objets : des **personnes** et des **unions**. Où ces fichiers sont rangés :
voir [Stockage](storage.md). Correspondance avec GEDCOM : indiquée champ par champ ci-dessous.

## Personne

```json
{
  "given": "Henri", "surname": "Bertrand", "maidenName": "", "sex": "M",
  "birthDate": "12/03/1932", "birthPlace": "Saint-Étienne",
  "deathDate": "08/11/2004", "deathPlace": "Saint-Étienne", "deceased": true,
  "occupation": "Ajusteur", "situation": "married", "situationDate": "1956", "notes": "",
  "fatherId": "p_ex_01", "motherId": "p_ex_02",
  "createdAt": 1793174000000, "updatedAt": 1793174000000
}
```

## Photo

`photo` (facultatif) est une image JPEG intégrée en data URL (`data:image/jpeg;base64,…`),
ou, avec `server.js`, une référence `photos/<fichier>` (voir [Stockage](storage.md#où-sont-les-données)).
Elle est choisie dans le formulaire puis recadrée (`ui/crop.js`) : la photo glisse et se zoome
derrière un cadre portrait 4:5, et seule la partie cadrée est gardée, en 256 × 320 pixels (quelques
dizaines de Ko). Elle est affichée en haut de la fiche, cadrée vers le haut (le visage) quand une
photo plus ancienne n'a pas ces proportions. Sans photo, la fiche montre
`images/avatar_femme.jpeg` ou `images/avatar_homme.jpeg` selon le sexe
(`images/avatar_neutre.jpeg` s'il n'est pas précisé). Elle n'est pas exportée en GEDCOM ;
la sauvegarde .json la conserve.

## Lieux

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
`node scripts/build-communes.mjs v_commune_<année>.csv` ;
le GEDCOM, la carte et la recherche le lisent tel quel.

## Noms

`surname` est le nom d'usage. `maidenName` est le nom de jeune fille d'une femme
(facultatif) : affiché « DUPONT née FAURE » (sur les fiches de l'arbre, « née FAURE » passe
à la ligne sous le nom, à l'écran comme à l'impression), cherchable, et listé dans le registre
sous les deux noms. En GEDCOM, le nom de naissance est exporté en premier `NAME`,
le nom d'usage en second avec `TYPE married` ; à l'import, `_MARNM` est aussi reconnu.

## Événements

`events` (facultatif) liste les autres événements : `{ "id", "type", "date", "place", "note" }`.
Types : `baptism`, `burial`, `cremation`, `census`, `residence`, `occupation`, `emigration`,
`immigration`, `naturalization`, `graduation`, `retirement`, `will`, `other` (avec `label`).
En GEDCOM : `BAPM`, `BURI`, `CREM`, `CENS`, `RESI`, `OCCU`, `EMIG`, `IMMI`, `NATU`, `GRAD`, `RETI`,
`WILL`, `EVEN` + `TYPE`. À l'import, `CHR` devient un baptême. Un baptême ou une inhumation
reste un événement : il ne remplit plus la date de naissance ou de décès. Une inhumation
marque tout de même la personne comme décédée. Le champ Profession prend un `OCCU` sans date,
sinon le dernier daté ; les `OCCU` datés deviennent des événements.

## Sources

`sources` (facultatif) liste les actes cités :
`{ "id", "fact", "kind", "title", "place", "ref", "note", "photo" }`. `fact` indique le fait
appuyé : `birth`, `death`, l'`id` d'un événement, `union:<id d'union>`, ou vide pour toute la
fiche. `kind` : `birth`, `baptism`, `marriage`, `death`, `burial`, `census`, `military`, `notary`,
`family`, `book`, `web`, `other`. `photo` est le document (1400 pixels de côté au plus). En GEDCOM, chaque
source est une fiche `SOUR` (avec les balises propres à Lignée `_KIND` et `_PLAC`), citée sous le
fait avec `PAGE` (cote) et `NOTE`. Les sources d'un mariage sont gardées sur la fiche d'un
conjoint et exportées sous `MARR`. Les documents ne sont pas exportés en GEDCOM.

## Galerie

`media` (facultatif) est la galerie :
`{ "id", "photo", "title", "date", "note", "tags": [{ "id", "x", "y" }] }`. `tags` : personnes
identifiées, à `x` et `y` pour cent de l'image. Une image apparaît sur la fiche de sa
propriétaire et sur celles des personnes identifiées. On identifie quelqu'un en ouvrant la photo,
en cliquant sur son visage puis en choisissant la personne ; les personnes nommées dans la légende
(titre et note : prénom et nom proches, `peopleNamedIn`) sont proposées en premier, et chaque
vignette porte le nombre de personnes identifiées. Elle n'est pas exportée en GEDCOM ;
la sauvegarde .json la conserve.

## Situation familiale

`situation` est la situation familiale (facultative) : `single` (célibataire),
`cohabiting` (concubinage), `pacs`, `married`, `remarried`, `separated`, `divorced`, `widowed` (veuf, veuve).
Dès qu'une personne a une union renseignée, la situation affichée suit sa dernière union : Veuve si
elle a pris fin par un décès ou si le conjoint est décédé, Divorcé, Séparée, Remarié à partir du
second mariage, En concubinage… Choisir Veuf, Divorcé ou Séparé marque la fin de la dernière union.
`situationDate` est la date ou l'année du mariage ou du pacs, saisie comme les autres dates ;
elle n'est demandée que pour ces deux situations. Le libellé s'accorde au sexe (« Mariée »).
En GEDCOM, elle est exportée dans une balise propre à Lignée, `_SITU` (avec `DATE`),
relue à l'import et ignorée par les autres logiciels.

## Union

`{ "a": "p_ex_05", "b": "p_ex_06", "type": "married", "date": "18/09/1956", "place": "Saint-Étienne" }`

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

## Dates

Les dates sont saisies librement : `12/03/1932`, `03/1932`, `1932`, `12 mars 1932`, `Mars 1932`,
`vers 1850`, `avant 1901`, `après 1790`. Le mois en toutes lettres se lit en français ou en anglais,
sans tenir compte de la casse ni des accents. Elles restent enregistrées telles que saisies et
s'affichent au format `04 Août 1961`. Ce qui n'est pas reconnu (`Javier 1950`, `19/29 Octobre 1861`)
reste du texte libre, affiché tel quel et ignoré par les calculs. L'export GEDCOM les convertit
(`12 MAR 1932`, `ABT 1850`…).
