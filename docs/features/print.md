# Impression

[← Documentation technique](../DEVELOPMENT.md)

- Le titre proposé dans la fenêtre Imprimer se calcule d'après le père et la mère de la personne
  centrale (nom de naissance de la mère) : « Famille DURAND – ROCHE ». À défaut de parents
  connus, il reprend le nom le plus fréquent de l'arbre. Il reste modifiable.
- « Livre de famille complet, par branche » (fenêtre Imprimer, `model/book-branches.js`) : pages A4
  avec couverture et sommaire, puis un chapitre pour la personne centrale (parents, conjoints, enfants),
  un par grand-parent (Sosa 4 à 7) avec tous ses ancêtres, des plus anciens aux plus récents, et un
  dernier pour les autres personnes. Chaque branche reprend le récit de chacun, puis sa frise (naissances,
  unions, décès et repères historiques de la période) et l'album des images de sa galerie.
- « Livret de famille », sur chaque fiche, imprime le livret de la personne, sur le modèle de celui
  remis en mairie : la personne, chaque union avec ses enfants directs, chacun en extrait
  (naissance, parents, profession, unions, décès ; sans les unions pour les enfants). Document de famille, sans valeur officielle.
- « Disposition », dans la fenêtre Imprimer (arbre complet) : « Standard » reprend « Tout l'arbre » ;
  « Compacte » rétrécit les fiches, resserre les écarts et empile en colonne, sous leurs parents, les
  frères et sœurs sans conjoint ni enfant. L'arbre devient bien moins large que haut : le texte est
  environ 1,5 fois plus grand sur la même feuille. Les prénoms longs y sont plus souvent coupés.
- « Découpage », dans la fenêtre Imprimer, répartit l'arbre ou la roue sur plusieurs feuilles
  A4, A3, A2, A1 ou A0. En « Automatique » (par défaut), le nombre de feuilles dépend du dessin et du
  format : juste assez pour des prénoms de 2,5 mm au moins (2 mm pour le plus petit texte de
  la roue), une seule feuille si elle suffit. Sinon, on choisit le nombre de feuilles de large,
  la hauteur s'en déduit, et en
  orientation automatique l'application suit la forme du dessin. Les feuilles voisines se
  recouvrent de 10 mm (`tree/tiles.js`). Pour l'assemblage, la première page est un plan : le dessin
  entier, quadrillé, avec le code de chaque feuille (A1, A2, B1… : ligne en lettre, colonne en
  chiffre) et la marche à suivre. Chaque feuille porte son code, une mini-carte de sa position,
  ses voisines, et une zone grisée « Coller A2 ici » sur laquelle poser la feuille suivante.
- « Imprimer » (`ui/print.js`) propose l'arbre complet, la roue d'ascendance ou le livret de
  famille (`ui/booklet.js`) : couverture avec la roue, sommaire, puis un chapitre par génération,
  couples groupés, portraits et sources. Ses pages A4 portent leurs propres marges, indépendantes
  des réglages de la fenêtre d'impression. L'arbre
  et la roue sont redessinés en SVG, à l'échelle d'une feuille
  A3, A2, A1 ou A0, et l'application ouvre l'impression du navigateur : « Enregistrer au format PDF » donne
  un PDF vectoriel au bon format (règle `@page`). Firefox suit le papier choisi dans sa propre
  fenêtre : prenez-y le même format et la même orientation, sinon le dessin est réduit pour tenir sur la feuille.
