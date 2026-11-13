# Commandes à la voix

Un micro au bout du champ de recherche : on parle, Lignée écrit la phrase, la comprend et la
réalise.

- **Chercher** : « cherche les Maury », « trouve Hautefort ».
- **Ouvrir une fiche** : « ouvre la fiche de Jean Lacoste ».
- **Ajouter une personne**, seule ou avec son lien : « ajoute Anne Lacoste, née le 3 mai 1872 à
  Hautefort, fille de Marguerite Maury », « Pierre Lacoste est le père de Jean Lacoste »,
  « ajoute le père de Jean Lacoste : Pierre Lacoste », « Odette a eu une fille, Anne, en 1960 ».
- **Relier deux personnes déjà dans l'arbre** : « Marguerite Maury est la mère de Jean Lacoste »,
  « Jean Lacoste a une sœur, Marie », « le père de Jean Lacoste est Pierre Lacoste ». Si le nom
  complet dit (nom de naissance compris) est celui d'une fiche, Lignée ouvre le formulaire de la
  fiche qui porte le lien, au lieu d'en créer une nouvelle ; « Non, c'est une autre personne » crée
  la nouvelle fiche. Un frère ou une sœur se relie par les parents : si ni l'un ni l'autre n'a de
  parent connu, la bulle demande d'en choisir un.
- **Ajouter une union** : « Jean Tellier a épousé Marie Dupont le 3 juin 1990 à Confolens », « Jean et
  Marie se sont mariés en 1990 », « Jean est pacsé avec Paul Martin », « Jean vit en concubinage avec
  Sophie Martin », « Sophie Martin est la concubine (la compagne) de Jean Tellier ». Le type d'union
  (mariage, pacs, concubinage), sa date et son lieu remplissent l'union du formulaire ; une union
  déjà connue est complétée.
- **Modifier une personne** : « Génie Desgorces est morte vers 1890 à la Borie », « Jean Maury
  était cultivateur ».

Chercher et ouvrir se font tout de suite. **Un ajout ou une modification ouvre le formulaire
habituel, rempli avec ce qui a été dit** : rien n'est enregistré avant le clic sur Enregistrer, et
Ctrl+Z annule comme pour toute modification. Si plusieurs personnes portent le nom dit, la bulle
demande laquelle ; un nom entendu un peu de travers (« Margerite Mauri ») est retrouvé quand même.

**Une conversation, sans relancer le micro.** Après une phrase dite au micro, Lignée enchaîne :

1. Si le formulaire est rempli, la bulle **récapitule ce qui sera enregistré** (nom, père, mère,
   conjoint, naissance, décès, métier), Lignée le lit à voix haute et demande « Je l'enregistre ? ».
   Puis elle écoute la réponse :
   - « oui », « valide », « enregistre », « c'est bon » : la fiche est enregistrée (Ctrl+Z annule) ;
   - « non », « annule », « laisse tomber » : le formulaire se ferme sans rien enregistrer ;
   - une précision (« non, elle est née en 1873 », « il était maçon », « elle s'appelle Anne
     Marie ») : le formulaire est complété, relu, et Lignée réécoute (trois réponses au plus).
2. Ensuite, et après une recherche, une fiche ouverte ou une phrase non comprise, Lignée demande
   « Autre chose ? » et écoute la commande suivante.

Chaque écoute sans clic s'annonce par un petit signal sonore (deux notes, produites sur l'appareil).
« C'est tout », « merci » ou « non » terminent la conversation. Après 12 secondes sans parole, la
bulle le dit et le formulaire reste ouvert : **le micro (ou M) répond alors au formulaire** (« oui »,
« non », une précision), sans relancer une commande. Le silence n'est jamais envoyé à Whisper, et ce
qu'il invente sur un bruit (« Sous-titres réalisés par… ») compte comme rien entendu.

La lecture à voix haute n'utilise que les voix installées sur l'appareil : jamais une voix en ligne
(les voix « Google » de Chrome envoient le texte à Google). Sans voix installée, Lignée ne parle pas
et la bulle montre tout. Lignée n'écoute qu'une fois sa phrase finie, pour ne pas s'entendre.

Sous Linux, les voix installées viennent de speech-dispatcher (espeak-ng, par exemple) : Firefox
les utilise d'office ; Chrome seulement lancé avec l'option `--enable-speech-dispatcher` (sans elle,
il ne propose que « Google français », en ligne, et Lignée reste muette). Lignée prend la voix de
France (`fr-FR`), et la voix de base avant ses variantes.

La bulle a aussi ses boutons **Enregistrer** (Entrée) et **Annuler**, qui terminent la conversation.
La case « Conversation à la voix » la coupe (réglage retenu). Une phrase tapée dans la bulle n'est
pas suivie d'une écoute : on est alors au clavier.

**Noms et lieux, comme l'arbre les écrit.** Whisper écrit ce qu'il entend : « Telié », « Jean-Tellier »,
« Confoland ». Avant de remplir le formulaire, Lignée :

- remet à sa place un nom de famille de l'arbre collé aux prénoms (« Marc-Anatole-Octave-Tellier » →
  Marc-Anatole-Octave TELLIER) ;
- écrit un nom de famille qui se prononce comme un nom de l'arbre de la même façon (« Telié »,
  « Telier » → Tellier), et retrouve la personne dite (« ouvre la fiche de Jean Telié ») ;
- retrouve la commune dite dans la liste officielle, même mal entendue (« Confoland » → Confolens), et
  remplit son département ; un département dit (« Confolens, 16 », « en Charente », « dans la
  Haute-Vienne ») est repris.

**Plusieurs personnes du même nom.** La bulle les numérote ; on répond à la voix : « le premier »,
« la deuxième », « le dernier », l'année (« celui de 1995 »), un prénom, ou « une nouvelle personne ».

## Utilisation

- Cliquer sur le micro, ou appuyer sur **M** (hors d'un champ de saisie).
- Parler, puis se taire une seconde : l'écoute s'arrête toute seule (« Terminer » l'arrête tout de
  suite, au plus 30 secondes).
- La bulle montre la phrase entendue : on peut la corriger au clavier, puis « Comprendre » (ou
  Entrée). « Parler à nouveau » relance l'écoute, Échap ferme la bulle.
- Avant d'enregistrer, la bulle signale ce qui paraît faux dans le formulaire, et la voix le lit
  avant de demander « Je l'enregistre ? » : les contrôles de cohérence de l'arbre (un parent plus
  jeune que son enfant, un nom qui n'est pas celui du père…), une personne peut-être déjà dans
  l'arbre, une date incomplète (« 28 »). Rien n'est bloqué : on corrige, ou on enregistre quand même.

## Où ça tourne

Rien n'est envoyé à un service en ligne : la voix et les phrases restent sur l'appareil.

| | Écrire la phrase | La comprendre |
| --- | --- | --- |
| Avec le serveur local (`npm start`) | Whisper sur l'ordinateur | Les phrases connues tout de suite ; les autres par Qwen (Ollama) sur l'ordinateur |
| Sans serveur (GitHub Pages), navigateur avec WebGPU | Whisper dans le navigateur | Phrases connues ; les autres par Qwen dans le navigateur |
| Sans serveur, sans WebGPU | Whisper dans le navigateur (plus lent) | Phrases connues seulement |

Les phrases connues (celles de la liste ci-dessus et leurs variantes) sont comprises sans modèle de
langage, instantanément. Les autres passent par Qwen : comptez 10 à 20 secondes sur un ordinateur
sans carte graphique, et un peu plus pour la première phrase, le temps de charger le modèle (Lignée
le charge dès qu'on appuie sur le micro, et dès l'ouverture de la page si le micro a servi ces
sept derniers jours ; la bulle compte les secondes pendant qu'il réfléchit).

Dans le navigateur, les modèles sont téléchargés la première fois, après accord (Whisper : quelques
centaines de Mo ; Qwen : environ 2 Go, seulement s'il faut comprendre une phrase libre), puis
gardés par le navigateur.

## Installer sur l'ordinateur

Une seule fois, dans un terminal, sans droits d'administrateur.

**Whisper** ([faster-whisper](https://github.com/SYSTRAN/faster-whisper), logiciel libre, environ
1 Go avec le modèle) :

```sh
python3 -m venv ~/lignee-voice
~/lignee-voice/bin/pip install faster-whisper
```

Comme pour [la lecture des écritures](htr.md), si `ensurepip` manque : `python3 -m venv
--without-pip ~/lignee-voice` puis `curl -sS https://bootstrap.pypa.io/get-pip.py |
~/lignee-voice/bin/python`. Le modèle (`small`, environ 500 Mo) se télécharge à la première phrase.

**Ollama** ([ollama.com](https://ollama.com), logiciel libre) et le modèle Qwen2.5 7B (environ 5 Go) :
installer Ollama selon sa documentation (ou décompresser l'archive Linux dans `~/lignee-ollama`),
le lancer (`ollama serve`), puis :

```sh
ollama pull qwen2.5:7b
```

Relancer ensuite `npm start` : le micro apparaît. Réglages :

- `LIGNEE_WHISPER` : Python de l'environnement de faster-whisper (par défaut `~/lignee-voice/bin/python`) ;
- `LIGNEE_WHISPER_MODEL` : modèle Whisper (par défaut `small` ; `medium` est plus juste et plus lent) ;
- `LIGNEE_OLLAMA` : adresse d'Ollama (par défaut `http://127.0.0.1:11434`) ;
- `LIGNEE_LLM_MODEL` : modèle d'Ollama (par défaut `qwen2.5:7b`). Des essais sur un portable sans
  carte graphique : Qwen2.5 7B comprend juste en 10 à 20 secondes ; Qwen2.5 3B répond en 6 à 10
  secondes mais confond les liens de parenté.
- `LIGNEE_LLM_KEEP` : durée pendant laquelle Ollama garde le modèle en mémoire après la dernière
  phrase (par défaut `4h`). Le recharger prend environ une minute sans carte graphique ; il occupe
  environ 5 Go de mémoire vive.

Sans Whisper, le serveur ne propose pas le micro. Sans Ollama, seules les phrases connues sont
comprises.

## Fonctionnement

| Fichier | Rôle |
| --- | --- |
| `js/model/voice.js` | La commande (`action`, `who`, `relation`, `person`), la consigne et le schéma JSON donnés au modèle de langage, les phrases connues (`parseCommand`) |
| `js/services/voice.js` | Où ça tourne ; enregistrement du micro (arrêt sur silence, 16 kHz mono) ; Whisper et Qwen du serveur ou du navigateur |
| `js/ui/voice.js` | Le micro, la bulle, la recherche du nom dit parmi les fiches, la réalisation de la commande |
| `voice.js` | Côté serveur : Whisper (programme `scripts/whisper-worker.py`, gardé en mémoire un quart d'heure) et Ollama (réponse contrainte par le schéma) |
| `server.js` | `GET /api/voice`, `POST /api/voice/warm`, `POST /api/voice/listen` (WAV), `POST /api/voice/understand` |

Le serveur reçoit aussi, comme indice pour Whisper, les noms, prénoms et lieux les plus fréquents
de l'arbre ouvert : il les orthographie mieux.
