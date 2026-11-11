# Onglet Analyse

[← Documentation technique](../DEVELOPMENT.md)

- **Parenté** : le lien entre deux personnes, par le sang ou par alliance, l'ancêtre commun le
  plus proche et le chemin, surligné dans « Tout l'arbre ». Depuis une fiche : « Lien de parenté avec… ».
- **Cohérence** : erreurs certaines et points à vérifier (limites dans `model/checks.js`). Les dates
  imprécises ne sont signalées que si l'incohérence est certaine ; « vers » compte pour cinq ans
  de marge, et le texte libre n'est pas contrôlé.
  Les liens sont aussi vérifiés : sexe du père et de la mère, grand-parent et petit-enfant à moins
  de 34 ans d'écart, parent connu par une union mais non rattaché, marié sans conjoint, personne sans
  décès de plus de 110 ans (d'après sa naissance ou celle de son premier enfant), nom de naissance
  qui n'est ni celui du père, ni le double nom du père et de la mère (dans un sens ou dans l'autre,
  espaces et tirets indifférents).

- **Doublons** : fiches au même prénom usuel et au même nom, sans date contradictoire. La fusion
  reporte enfants, unions et identifications sur la fiche gardée ; elle s'annule. « Ce n'est pas
  un doublon » est gardé dans ce navigateur, pour chaque arbre (clé `lignee.dups.v1`) : la paire
  n'est plus proposée, même après rechargement.
- **INSEE** (avec `npm start` seulement : matchID n'autorise pas les appels venant d'une page web
  (pas d'en-têtes CORS), le site GitHub Pages ne peut donc pas l'interroger) : rapproche les fiches du fichier des décès de l'INSEE
  (décès survenus en France depuis 1970), que publie matchID. « Vérifier » interroge, une fiche par
  seconde, les fiches nouvelles ou dont le nom, le prénom, le sexe ou la naissance a changé ; les
  autres gardent leur résultat (clé `lignee.insee.v1` de ce navigateur, par arbre). Ne partent que le
  nom de naissance, le premier prénom, le sexe et la date de naissance ; ni les personnes mortes avant
  1970 ou nées avant 1870, ni les vivants de moins de 75 ans. L'acte retenu est « certain » (même
  date de naissance exacte, sans homonyme), « probable » ou une simple piste (`model/insee.js`) ;
  « C'est bien lui / elle » confirme une piste, qui se reporte alors comme un acte sûr (la
  confirmation vaut pour cet acte-là).
  La vue liste les écarts (date ou lieu de naissance ou de décès, personne marquée vivante), ce qui
  complète la fiche, les prénoms de l'état civil, le nom de naissance et le numéro de l'acte de
  décès ; « Reporter » écrit une valeur dans la fiche, en une action annulable. Les dates s'écrivent
  « 08 Août 1927 » ; le numéro d'acte devient une source « Acte de décès », fait « Décès »,
  intitulée « Acte n°163 » et placée au lieu du décès. L'INSEE écrit les noms sans accents : les
  prénoms déjà dans la fiche gardent leur orthographe, les autres reprennent leurs accents d'après
  l'arbre puis d'après une liste de prénoms français (`model/first-names.js`) ; le nom de naissance,
  d'après les noms de l'arbre, va dans le nom de jeune fille d'une femme.
  Sans compte, matchID n'accepte que quelques recherches puis répond « connexion nécessaire » :
  la vue propose alors l'inscription gratuite (adresse e-mail, puis code reçu par e-mail). Le jeton
  est gardé par server.js dans `data/matchid.json` (ignoré par git, jamais servi aux pages) et
  renouvelé la veille de son expiration ; les fiches déjà vérifiées restent acquises.
  Routes du serveur local qui relaient ces appels : [Relais vers le fichier des décès](../insee.md).
- **Actes** (avec `npm start` seulement, comme la vue INSEE) : les actes de décès à demander aux
  mairies. Reprend les fiches vérifiées par l'INSEE (acte certain, probable ou confirmé) qui ont un
  numéro d'acte, et les décès d'avant 1970 que l'INSEE ne connaît pas, d'après les fiches (date sûre,
  commune en France ; sans numéro : la mairie retrouve l'acte avec le nom, la date et le lieu,
  `recordDeathAct`), regroupés par mairie à contacter aujourd'hui : un décès dans une commune qui a
  fusionné depuis (commune nouvelle, commune déléguée, changement de nom) est rangé sous la commune
  d'aujourd'hui, qui garde ses registres, et la ligne rappelle la commune du décès
  (`js/data/commune-changes.js`, chargé à l'ouverture de la vue). Mairies rangées par département,
  l'étranger puis les communes inconnues à la fin. « Copier la liste » (une mairie) et « Copier toute
  la liste » mettent dans le presse-papiers « Mairie de … » puis une ligne par acte (nom et prénoms de
  l'état civil, naissance, décès, numéro) ; « Exporter en CSV » télécharge tous les actes pour un
  tableur. Le fichier de l'INSEE ne donne que le numéro de l'acte de décès, pas celui de l'acte de
  naissance (`deathActsByCommune` dans `model/insee.js`).
  « Trouver la mairie » cherche la mairie dans l'annuaire officiel de service-public.fr (données
  ouvertes ; seuls le nom de la commune et son département partent, `services/town-hall.js`) et
  affiche son adresse e-mail, son téléphone et son formulaire de contact, avec « Écrire un e-mail
  prérempli » : un lien `mailto:` qui ouvre la messagerie avec l'objet et la demande, liste des actes
  comprise. Le champ « Votre adresse e-mail » (gardé dans ce navigateur, clé `lignee.cc.v1`) la met
  en copie, pour garder une trace de chaque demande. Rien n'est envoyé sans que l'utilisateur relise
  et envoie lui-même. Une mairie
  introuvable (Paris, par exemple, nommée autrement) renvoie vers la recherche de l'annuaire.
  « Préparer toutes les demandes » fait la même recherche pour toutes les mairies d'un clic (l'une
  après l'autre, une pause de 300 ms entre deux), puis affiche « Demandes prêtes » : un lien
  « Écrire à la mairie de … » par mairie qui a une adresse e-mail, et la liste de celles à contacter
  à la main, chacune avec le lien de son formulaire de contact (ou de son site, ou de la recherche de
  l'annuaire). Les grandes villes (Bordeaux, Limoges, Albi…) ne publient pas d'adresse e-mail dans
  l'annuaire et passent par leur formulaire ; Paris a une mairie par arrondissement, que le fichier de
  l'INSEE tel que Lignée le garde ne précise pas. Un navigateur n'ouvre qu'un e-mail par clic : on les
  envoie l'un après l'autre.
  Une fiche qui a déjà la photo de son acte (source de décès ou d'inhumation, ou qui appuie le décès,
  avec son image : `hasDeathDocument`) n'est plus proposée : l'acte a déjà été obtenu ; la vue dit
  combien de fiches sont dans ce cas.
  Les décès d'avant 1800 (`ARCHIVES_BEFORE`) ne vont pas aux mairies mais aux archives
  départementales, qui conservent les registres paroissiaux et les premiers registres d'état civil :
  un groupe « Archives départementales : Haute-Vienne (87) » par département (commune
  d'aujourd'hui, comme pour les mairies), rangé avant les mairies du département, chaque ligne
  rappelant la commune du décès. « Trouver les archives » cherche dans le même annuaire le service
  « Archives départementales - … » du département (les Archives de Paris pour Paris ; seul le numéro
  du département part, `findArchives`), et l'e-mail prérempli demande les actes de décès ou de
  sépulture, avec la cote du registre en ligne s'il est numérisé. Sans département connu ou à
  l'étranger, le décès reste rangé par commune.
- **Statistiques**, **Éphémérides** (dates exactes seulement ; un 29 février se fête le 28 les
  années non bissextiles), **Frise** (personne ou famille proche, avec repères historiques,
  plutôt français, dans `model/history-data.js`) et **Galerie** (toutes les images de l'arbre).
- **Lieux** : chaque lieu cité, avec son nombre de mentions, rangé par numéro de département, puis par
  ville, puis par lieu-dit (les lieux sans département à la fin). On corrige la ville, le lieu-dit ou le
  département, puis « Renommer partout » : naissances, décès, événements et unions suivent, en une
  seule action annulable. Donner le nom d'un lieu existant réunit les deux.
- **Carte** : lieux et migrations (du lieu de naissance d'un parent à celui de son enfant).
  Le bouton « Localiser » envoie les noms des lieux, et eux seuls, à OpenStreetMap (Nominatim),
  un par seconde. Rien ne part sans ce clic. Les coordonnées sont gardées dans ce navigateur
  (clé `lignee.geo.v1`). Le fond est un contour simplifié de la France, sans fichier externe.
- **Sources** : chaque document de l'arbre, une seule fois, rangé par nature (naissance, mariage…)
  puis par titre, avec sa vignette et les fiches qui le citent, et pour quel fait (`sourceLibrary`
  dans `ui/analysis.js`). Un acte de mariage cité par les deux époux n'apparaît qu'une fois. Dans
  le formulaire, un document partagé l'indique : le modifier le modifie pour toutes ces fiches.
  Deux filtres : la nature du document, et une recherche dans le titre, le lieu, la cote, la note et
  les noms des personnes qui le citent.
- **Galerie** : toutes les images de l'arbre. La première case ajoute des photos à la galerie de la
  personne centrale (la fiche a la même case pour sa propre galerie). Une seule image s'ouvre d'abord
  dans le recadrage libre (`ui/crop-free.js` : un cadre à poignées, déplaçable et redimensionnable,
  sans format imposé) ; ensuite, la visionneuse l'affiche pour identifier les personnes. Dans la
  visionneuse, « Recadrer » et « Supprimer l'image » (après confirmation, annulable) ; recadrer
  garde les personnes identifiées à leur place, et retire celles qui sortent du cadre. Pour choisir
  la personne d'un visage, un champ de recherche (nom, lieu, année) remplace la liste de tout l'arbre ;
  Entrée prend le premier résultat. Sans intitulé, une image est nommée par les personnes identifiées
  et sa date.
