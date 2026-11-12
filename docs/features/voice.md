# Commandes à la voix

Un micro au bout du champ de recherche : on parle, Lignée écrit la phrase, la comprend et la
réalise.

- **Chercher** : « cherche les Maury », « trouve Hautefort ».
- **Ouvrir une fiche** : « ouvre la fiche de Jean Lacoste ».
- **Ajouter une personne**, seule ou avec son lien : « ajoute Anne Lacoste, née le 3 mai 1872 à
  Hautefort, fille de Marguerite Maury », « Pierre Lacoste est le père de Jean Lacoste »,
  « ajoute le père de Jean Lacoste : Pierre Lacoste », « Odette a eu une fille, Anne, en 1960 ».
- **Modifier une personne** : « Génie Desgorces est morte vers 1890 à la Borie », « Jean Maury
  était cultivateur ».

Chercher et ouvrir se font tout de suite. **Un ajout ou une modification ouvre le formulaire
habituel, rempli avec ce qui a été dit** : rien n'est enregistré avant le clic sur Enregistrer, et
Ctrl+Z annule comme pour toute modification. Si plusieurs personnes portent le nom dit, la bulle
demande laquelle ; un nom entendu un peu de travers (« Margerite Mauri ») est retrouvé quand même.

## Utilisation

- Cliquer sur le micro, ou appuyer sur **M** (hors d'un champ de saisie).
- Parler, puis se taire une seconde : l'écoute s'arrête toute seule (« Terminer » l'arrête tout de
  suite, au plus 30 secondes).
- La bulle montre la phrase entendue : on peut la corriger au clavier, puis « Comprendre » (ou
  Entrée). « Parler à nouveau » relance l'écoute, Échap ferme la bulle.

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
le charge dès qu'on appuie sur le micro).

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
