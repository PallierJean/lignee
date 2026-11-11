# Lecture des écritures anciennes

Lignée lit le texte manuscrit des documents des sources (actes, contrats, lettres classées aux
archives) : chaque ligne trouvée sur l'image devient une ligne de texte, que l'on corrige ensuite.

- **La lecture se fait sur l'ordinateur**, par le serveur local (`npm start`) : rien n'est envoyé
  sur Internet. Elle prend environ une minute par page.
- **Le texte est gardé dans l'arbre** (champs `text` et `backText` de la source, voir
  [Format des données](../data-format.md)) : il part sur GitHub avec le reste, et s'affiche
  partout, même là où la lecture n'est pas possible (GitHub Pages, autre ordinateur).
- **Il n'est pas parfait.** Les lignes dont le modèle doute sont marquées en orange ; une ligne
  corrigée passe en vert (vérifiée).

## Installer la lecture

La lecture utilise [Kraken](https://kraken.re), logiciel libre de reconnaissance d'écriture, et le
modèle [Manu McFrench V3](https://doi.org/10.5281/zenodo.10874058) (manuscrits français, licence
libre). Une seule fois, dans un terminal (Python 3.10 ou plus récent, environ 2 Go) :

```sh
python3 -m venv ~/lignee-kraken
~/lignee-kraken/bin/pip install kraken
~/lignee-kraken/bin/kraken get 10.5281/zenodo.10874058
```

Si `python3 -m venv` signale que `ensurepip` manque (Debian, Ubuntu), créer l'environnement avec
`python3 -m venv --without-pip ~/lignee-kraken`, puis installer pip avec
`curl -sS https://bootstrap.pypa.io/get-pip.py | ~/lignee-kraken/bin/python`.

Puis relancer `npm start` : les liens « Lire le texte » apparaissent. Ailleurs :

- `LIGNEE_KRAKEN` : chemin du programme `kraken` (par défaut `~/lignee-kraken/bin/kraken`) ;
- `LIGNEE_HTR_MODEL` : chemin du modèle (par défaut `ManuMcFrenchV3.mlmodel`, cherché là où
  `kraken get` range les modèles, `~/.local/share/htrmopo/`).

Sans Kraken ou sans modèle, Lignée fonctionne comme avant et ne propose pas la lecture.

## Utilisation

- Sur une fiche ou dans la vue Sources de l'onglet Analyse, « Lire le texte » ouvre le document :
  l'image à gauche, le texte à droite. Recto et verso se lisent séparément.
- Survoler une ligne de texte l'éclaire sur l'image. On la corrige directement ; Entrée garde la
  correction et passe à la ligne suivante, les flèches montent et descendent. Ctrl+Z annule.
- « Relire le document » relance la lecture : le texte et les corrections sont remplacés.
- « Lire le texte de N documents », en haut de la vue Sources, lit l'un après l'autre tous ceux
  qui ne l'ont pas encore été ; « Arrêter » s'arrête après le document en cours.
- La recherche de la vue Sources cherche aussi dans le texte lu.
- Un texte lu sur une image remplacée depuis (recadrée, changée) ne compte plus.

## Fonctionnement

| Fichier | Rôle |
| --- | --- |
| `htr.js` | Côté serveur : lance `kraken segment -bl ocr` sur la photo (une lecture à la fois), lit le fichier ALTO produit (`parseAlto`) |
| `server.js` | `GET /api/htr` (lecture possible ?), `POST /api/trees/<arbre>/photos/<fichier>/read` |
| `js/services/htr.js` | Côté page : demande au serveur s'il peut lire, et lit une photo |
| `js/ui/reading.js` | La fenêtre du document, les corrections, la lecture de tous les documents |

Chaque ligne garde son cadre sur l'image (`box`, en fractions de la largeur et de la hauteur),
la confiance la plus basse du modèle sur la ligne (`conf`), et `ok` une fois corrigée.
