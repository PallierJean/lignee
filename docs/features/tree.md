# Arbre et roue d'ascendance

[← Documentation technique](../DEVELOPMENT.md)

## Affichage

- `tree/layout.js` place les ascendants au-dessus de la personne centrale
  (numérotation Sosa : père = 2n, mère = 2n + 1) et les descendants en dessous,
  avec tous les conjoints de chaque personne : le premier à droite, le second à gauche, les
  suivants à droite du premier, reliés par un arc.
- Les boutons Ascendants et Descendants (`ui/header.js`) montrent quatre valeurs à la fois, encadrées
  de « … » : jusqu'au plus lointain ancêtre de la personne centrale pour les ascendants (au moins 2,
  pour ajouter parents et grands-parents), jusqu'à son dernier descendant pour les descendants (au
  moins 1, pour ajouter un enfant). Le choix est gardé d'une personne à l'autre.
- Les autres conjoints d'un ancêtre (par exemple le second compagnon d'une grand-mère
  devenue veuve) s'affichent à côté de lui, sans numéro Sosa : à gauche d'un père,
  à droite d'une mère. On les ajoute depuis la fiche de l'ancêtre, avec
  « Ajouter un conjoint ou une conjointe » ou le champ « Ajouter une union ».
- « Tout l'arbre » (`tree/full-layout.js`) affiche toutes les personnes à plat, une ligne
  par génération : conjoints côte à côte, enfants sous leurs parents, familles sans lien
  posées l'une à côté de l'autre. Les numéros Sosa restent ceux de la personne choisie.
- « Lignée directe » entoure d'un halo vert les ancêtres directs de la personne centrale (ceux
  qui ont un numéro Sosa) et colore les traits qui remontent jusqu'à eux. À l'impression, seul le
  contour des fiches est vert.
- « Vivants » et « N° d'acte » sont des filtres : les fiches qui n'y répondent pas sont estompées
  (`passesFilter` dans `model/people.js`), les autres restent nettes. « Vivants » garde les personnes
  qui ne sont pas décédées ; « N° d'acte » garde celles dont une source du décès porte un numéro
  d'acte, dans sa cote ou dans son titre (« Acte n°412 », comme l'ajoute la vérification INSEE :
  `hasDeathNumber`). Un seul filtre à la fois ; un second clic l'enlève. Le choix est gardé avec
  les préférences d'affichage (`filter`) ; l'impression et l'éventail l'ignorent.
- Quand la barre manque de place, « Lignée directe », les filtres et « Éventail » passent en
  icônes (le nom reste en infobulle et pour les lecteurs d'écran), comme Imprimer ou Recentrer.
- « Éventail » (`tree/fan.js`) remplace l'arbre par la roue d'ascendance de la personne
  centrale, jusqu'à 10 générations, père à gauche et mère à droite de chaque secteur. Seuls les
  ancêtres connus et une case vide juste au-dessus d'eux sont tracés, et la roue est recadrée sur eux ;
  dans les anneaux les plus serrés, le nom tient sur une ligne (zoom jusqu'à 300 % pour le lire).
  Au survol d'un ancêtre (`ui/fan-hover.js`), une étiquette donne son nom, son numéro Sosa, sa
  génération, sa naissance et son décès, et son chemin jusqu'au centre reste net quand le reste
  s'estompe. Un double-clic centre la roue sur lui ; un double-clic au centre revient en arrière.
  Une barre au-dessus de la roue fait de même (« ← Revenir à… ») et descend vers un descendant de la
  personne centrale, jusqu'au plus lointain connu (liste rangée par génération), même après un
  rechargement ; elle signale une personne sans ancêtre connu.
- « Supprimer » une fiche se trouve sur la fiche de la personne centrale, dans la fenêtre d'une
  personne (clic sur sa carte) et dans le formulaire d'une fiche existante (pour une personne créée
  au mauvais endroit). Une confirmation est demandée ; ses liens sont retirés, « Annuler » rétablit tout.

## Plusieurs arbres

Voir [Stockage des données](../storage.md#plusieurs-arbres).
