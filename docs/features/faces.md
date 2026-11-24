# Visages reconnus

Quand on ouvre une photo de la galerie (en particulier juste après l'avoir ajoutée), Lignée cherche
les visages qu'elle connaît déjà et propose qui est qui : il suffit de confirmer.

- **La recherche se fait sur l'ordinateur**, par le serveur local (`npm start`) : rien n'est envoyé
  sur Internet.
- **Les visages connus sont ceux de l'arbre** : les personnes repérées sur les photos de la galerie
  et des archives (repère placé sur le visage), et les portraits des fiches. Plus on identifie de
  monde, meilleures sont les suggestions.
- **Rien n'est décidé seul** : une suggestion ne devient un repère qu'une fois confirmée. Une
  suggestion écartée ne revient plus pendant la session.
- **Elle se trompe parfois** : sur une centaine de photos de famille anciennes, environ neuf visages
  sur dix repérés à la main étaient retrouvés, avec une erreur pour quinze suggestions justes.

## Installer la reconnaissance

Elle utilise [OpenCV](https://opencv.org) (logiciel libre) et deux modèles de son
[catalogue de modèles](https://github.com/opencv/opencv_zoo) : YuNet trouve les visages, SFace les
décrit. Une seule fois, dans un terminal (Python 3.10 ou plus récent, environ 200 Mo) :

```sh
python3 -m venv ~/lignee-faces
~/lignee-faces/bin/pip install opencv-python-headless
mkdir -p ~/.local/share/lignee-faces && cd ~/.local/share/lignee-faces
curl -LO https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx
curl -LO https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx
```

Si `python3 -m venv` signale que `ensurepip` manque (Debian, Ubuntu), créer l'environnement avec
`python3 -m venv --without-pip ~/lignee-faces`, puis installer OpenCV avec le pip du système :
`python3 -m pip --python ~/lignee-faces/bin/python install opencv-python-headless`.

Puis relancer `npm start`. Ailleurs :

- `LIGNEE_FACES` : Python de l'environnement d'OpenCV (par défaut `~/lignee-faces/bin/python`) ;
- `LIGNEE_FACES_MODELS` : dossier des deux modèles (par défaut `~/.local/share/lignee-faces`).

Sans OpenCV ou sans modèles, Lignée fonctionne comme avant et ne suggère personne.

## Utilisation

### Sur une photo

- En ouvrant une photo, « Recherche des visages connus… » s'affiche un instant sous l'image (quelques
  secondes la première fois, le temps de parcourir les photos de l'arbre ; ensuite, aussitôt).
- Les visages reconnus sont entourés de pointillés ; sous l'image, « Visages reconnus » liste les
  noms proposés. « ✓ Confirmer » (ou un clic sur le visage) place le repère, × écarte la
  suggestion, « Tout confirmer » les accepte toutes. Ctrl+Z annule.
- Un visage déjà repéré, ou une personne déjà placée sur la photo, n'est pas proposé ; une personne
  n'est proposée que sur un visage à la fois.
- Les visages trouvés sans être reconnus sont entourés d'un fin pointillé : un clic dessus demande
  « Qui est-ce ? », le repère déjà placé sur le visage. Une suggestion écartée devient l'un d'eux.

### Toute la galerie : « Visages à identifier »

Le bouton, au-dessus de la galerie, ouvre une fenêtre en deux parties :

- **Même personne sur plusieurs photos** : les visages inconnus (sans repère, et qui ne ressemblent
  à personne de connu) qui se ressemblent d'une photo à l'autre, regroupés. On retire d'abord (×) un
  visage qui n'est pas la personne, puis on la nomme : elle est repérée sur chaque photo du groupe,
  en une seule action (Ctrl+Z annule tout). « Ignorer » passe au groupe suivant.
- **Portraits à ajouter** : pour chaque personne sans portrait repérée sur des photos, son visage le
  plus net (celui qui a le plus de pixels). « Choisir comme portrait » ouvre le recadrage, déjà centré
  sur le visage ; le portrait est rangé dans le dossier de la personne.

La première ouverture parcourt toute la galerie (quelques secondes pour une centaine de photos).

## Fonctionnement

| Fichier | Rôle |
| --- | --- |
| `scripts/faces-worker.py` | Trouve les visages d'images (YuNet) et donne pour chacun un cadre et un vecteur (SFace) |
| `faces.js` | Côté serveur : lance le programme (une recherche à la fois), garde en mémoire les visages de chaque image |
| `js/model/faces.js` | Visages connus de l'arbre enregistré (`faceRefs`, `knownFaces`), suggestions (`suggestFaces`), groupes d'inconnus (`unknownGroups`), visages pour un portrait (`portraitFaces`) |
| `server.js` | `GET /api/faces` (reconnaissance possible ?), `POST /api/trees/<arbre>/photos/<fichier>/faces` (une photo), `GET /api/trees/<arbre>/faces` (toute la galerie) |
| `js/services/faces.js` | Côté page : demande au serveur s'il peut reconnaître, et les suggestions d'une photo |
| `js/ui/media.js` | La visionneuse : visages proposés, confirmer, écarter ; visages inconnus cliquables |
| `js/ui/faces.js` | La fenêtre « Visages à identifier » : groupes d'inconnus, portraits à ajouter |
| `js/ui/crop.js` | Le recadrage d'un portrait, ouvert sur un visage (`faceView`) |

Deux visages sont jugés de la même personne quand le cosinus de leurs vecteurs dépasse 0,363 (seuil
recommandé pour SFace). Pour chaque visage de la photo, Lignée compare avec au plus 12 visages
connus par personne (le portrait d'abord, puis les repères les plus récents) et retient la meilleure
ressemblance ; les paires les plus proches sont attribuées d'abord. Les vecteurs ne sont pas gardés
dans l'arbre : ils restent dans la mémoire du serveur, recalculés à son redémarrage.

Les visages inconnus se regroupent quand leur cosinus dépasse 0,5, plus strict que pour une
suggestion : un groupe est nommé d'un coup, un visage de trop y serait repéré avec les autres. Les
paires les plus proches se joignent d'abord, et jamais deux visages d'une même photo. Mesuré sur une
centaine de photos de famille annotées, en faisant comme si aucun visage n'était connu : 246 visages
regroupés, dont 3 dans le mauvais groupe.
