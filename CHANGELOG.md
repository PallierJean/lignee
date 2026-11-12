# Changelog

## [4.1.0](https://github.com/PallierJean/lignee/compare/v4.0.0...v4.1.0) (2026-11-12)

### Features

* Group the analysis views by theme ([3a0c2db](https://github.com/PallierJean/lignee/commit/3a0c2db63e6897715d6edf623be883243dbbf896))
* An Archives view apart from the sources ([916874a](https://github.com/PallierJean/lignee/commit/916874aa2512dc5813c331d178d0583013be4724))

---

### Nouveautés

* Les vues de l'onglet Analyse sont rangées par thème : vérifier l'arbre, les documents, le temps et les lieux, puis la galerie ([3a0c2db](https://github.com/PallierJean/lignee/commit/3a0c2db63e6897715d6edf623be883243dbbf896))
* Une vue Archives dans l'onglet Analyse, à part des sources. Les papiers de famille et les images classées depuis la galerie n'y sont plus mêlés aux actes ; « Classer aux archives » ne demande plus de type. ([916874a](https://github.com/PallierJean/lignee/commit/916874aa2512dc5813c331d178d0583013be4724))

## [4.0.0](https://github.com/PallierJean/lignee/compare/v3.7.0...v4.0.0) (2026-11-12)

### ⚠ BREAKING CHANGES

* Backup format 3. Trees, backups and repositories written by this version can't be opened by Lignée 3.x; the local server must be restarted, as an older one only shows the tree read-only. ([b062850](https://github.com/PallierJean/lignee/commit/b062850924b1917bef592a48ea3d4629e5de24ff))

### Features

* Keep the gallery apart from the records ([b062850](https://github.com/PallierJean/lignee/commit/b062850924b1917bef592a48ea3d4629e5de24ff))
* Voice commands to search, open, add and edit people ([09e384b](https://github.com/PallierJean/lignee/commit/09e384b0d59e42b838063eacafb60ab0a6a9f099))

### Bug Fixes

* Keep a document's reading tied to its image when the file changes ([c13502b](https://github.com/PallierJean/lignee/commit/c13502bb31edb9888efb5707ec72e79ac7507da2))
* Rewrite an outdated repository backup as soon as it is linked ([33a4c64](https://github.com/PallierJean/lignee/commit/33a4c64d30360dfec03c495eaa7d0745e69a4383))
* Rename gallery files still named after a person ([9a21d4b](https://github.com/PallierJean/lignee/commit/9a21d4bb44b14df4e9d6b1605dee7878fcd21b80))
* Show the form when the side panel is folded, run voice in the online site ([29011ab](https://github.com/PallierJean/lignee/commit/29011ab3614db81b260dd2da9f154d1e26fd2043))

---

### ⚠ Changements incompatibles

* Backup format 3. Trees, backups and repositories written by this version can't be opened by Lignée 3.x; the local server must be restarted, as an older one only shows the tree read-only. ([b062850](https://github.com/PallierJean/lignee/commit/b062850924b1917bef592a48ea3d4629e5de24ff))

### Nouveautés

* La galerie est rangée à part des fiches. Les images forment leur propre collection dans l'arbre, comme les unions : une fiche ne garde que son portrait, et une image n'est liée à une personne que par son identification dessus. Ajoutées depuis la galerie de l'arbre, les photos n'identifient personne ; depuis une fiche, sa personne. Leurs fichiers s'appellent « galerie-… » au lieu du nom de la personne au centre de l'arbre. Les arbres au format 2 sont convertis automatiquement, sans perte. Changement majeur : format de sauvegarde 3, que Lignée 3.x ne sait pas ouvrir. ([b062850](https://github.com/PallierJean/lignee/commit/b062850924b1917bef592a48ea3d4629e5de24ff))
* Commandes à la voix pour chercher, ouvrir, ajouter et modifier des personnes. Un micro au bout du champ de recherche (ou la touche M) : Whisper écrit la phrase, puis Lignée la comprend, tout de suite pour les phrases connues, avec un modèle de langage (Qwen) pour les phrases libres. Chercher et ouvrir une fiche se font aussitôt ; un ajout ou une modification ouvre le formulaire habituel rempli avec ce qui a été dit, enregistré seulement au clic sur Enregistrer. Tout tourne sur l'ordinateur avec le serveur local (Whisper et Ollama) : rien n'est envoyé sur Internet. ([09e384b](https://github.com/PallierJean/lignee/commit/09e384b0d59e42b838063eacafb60ab0a6a9f099))

### Corrections

* La transcription d'un document reste affichée après un envoi ou une ouverture depuis GitHub ([c13502b](https://github.com/PallierJean/lignee/commit/c13502bb31edb9888efb5707ec72e79ac7507da2))
* Un dépôt GitHub à l'ancien format est réécrit dès la connexion, sans attendre une modification ([33a4c64](https://github.com/PallierJean/lignee/commit/33a4c64d30360dfec03c495eaa7d0745e69a4383))
* Les photos de la galerie encore nommées d'après une personne prennent le nom « galerie-… » ([9a21d4b](https://github.com/PallierJean/lignee/commit/9a21d4bb44b14df4e9d6b1605dee7878fcd21b80))
* Le formulaire s'affiche quand le panneau latéral est replié, et la voix marche sur le site en ligne. Un formulaire ouvert avec le panneau replié restait caché : le panneau se déplie. Sur le site GitHub Pages, Whisper et Qwen tournent dans le navigateur ; Whisper n'utilise la carte graphique que si elle répond vraiment. ([29011ab](https://github.com/PallierJean/lignee/commit/29011ab3614db81b260dd2da9f154d1e26fd2043))

## [3.7.0](https://github.com/PallierJean/lignee/compare/v3.6.0...v3.7.0) (2026-11-11)

### Features

* Read the handwriting of documents on this computer ([36e5511](https://github.com/PallierJean/lignee/commit/36e5511b35fa01b5d4f68572123693b7bbacd27d))

---

### Nouveautés

* Lecture des écritures anciennes, sur l'ordinateur : avec npm start et Kraken installé, « Lire le texte » lit un document des sources (recto et verso). L'image s'affiche à côté du texte lu ; survoler une ligne l'éclaire sur l'image, chaque ligne se corrige sur place (Entrée passe à la suivante). Les lignes douteuses sont en orange. La vue Sources lit tous les documents d'un coup et cherche aussi dans le texte lu. Rien n'est envoyé sur Internet ; le texte est gardé dans l'arbre. ([36e5511](https://github.com/PallierJean/lignee/commit/36e5511b35fa01b5d4f68572123693b7bbacd27d))

## [3.6.0](https://github.com/PallierJean/lignee/compare/v3.5.0...v3.6.0) (2026-11-11)

### Features

* Show the whole gallery in place of the tree from the toolbar ([4e6a26d](https://github.com/PallierJean/lignee/commit/4e6a26dfeebbae64fe3cff6c418eb6f2e21a4fc2))

### Bug Fixes

* No default title for an added image ([7158790](https://github.com/PallierJean/lignee/commit/7158790226ef2540edb9e7eaccfb608435080ba5))

---

### Nouveautés

* Un bouton « Galerie » dans la barre de l'arbre affiche toutes les images à la place de l'arbre. Le bouton, « Revenir à l'arbre » ou Échap ramènent l'arbre, là où il était. ([4e6a26d](https://github.com/PallierJean/lignee/commit/4e6a26dfeebbae64fe3cff6c418eb6f2e21a4fc2))

### Corrections

* Une photo ajoutée n'a plus de titre par défaut : elle porte le nom des personnes identifiées, sinon « Image sans titre ». Les titres hérités d'un nom de fichier (« PART_1474012919711_DSC_0936 ») sont ignorés. ([7158790](https://github.com/PallierJean/lignee/commit/7158790226ef2540edb9e7eaccfb608435080ba5))

## [3.5.0](https://github.com/PallierJean/lignee/compare/v3.4.0...v3.5.0) (2026-11-11)

### Features

* Move a gallery image to the archives as a source ([779c17a](https://github.com/PallierJean/lignee/commit/779c17a84d907fc0093fed5b30c818150a5b73c3))
* Add, change or remove an image's back from the gallery viewer ([942b1a1](https://github.com/PallierJean/lignee/commit/942b1a12383c44c2e3d8cec25832680efc39eda4))
* Switch between the front and back of an enlarged document ([c9f4007](https://github.com/PallierJean/lignee/commit/c9f4007c747722cb39ce09eebe4420ce8b02f95f))
* Read the family headers of the Sources view as "BOURREL - 7 documents" ([d553004](https://github.com/PallierJean/lignee/commit/d553004f49a42e1bd11924d1997340925dfc4f46))
* Group the Sources view by family ([2100426](https://github.com/PallierJean/lignee/commit/2100426e870fe6a3492ff26079e611037d1cd4cf))

### Code Refactoring

* Remove the claude.ai online database mode ([ab273a7](https://github.com/PallierJean/lignee/commit/ab273a79bf9300e8d04b2340a69cb772d3665ada))

---

### Nouveautés

* « Classer aux archives » depuis la visionneuse : l'image quitte la galerie et devient une source (recto, verso, titre, date et note), citée par les personnes identifiées dessus. Annulable par Ctrl+Z. ([779c17a](https://github.com/PallierJean/lignee/commit/779c17a84d907fc0093fed5b30c818150a5b73c3))
* Le verso d'une image de la galerie s'ajoute, se change ou se retire directement depuis la visionneuse. ([942b1a1](https://github.com/PallierJean/lignee/commit/942b1a12383c44c2e3d8cec25832680efc39eda4))
* Un document agrandi qui a un verso, comme un contrat de mariage, passe du recto au verso avec deux boutons ou les flèches du clavier, sans fermer la fenêtre. ([c9f4007](https://github.com/PallierJean/lignee/commit/c9f4007c747722cb39ce09eebe4420ce8b02f95f))
* Les en-têtes de famille de la vue Sources se lisent « BOURREL - 7 actes ». ([d553004](https://github.com/PallierJean/lignee/commit/d553004f49a42e1bd11924d1997340925dfc4f46))
* Dans la vue Sources, les actes de chaque nature sont regroupés par nom de famille, avec un en-tête et leur nombre. ([2100426](https://github.com/PallierJean/lignee/commit/2100426e870fe6a3492ff26079e611037d1cd4cf))

### Refontes

* L'application n'a plus aucun lien avec claude.ai : le mode base en ligne et le téléchargement par claude.ai sont retirés. Les arbres restent dans data/arbres/ (serveur local) ou dans le navigateur. Corrige aussi un import interrompu en mode navigateur, qui ne proposait pas la reprise. ([ab273a7](https://github.com/PallierJean/lignee/commit/ab273a79bf9300e8d04b2340a69cb772d3665ada))

## [3.4.0](https://github.com/PallierJean/lignee/compare/v3.3.2...v3.4.0) (2026-11-11)

### Features

* Sort the Sources view by the person cited ([61520fc](https://github.com/PallierJean/lignee/commit/61520fc5d47a5e2154f15df82696daed49074092))

### Bug Fixes

* Sort women known by their maiden name with their family ([c8efe08](https://github.com/PallierJean/lignee/commit/c8efe087e10a080fa1bbf3aea60ba07161534186))
* Open the documents of the Sources view full size ([3876d79](https://github.com/PallierJean/lignee/commit/3876d799642642bb8cc253a1c2160d2a60c6325a))

---

### Nouveautés

* Dans la vue Sources, les actes sont rangés par personne citée (nom puis prénom), puis par numéro dans l'ordre. ([61520fc](https://github.com/PallierJean/lignee/commit/61520fc5d47a5e2154f15df82696daed49074092))

### Corrections

* Dans la vue Sources, une femme enregistrée avec son seul nom de jeune fille est rangée à ce nom, avec sa famille. ([c8efe08](https://github.com/PallierJean/lignee/commit/c8efe087e10a080fa1bbf3aea60ba07161534186))
* Dans la vue Sources, un clic sur la photo d'un acte l'affiche en grand, comme sur la fiche ; le verso a aussi sa vignette. ([3876d79](https://github.com/PallierJean/lignee/commit/3876d799642642bb8cc253a1c2160d2a60c6325a))

## [3.3.2](https://github.com/PallierJean/lignee/compare/v3.3.1...v3.3.2) (2026-11-11)

### Bug Fixes

* Make an image's title easy to set, and ignore camera file names ([8952f43](https://github.com/PallierJean/lignee/commit/8952f43ae7b8376338042cfad91c19473587bc73))

---

### Corrections

* Dans la visionneuse, un crayon à côté du titre permet de le modifier. Les titres qui ne sont qu'un nom de fichier d'appareil sont ignorés à l'affichage. ([8952f43](https://github.com/PallierJean/lignee/commit/8952f43ae7b8376338042cfad91c19473587bc73))

## [3.3.1](https://github.com/PallierJean/lignee/compare/v3.3.0...v3.3.1) (2026-11-11)

### Bug Fixes

* Fit the free crop frame to the image, whatever its shape ([def1e3a](https://github.com/PallierJean/lignee/commit/def1e3abd4ad930f33f57793df9ee29d4182f06e))

---

### Corrections

* Le cadre de recadrage colle maintenant à l'image, même quand elle est en hauteur. ([def1e3a](https://github.com/PallierJean/lignee/commit/def1e3abd4ad930f33f57793df9ee29d4182f06e))

## [3.3.0](https://github.com/PallierJean/lignee/compare/v3.2.0...v3.3.0) (2026-11-11)

### Features

* Add, crop and identify photos more easily in the gallery ([446c2d8](https://github.com/PallierJean/lignee/commit/446c2d8fbaad05ad23dad20965e20cf2c531dc25))
* Delete an image from the gallery viewer ([f30a696](https://github.com/PallierJean/lignee/commit/f30a69631ce001e7051dfc37cc010157e7ac090f))
* Identify people when adding a photo, and drop meaningless titles ([b1a7e0f](https://github.com/PallierJean/lignee/commit/b1a7e0f0c3fe5da5b02dca1f629d5b41784dcc18))

---

### Nouveautés

* La galerie commence par une case « Ajouter des photos ». Les images se recadrent librement, dès l'ajout ou plus tard. Pour identifier une personne sur une photo, un champ de recherche remplace la longue liste de noms. ([446c2d8](https://github.com/PallierJean/lignee/commit/446c2d8fbaad05ad23dad20965e20cf2c531dc25))
* La visionneuse de la galerie permet maintenant de supprimer une image, après confirmation ; Ctrl+Z l'annule. ([f30a696](https://github.com/PallierJean/lignee/commit/f30a69631ce001e7051dfc37cc010157e7ac090f))
* Vous pouvez identifier les personnes sur une photo dès son ajout, depuis le formulaire. L'intitulé devient facultatif : sans lui, Lignée affiche les personnes identifiées et la date, et ne reprend plus les noms de fichier comme « IMG_1234 ». ([b1a7e0f](https://github.com/PallierJean/lignee/commit/b1a7e0f0c3fe5da5b02dca1f629d5b41784dcc18))

## [3.2.0](https://github.com/PallierJean/lignee/compare/v3.1.0...v3.2.0) (2026-11-11)

### Features

* Show the GitHub save button only when needed ([1176af9](https://github.com/PallierJean/lignee/commit/1176af9f809e7a1fc00f49bf459b51a63c11c11e))

---

### Nouveautés

* Le bouton « Sauvegarder sur GitHub » n'apparaît plus que lorsqu'il sert : la première sauvegarde d'un dépôt, ou « Réessayer l'envoi » après un échec. Le reste du temps, tout part tout seul. ([1176af9](https://github.com/PallierJean/lignee/commit/1176af9f809e7a1fc00f49bf459b51a63c11c11e))

## [3.1.0](https://github.com/PallierJean/lignee/compare/v3.0.0...v3.1.0) (2026-11-11)

### Features

* Zoom out to 35 percent for an overview ([09f0fca](https://github.com/PallierJean/lignee/commit/09f0fca0e436adced92475175f3e3ff96e16f606))

---

### Nouveautés

* Le zoom de l'arbre descend jusqu'à 35 %, pour une vue d'ensemble. ([09f0fca](https://github.com/PallierJean/lignee/commit/09f0fca0e436adced92475175f3e3ff96e16f606))

## [3.0.0](https://github.com/PallierJean/lignee/compare/v2.3.1...v3.0.0) (2026-11-11)

### ⚠ BREAKING CHANGES

* Format 1 backups (Lignée before 2.0) are no longer read. Open them with Lignée 2.3 first to convert them. ([af3916b](https://github.com/PallierJean/lignee/commit/af3916b4872e9affd0947a1ae326e046adb15d0d))

### Features

* Read and write format 2 only ([af3916b](https://github.com/PallierJean/lignee/commit/af3916b4872e9affd0947a1ae326e046adb15d0d))

---

### ⚠ Changements incompatibles

* Les sauvegardes au format 1 (Lignée avant 2.0) ne sont plus lues. Ouvrez-les d'abord avec Lignée 2.3 pour les convertir. ([af3916b](https://github.com/PallierJean/lignee/commit/af3916b4872e9affd0947a1ae326e046adb15d0d))

### Nouveautés

* Lignée ne lit plus que le format 2 : le code de conversion de l'ancien format est retiré. Un fichier d'avant la 2.0 est refusé avec un message clair. ([af3916b](https://github.com/PallierJean/lignee/commit/af3916b4872e9affd0947a1ae326e046adb15d0d))

## [2.3.1](https://github.com/PallierJean/lignee/compare/v2.3.0...v2.3.1) (2026-11-11)

### Bug Fixes

* Keep the marriage documents when merging duplicates ([884308f](https://github.com/PallierJean/lignee/commit/884308f8fcbaca8f043e42f3651ddab36d205b9f))

---

### Corrections

* Fusionner deux doublons ne perd plus l'acte de mariage porté par leur union. ([884308f](https://github.com/PallierJean/lignee/commit/884308f8fcbaca8f043e42f3651ddab36d205b9f))

## [2.3.0](https://github.com/PallierJean/lignee/compare/v2.2.0...v2.3.0) (2026-11-11)

### Features

* Save each change to the linked GitHub repository ([8b57531](https://github.com/PallierJean/lignee/commit/8b57531084831d605139b4be177784fd8e4a5abe))

---

### Nouveautés

* Avec un jeton en écriture, chaque modification de l'arbre part sur GitHub toute seule, quelques instants après l'avoir enregistrée. ([8b57531](https://github.com/PallierJean/lignee/commit/8b57531084831d605139b4be177784fd8e4a5abe))

## [2.2.0](https://github.com/PallierJean/lignee/compare/v2.1.1...v2.2.0) (2026-11-11)

### Features

* Convert online database trees to format 2 in one batch ([893406e](https://github.com/PallierJean/lignee/commit/893406e87e420d9b33e399a894b4be274a901edb))
* Marriage documents are cited by the union, seen by both spouses ([0573fbe](https://github.com/PallierJean/lignee/commit/0573fbed2bb7903623f39f8d7f22c176e9f5ad4d))
* Record a person's part in a document ([a19ebd0](https://github.com/PallierJean/lignee/commit/a19ebd0fd82f278d925a3c5515423ac9971e07b8))
* Cite a document already in the tree, and filter the Sources view ([c47b5f3](https://github.com/PallierJean/lignee/commit/c47b5f3b1829b0720f7da0c4e203940d24fd485d))
* Keep a copy of each tree before its first save in format 2 ([8de64f5](https://github.com/PallierJean/lignee/commit/8de64f57b7cc3f8b6f7dc1ecffe333720e42e2f8))

---

### Nouveautés

* Dans la base en ligne, un arbre d'avant la 2.0 est converti d'un coup par le premier visiteur, sous verrou, sans rien perdre. ([893406e](https://github.com/PallierJean/lignee/commit/893406e87e420d9b33e399a894b4be274a901edb))
* Les actes de mariage sont maintenant portés par l'union : les deux époux les voient sur leur fiche. Les arbres existants sont convertis à la lecture, sans rien perdre. ([0573fbe](https://github.com/PallierJean/lignee/commit/0573fbed2bb7903623f39f8d7f22c176e9f5ad4d))
* Une source peut indiquer le rôle de la personne dans l'acte : personne concernée, père, mère, conjoint ou témoin. Il apparaît sur la fiche et dans la vue Sources, et passe dans le GEDCOM. ([a19ebd0](https://github.com/PallierJean/lignee/commit/a19ebd0fd82f278d925a3c5515423ac9971e07b8))
* Dans le formulaire, vous pouvez citer un document déjà dans l'arbre au lieu d'en créer un nouveau. La vue Sources se filtre par nature et par recherche. ([c47b5f3](https://github.com/PallierJean/lignee/commit/c47b5f3b1829b0720f7da0c4e203940d24fd485d))
* En mode fichier, chaque arbre est copié tel quel avant son premier enregistrement au format 2 (data/arbres/<arbre>/avant-format-2.json), pour pouvoir revenir en arrière. ([8de64f5](https://github.com/PallierJean/lignee/commit/8de64f57b7cc3f8b6f7dc1ecffe333720e42e2f8))

## [2.1.1](https://github.com/PallierJean/lignee/compare/v2.1.0...v2.1.1) (2026-11-11)

### Bug Fixes

* Stay read-only when the local server is older than the page ([dc7017f](https://github.com/PallierJean/lignee/commit/dc7017f5d167b6c7ea81d6864a766a62645f8458))

---

### Corrections

* Après une mise à jour, si le serveur Lignée tourne encore avec l'ancienne version, l'arbre s'ouvre en lecture seule et demande de relancer npm start, au lieu de risquer de supprimer des photos d'actes. ([dc7017f](https://github.com/PallierJean/lignee/commit/dc7017f5d167b6c7ea81d6864a766a62645f8458))

## [2.1.0](https://github.com/PallierJean/lignee/compare/v2.0.0...v2.1.0) (2026-11-11)

### Features

* Show what a GitHub save would change before replacing a backup ([23d2517](https://github.com/PallierJean/lignee/commit/23d25176c735aa9037a439896ea7466fe73614bc))

### Bug Fixes

* Don't send every photo again when linking the open tree to a repository ([1f2176f](https://github.com/PallierJean/lignee/commit/1f2176f4fe3b21d75e623f5630de566043af79f7))
* Keep the whole French text in the release notes ([dc4b3dc](https://github.com/PallierJean/lignee/commit/dc4b3dc5d7c83bb1928d257ce9196fda1978cc59))

---

### Nouveautés

* Avant de remplacer une sauvegarde sur GitHub, une fenêtre liste ce qui changerait dans le dépôt : fiches ajoutées, retirées ou modifiées, sources et photos. Vous pouvez fusionner au lieu de remplacer. ([23d2517](https://github.com/PallierJean/lignee/commit/23d25176c735aa9037a439896ea7466fe73614bc))

### Corrections

* Relier l'arbre ouvert à un dépôt ne renvoie plus toutes les photos. La sauvegarde suivante retire aussi du dépôt les copies inutiles laissées par ce bogue ; elles restent dans son historique. ([1f2176f](https://github.com/PallierJean/lignee/commit/1f2176f4fe3b21d75e623f5630de566043af79f7))
* Les notes de version en français ne sont plus coupées après la première ligne. ([dc4b3dc](https://github.com/PallierJean/lignee/commit/dc4b3dc5d7c83bb1928d257ce9196fda1978cc59))

## [2.0.0](https://github.com/PallierJean/lignee/compare/v1.31.0...v2.0.0) (2026-11-11)

### ⚠ BREAKING CHANGES

* Backups are written in format 2. Lignée older than 1.31 would read them without their sources; 1.31 and later refuse them. Use "Backup for a Lignée version older than 2.0" in Export to write format 1. ([08206fd](https://github.com/PallierJean/lignee/commit/08206fd4fc0deb09f2540b60aa129af42b463ad5))

### Features

* Share sources between records (backup format 2) ([08206fd](https://github.com/PallierJean/lignee/commit/08206fd4fc0deb09f2540b60aa129af42b463ad5))

---

### ⚠ Changements incompatibles

* Les sauvegardes passent au format 2. Une Lignée antérieure à la 1.31 les lirait sans leurs sources ; la 1.31 et les suivantes les refusent. Pour produire l'ancien format, utilisez « Sauvegarde pour une version de Lignée antérieure à la 2.0 » dans Exporter. ([08206fd](https://github.com/PallierJean/lignee/commit/08206fd4fc0deb09f2540b60aa129af42b463ad5))

### Nouveautés

* Les sources sont maintenant partagées : un acte cité par plusieurs personnes, comme un acte de mariage, n'existe qu'une fois, avec sa photo. Nouvelle vue « Sources » dans l'onglet Analyse. Les sauvegardes passent au format 2 ; vos fichiers actuels sont convertis automatiquement, et l'export peut encore produire l'ancien format. ([08206fd](https://github.com/PallierJean/lignee/commit/08206fd4fc0deb09f2540b60aa129af42b463ad5))

## [1.31.0](https://github.com/PallierJean/lignee/compare/v1.30.0...v1.31.0) (2026-11-11)

### Features

* Refuse backups from a newer format version ([ab6f2e8](https://github.com/PallierJean/lignee/commit/ab6f2e814339e25e7f073b9f363155ba04c57e7e))

---

### Nouveautés

* Lignée refuse maintenant les arbres enregistrés par une version plus récente, avec un message clair, au lieu d'en perdre une partie. Cela prépare la version 2. ([ab6f2e8](https://github.com/PallierJean/lignee/commit/ab6f2e814339e25e7f073b9f363155ba04c57e7e))

## [1.30.0](https://github.com/PallierJean/lignee/compare/v1.29.0...v1.30.0) (2026-11-11)

### Features

* Show tree cards as portraits with a round photo ([44ba0eb](https://github.com/PallierJean/lignee/commit/44ba0ebc264a8ef1fae9080b83e870495ffbf6a8))
* Add a photo mode to the tree ([71e944e](https://github.com/PallierJean/lignee/commit/71e944e9d0ef8a08a000ee2e7d6362f325111490))

### Bug Fixes

* Apply the tree filters and photo mode to the fan chart ([2f242f2](https://github.com/PallierJean/lignee/commit/2f242f2fdc953a4aa505c4163af63dc776b6229d))

### Code Refactoring

* Split the animated scenes into one file per theme ([e6722d7](https://github.com/PallierJean/lignee/commit/e6722d7836a76f404287ed39f0cb83a23ad18d56))

---

### Nouveautés

* Les fiches de l'arbre passent en portrait, avec la photo ronde au-dessus du nom. Le halo de la lignée directe entoure maintenant la fiche sans cacher le bleu ou le rose, aussi en mode photos. ([44ba0eb](https://github.com/PallierJean/lignee/commit/44ba0ebc264a8ef1fae9080b83e870495ffbf6a8))
* Nouveau bouton « Photos » : l'arbre montre seulement les photos, en rond, et le nom apparaît au survol. Plus de personnes tiennent à l'écran ; l'impression garde les fiches complètes. ([71e944e](https://github.com/PallierJean/lignee/commit/71e944e9d0ef8a08a000ee2e7d6362f325111490))

### Corrections

* En éventail, les filtres « Vivants » et « N° d'acte » estompent maintenant les secteurs, et le mode « Photos » y montre les photos. « Lignée directe » y est grisé : tout l'éventail est déjà la lignée directe. ([2f242f2](https://github.com/PallierJean/lignee/commit/2f242f2fdc953a4aa505c4163af63dc776b6229d))

### Refontes

* Le code des décors animés est rangé en un fichier par thème, sans changement visible. ([e6722d7](https://github.com/PallierJean/lignee/commit/e6722d7836a76f404287ed39f0cb83a23ad18d56))

## [1.29.0](https://github.com/PallierJean/lignee/compare/v1.28.0...v1.29.0) (2026-11-11)

### Features

* Merge the repository's changes before saving to GitHub ([5d71581](https://github.com/PallierJean/lignee/commit/5d71581a4bb6a4d6f334ace50f8d7a2a7965f26f))
* Order the whole tree to keep families together ([91544ba](https://github.com/PallierJean/lignee/commit/91544baee0fff35b7d8b2f3af418917e5143aceb))

---

### Nouveautés

* Plusieurs personnes peuvent sauvegarder le même arbre sur GitHub : si le dépôt a changé, Lignée reprend ses modifications avant d'envoyer les vôtres, et demande laquelle garder quand une même information a été modifiée des deux côtés. ([5d71581](https://github.com/PallierJean/lignee/commit/5d71581a4bb6a4d6f334ace50f8d7a2a7965f26f))
* « Tout l'arbre » garde les familles groupées : enfants sous leurs parents, beaucoup moins de traits qui se croisent ([91544ba](https://github.com/PallierJean/lignee/commit/91544baee0fff35b7d8b2f3af418917e5143aceb))

## [1.28.0](https://github.com/PallierJean/lignee/compare/v1.27.0...v1.28.0) (2026-11-10)

### Features

* Filter the tree to the living or to known death certificates ([6100f5e](https://github.com/PallierJean/lignee/commit/6100f5e69ef8876cdaa83ba4a8460249e437020d))

---

### Nouveautés

* Filtres de l'arbre « Vivants » et « N° d'acte » (les autres fiches sont estompées) ([6100f5e](https://github.com/PallierJean/lignee/commit/6100f5e69ef8876cdaa83ba4a8460249e437020d))

## [1.27.0](https://github.com/PallierJean/lignee/compare/v1.26.3...v1.27.0) (2026-11-10)

### Features

* Stop offering death certificates already obtained ([77a8bc5](https://github.com/PallierJean/lignee/commit/77a8bc5212aa88dde03526203dcfbb97b960becb))
* Ask the departmental archives for deaths before 1800 ([0098114](https://github.com/PallierJean/lignee/commit/0098114ef1b53595542435667621601d9079bca6))

---

### Nouveautés

* La vue Actes ne propose plus les actes déjà obtenus (photo dans une source de décès) ([77a8bc5](https://github.com/PallierJean/lignee/commit/77a8bc5212aa88dde03526203dcfbb97b960becb))
* Avant 1800, les actes de décès se demandent aux archives départementales et non plus aux mairies ([0098114](https://github.com/PallierJean/lignee/commit/0098114ef1b53595542435667621601d9079bca6))

## [1.26.3](https://github.com/PallierJean/lignee/compare/v1.26.2...v1.26.3) (2026-11-10)

### Bug Fixes

* Keep the image counter on one line in the viewer ([0847d0d](https://github.com/PallierJean/lignee/commit/0847d0d8143137db595a849a0a1b78b303b9f52b))
* Stop the theme animations flickering at some browser zooms ([6488b27](https://github.com/PallierJean/lignee/commit/6488b27055af96c37224118d887bd3a298c3a9a2))

---

### Corrections

* Le compteur d'images de la visionneuse reste sur une ligne à côté d'un titre long ([0847d0d](https://github.com/PallierJean/lignee/commit/0847d0d8143137db595a849a0a1b78b303b9f52b))
* Les animations des thèmes ne clignotent plus avec certains zooms du navigateur (50, 90, 110 %) ([6488b27](https://github.com/PallierJean/lignee/commit/6488b27055af96c37224118d887bd3a298c3a9a2))

## [1.26.2](https://github.com/PallierJean/lignee/compare/v1.26.1...v1.26.2) (2026-11-10)

### Bug Fixes

* Keep the page to the screen width on a phone ([552911f](https://github.com/PallierJean/lignee/commit/552911fb69ffc940578eb2759d2d59405288430d))

---

### Corrections

* Sur téléphone, la page reste à la largeur de l'écran (fenêtres et menus ne débordent plus) ([552911f](https://github.com/PallierJean/lignee/commit/552911fb69ffc940578eb2759d2d59405288430d))

## [1.26.1](https://github.com/PallierJean/lignee/compare/v1.26.0...v1.26.1) (2026-11-10)

### Bug Fixes

* Close the import dialog once the repository is connected ([140f5a8](https://github.com/PallierJean/lignee/commit/140f5a8ef6dbc8ab05d5c19dc1f2570924c9f9b5))

---

### Corrections

* La fenêtre d'import se ferme une fois le dépôt connecté ([140f5a8](https://github.com/PallierJean/lignee/commit/140f5a8ef6dbc8ab05d5c19dc1f2570924c9f9b5))

## [1.26.0](https://github.com/PallierJean/lignee/compare/v1.25.0...v1.26.0) (2026-11-10)

### Features

* Pair a front and a back on a source's document ([9769f38](https://github.com/PallierJean/lignee/commit/9769f38b8d399e67af6476283c7d6fcb342ced5a))
* Pair a front and a back in the gallery ([5ab7fe6](https://github.com/PallierJean/lignee/commit/5ab7fe6713e307bbc3ea609208165ef1bc4ab026))
* Open the viewer on the images just added, to identify the people ([a1fe9bf](https://github.com/PallierJean/lignee/commit/a1fe9bf5686acfcf6fe95e322ebb1da629a8be54))
* Go from one gallery image to the next in the viewer ([b955d35](https://github.com/PallierJean/lignee/commit/b955d35515f1993537f857df5188aecd08cf6423))
* Add deaths before 1970 to the certificates to request ([1044ce1](https://github.com/PallierJean/lignee/commit/1044ce1d92c491cbf43c8760c1c093f3da1383a7))

### Bug Fixes

* Narrow the side panel on laptop screens ([c1671cd](https://github.com/PallierJean/lignee/commit/c1671cd003d8b572b3889c34f4e971d4f106c16a))

---

### Nouveautés

* Recto-verso sur le document d'une source (contrat de mariage, acte…) ([9769f38](https://github.com/PallierJean/lignee/commit/9769f38b8d399e67af6476283c7d6fcb342ced5a))
* Jumelage recto-verso des images de la galerie (contrats, actes, dos de photos annotés) ([5ab7fe6](https://github.com/PallierJean/lignee/commit/5ab7fe6713e307bbc3ea609208165ef1bc4ab026))
* Après l'ajout de photos à une fiche, la visionneuse s'ouvre dessus pour identifier les personnes ([a1fe9bf](https://github.com/PallierJean/lignee/commit/a1fe9bf5686acfcf6fe95e322ebb1da629a8be54))
* Passer d'une image à l'autre dans la visionneuse de la galerie (boutons et flèches du clavier) ([b955d35](https://github.com/PallierJean/lignee/commit/b955d35515f1993537f857df5188aecd08cf6423))
* Les décès d'avant 1970 rejoignent les actes à demander, sans numéro ([1044ce1](https://github.com/PallierJean/lignee/commit/1044ce1d92c491cbf43c8760c1c093f3da1383a7))

### Corrections

* Panneau latéral moins large sur les écrans d'ordinateur portable ([c1671cd](https://github.com/PallierJean/lignee/commit/c1671cd003d8b572b3889c34f4e971d4f106c16a))

## [1.25.0](https://github.com/PallierJean/lignee/compare/v1.24.0...v1.25.0) (2026-11-09)

### Features

* Link each town hall without an e-mail to its contact form ([ca6baae](https://github.com/PallierJean/lignee/commit/ca6baae2957ced01cada9a62101005cbf0cc6aa3))
* Prepare every town hall request with a single click ([d1b9b26](https://github.com/PallierJean/lignee/commit/d1b9b2657d871a59f9d354cc7aba6c7e81cbfd63))
* Copy the user's address on the prefilled e-mails to town halls ([43aa31c](https://github.com/PallierJean/lignee/commit/43aa31ca1c4438a9e254e83b7a4546f0ec26ab7c))
* Find each town hall and write to it with a prefilled e-mail ([78beed7](https://github.com/PallierJean/lignee/commit/78beed7dcfd24212c69d809eb564ef81e559485b))

### Bug Fixes

* Show the town hall messages as hints and explain a failed lookup ([cf7c2ad](https://github.com/PallierJean/lignee/commit/cf7c2ad6a9bdc15a18c16187a86fc638ef242f34))
* Show the merged communes note of a town hall as a hint ([4658c4e](https://github.com/PallierJean/lignee/commit/4658c4e1e1a6dccb60291ba1d2d80eecf6861f95))

---

### Nouveautés

* Chaque mairie sans adresse e-mail renvoie vers son formulaire de contact ([ca6baae](https://github.com/PallierJean/lignee/commit/ca6baae2957ced01cada9a62101005cbf0cc6aa3))
* Préparer toutes les demandes aux mairies d'un seul clic ([d1b9b26](https://github.com/PallierJean/lignee/commit/d1b9b2657d871a59f9d354cc7aba6c7e81cbfd63))
* Votre adresse e-mail mise en copie des e-mails préremplis aux mairies ([43aa31c](https://github.com/PallierJean/lignee/commit/43aa31ca1c4438a9e254e83b7a4546f0ec26ab7c))
* Trouver chaque mairie dans l'annuaire de service-public.fr et lui écrire un e-mail prérempli ([78beed7](https://github.com/PallierJean/lignee/commit/78beed7dcfd24212c69d809eb564ef81e559485b))

### Corrections

* Messages de la recherche de mairie en petit, et piste quand l'annuaire ne peut pas être joint ([cf7c2ad](https://github.com/PallierJean/lignee/commit/cf7c2ad6a9bdc15a18c16187a86fc638ef242f34))
* La mention des communes regroupées par une mairie s'affiche en petit, comme les autres indications ([4658c4e](https://github.com/PallierJean/lignee/commit/4658c4e1e1a6dccb60291ba1d2d80eecf6861f95))

## [1.24.0](https://github.com/PallierJean/lignee/compare/v1.23.1...v1.24.0) (2026-11-09)

### Features

* Export the whole certificate list, grouped by today's town hall ([8140315](https://github.com/PallierJean/lignee/commit/8140315ce74709367af7132eea7138552efd2971))

---

### Nouveautés

* Export de toute la liste des actes, regroupés par mairie d'aujourd'hui (communes fusionnées comprises) ([8140315](https://github.com/PallierJean/lignee/commit/8140315ce74709367af7132eea7138552efd2971))

## [1.23.1](https://github.com/PallierJean/lignee/compare/v1.23.0...v1.23.1) (2026-11-09)

### Bug Fixes

* Keep the tree toolbar on one line when the side panel is open ([0495e29](https://github.com/PallierJean/lignee/commit/0495e296657a1c4e1b9b8e3293d5bcc2459e3153))

---

### Corrections

* La barre de l'arbre reste sur une ligne quand la fiche est ouverte sur le côté ([0495e29](https://github.com/PallierJean/lignee/commit/0495e296657a1c4e1b9b8e3293d5bcc2459e3153))

## [1.23.0](https://github.com/PallierJean/lignee/compare/v1.22.0...v1.23.0) (2026-11-09)

### Features

* List the death certificates to request, grouped by town ([8ee0da8](https://github.com/PallierJean/lignee/commit/8ee0da8f522b6ab9de67424d59cdaca3f1eed1d7))

---

### Nouveautés

* Liste des actes de décès à demander, regroupés par commune ([8ee0da8](https://github.com/PallierJean/lignee/commit/8ee0da8f522b6ab9de67424d59cdaca3f1eed1d7))

## [1.22.0](https://github.com/PallierJean/lignee/compare/v1.21.2...v1.22.0) (2026-11-09)

### Features

* Show the copyright, licence and source code link under the page ([a743e3f](https://github.com/PallierJean/lignee/commit/a743e3fa1eace8d369196e54f99e6d0c156f5421))

---

### Nouveautés

* Copyright, licence et lien vers le code source en bas de la page ([a743e3f](https://github.com/PallierJean/lignee/commit/a743e3fa1eace8d369196e54f99e6d0c156f5421))

## [1.21.2](https://github.com/PallierJean/lignee/compare/v1.21.1...v1.21.2) (2026-11-09)

### Bug Fixes

* Credit OpenStreetMap contributors under the map ([28dbbec](https://github.com/PallierJean/lignee/commit/28dbbec8d6b1106157d33ea0874a9c25d4ff44f0))

---

### Corrections

* Mention des contributeurs d'OpenStreetMap sous la carte, exigée par la licence ODbL ([28dbbec](https://github.com/PallierJean/lignee/commit/28dbbec8d6b1106157d33ea0874a9c25d4ff44f0))

## [1.21.1](https://github.com/PallierJean/lignee/compare/v1.21.0...v1.21.1) (2026-11-09)

### Bug Fixes

* Show clearer icons for the Matrix and Star Wars themes ([b303d6c](https://github.com/PallierJean/lignee/commit/b303d6cbe7059cee3070bd5ea2ec49ac2006f3a8))

---

### Corrections

* Afficher des icônes plus parlantes pour les thèmes Matrix et Star Wars ([b303d6c](https://github.com/PallierJean/lignee/commit/b303d6cbe7059cee3070bd5ea2ec49ac2006f3a8))

## [1.21.0](https://github.com/PallierJean/lignee/compare/v1.20.14...v1.21.0) (2026-11-09)

### Features

* Give every person a laser sword of their own ([9b4f11d](https://github.com/PallierJean/lignee/commit/9b4f11deb5ea46d04358ed69f196ea3a8ec6dda9))
* Open a front line on the ice ([6d11ad8](https://github.com/PallierJean/lignee/commit/6d11ad87a5c34af6ddc5e2213cd351058a9c34b6))
* Detail the walker and let it fire at the airspeeders ([8e32b52](https://github.com/PallierJean/lignee/commit/8e32b529eb873740f0bca4f08c0cb459bdc34b93))
* Bring the Star Wars theme to life ([01f7391](https://github.com/PallierJean/lignee/commit/01f73914638557524d3b39e304ac8d2ad9cc27b3))
* Add the faraway galaxy theme ([a044d01](https://github.com/PallierJean/lignee/commit/a044d0183e72e9070e385c2ac8d8d72290a7ee18))

### Bug Fixes

* Give the purple sword to a person drawn at random ([a9684cd](https://github.com/PallierJean/lignee/commit/a9684cdad49f172c209884ac8eb522fd4d31b011))
* Aim the line's fire at the walkers and make it hit them ([fd3dd21](https://github.com/PallierJean/lignee/commit/fd3dd213e51870b54b9c2ff98f85fe9c70abd547))
* Wind the tow cable steadily round the walker ([a6243e9](https://github.com/PallierJean/lignee/commit/a6243e95c028210fb872c31b78e4a49c546c6862))
* Keep the tow cable on the walker while it falls ([dae01fd](https://github.com/PallierJean/lignee/commit/dae01fde6d07836665b3ef69a54a39bcece4242e))

---

### Nouveautés

* Donner à chaque personne son propre sabre laser ([9b4f11d](https://github.com/PallierJean/lignee/commit/9b4f11deb5ea46d04358ed69f196ea3a8ec6dda9))
* Ouvrir un front d'attaque sur la glace ([6d11ad8](https://github.com/PallierJean/lignee/commit/6d11ad87a5c34af6ddc5e2213cd351058a9c34b6))
* Détailler le marcheur et le faire tirer sur les airspeeders ([8e32b52](https://github.com/PallierJean/lignee/commit/8e32b529eb873740f0bca4f08c0cb459bdc34b93))
* Donner vie au thème Star Wars ([01f7391](https://github.com/PallierJean/lignee/commit/01f73914638557524d3b39e304ac8d2ad9cc27b3))
* Ajouter le thème Galaxie lointaine ([a044d01](https://github.com/PallierJean/lignee/commit/a044d0183e72e9070e385c2ac8d8d72290a7ee18))

### Corrections

* Donner le sabre violet à une personne tirée au hasard ([a9684cd](https://github.com/PallierJean/lignee/commit/a9684cdad49f172c209884ac8eb522fd4d31b011))
* Viser les marcheurs avec les tirs du front et les toucher ([fd3dd21](https://github.com/PallierJean/lignee/commit/fd3dd213e51870b54b9c2ff98f85fe9c70abd547))
* Enrouler le câble régulièrement autour du marcheur ([a6243e9](https://github.com/PallierJean/lignee/commit/a6243e95c028210fb872c31b78e4a49c546c6862))
* Garder le câble sur le marcheur pendant sa chute ([dae01fd](https://github.com/PallierJean/lignee/commit/dae01fde6d07836665b3ef69a54a39bcece4242e))

## [1.20.14](https://github.com/PallierJean/lignee/compare/v1.20.13...v1.20.14) (2026-11-09)

### Bug Fixes

* Write English cousin degrees with the right ordinal ([7ad4c75](https://github.com/PallierJean/lignee/commit/7ad4c75f35cfb51cc4df3d8226f4d5c30d84020e))

---

### Corrections

* Écrire en anglais le degré des cousins avec le bon ordinal ([7ad4c75](https://github.com/PallierJean/lignee/commit/7ad4c75f35cfb51cc4df3d8226f4d5c30d84020e))

## [1.20.13](https://github.com/PallierJean/lignee/compare/v1.20.12...v1.20.13) (2026-11-09)

### Code Refactoring

* Split the interface texts by language ([5ec3660](https://github.com/PallierJean/lignee/commit/5ec36601859de8b68cc55dde120d046ddbb3efff))

---

### Refontes

* Séparer les textes de l'interface par langue ([5ec3660](https://github.com/PallierJean/lignee/commit/5ec36601859de8b68cc55dde120d046ddbb3efff))

## [1.20.12](https://github.com/PallierJean/lignee/compare/v1.20.11...v1.20.12) (2026-11-09)

### Performance Improvements

* Load the theme animations only when an animated theme is shown ([fa50349](https://github.com/PallierJean/lignee/commit/fa503498799b202a11fc5939e96748bef8a72dc7))

---

### Performances

* Charger les animations de thème seulement quand un thème animé est affiché ([fa50349](https://github.com/PallierJean/lignee/commit/fa503498799b202a11fc5939e96748bef8a72dc7))

## [1.20.11](https://github.com/PallierJean/lignee/compare/v1.20.10...v1.20.11) (2026-11-09)

### Code Refactoring

* Compute generations in the model, not in the tree layout ([2a1e5e5](https://github.com/PallierJean/lignee/commit/2a1e5e5888556dde5bdb5f224dbecd92dbf6def9))

---

### Refontes

* Calculer les générations dans le modèle, pas dans le dessin de l'arbre ([2a1e5e5](https://github.com/PallierJean/lignee/commit/2a1e5e5888556dde5bdb5f224dbecd92dbf6def9))

## [1.20.10](https://github.com/PallierJean/lignee/compare/v1.20.9...v1.20.10) (2026-11-09)

### Code Refactoring

* Split actions.js by area ([b9a1f39](https://github.com/PallierJean/lignee/commit/b9a1f391ac1a1fdc33108a7943d54b2b0b5e0d9b))

---

### Refontes

* Découper actions.js par domaine ([b9a1f39](https://github.com/PallierJean/lignee/commit/b9a1f391ac1a1fdc33108a7943d54b2b0b5e0d9b))

## [1.20.9](https://github.com/PallierJean/lignee/compare/v1.20.8...v1.20.9) (2026-11-09)

### Performance Improvements

* Keep the consistency check until the data changes ([c15272b](https://github.com/PallierJean/lignee/commit/c15272bdbc6ad3e5fc8efe0cc615aff0bbd04343))

---

### Performances

* Garder la vérification de cohérence tant que les données ne changent pas ([c15272b](https://github.com/PallierJean/lignee/commit/c15272bdbc6ad3e5fc8efe0cc615aff0bbd04343))

## [1.20.8](https://github.com/PallierJean/lignee/compare/v1.20.7...v1.20.8) (2026-11-09)

### Bug Fixes

* Keep keyboard shortcuts off while the photo crop dialog is open ([c85831a](https://github.com/PallierJean/lignee/commit/c85831aa0650b2a2dda005cbd9da49e9eaa00cc9))

---

### Corrections

* Bloquer les raccourcis clavier pendant le recadrage d'une photo ([c85831a](https://github.com/PallierJean/lignee/commit/c85831aa0650b2a2dda005cbd9da49e9eaa00cc9))

## [1.20.7](https://github.com/PallierJean/lignee/compare/v1.20.6...v1.20.7) (2026-11-09)

### Code Refactoring

* Keep the list of dialogs in one place ([fb84e80](https://github.com/PallierJean/lignee/commit/fb84e805cd0446c4ab66e4b971ab7c930502be5f))

---

### Refontes

* Garder la liste des fenêtres à un seul endroit ([fb84e80](https://github.com/PallierJean/lignee/commit/fb84e805cd0446c4ab66e4b971ab7c930502be5f))

## [1.20.6](https://github.com/PallierJean/lignee/compare/v1.20.5...v1.20.6) (2026-11-09)

### Code Refactoring

* Let the storage notify the interface instead of importing it ([703a3f7](https://github.com/PallierJean/lignee/commit/703a3f76283d54007f07644b5e68f2d3a9098702))

---

### Refontes

* Laisser le stockage prévenir l'interface au lieu de l'importer ([703a3f7](https://github.com/PallierJean/lignee/commit/703a3f76283d54007f07644b5e68f2d3a9098702))

## [1.20.5](https://github.com/PallierJean/lignee/compare/v1.20.4...v1.20.5) (2026-11-09)

### Code Refactoring

* Save each action whole or not at all, in a single write ([0cb1733](https://github.com/PallierJean/lignee/commit/0cb1733b0b07278c65c3ff9e2e52b3e750cb9d76))

---

### Refontes

* Enregistrer chaque action en entier ou pas du tout, en une seule écriture ([0cb1733](https://github.com/PallierJean/lignee/commit/0cb1733b0b07278c65c3ff9e2e52b3e750cb9d76))

## [1.20.4](https://github.com/PallierJean/lignee/compare/v1.20.3...v1.20.4) (2026-11-09)

### Bug Fixes

* Show a message when an action fails for an unexpected reason ([647a9e7](https://github.com/PallierJean/lignee/commit/647a9e772a179088f6c0404627e978200ca2bc8e))

---

### Corrections

* Afficher un message quand une action échoue pour une raison inattendue ([647a9e7](https://github.com/PallierJean/lignee/commit/647a9e772a179088f6c0404627e978200ca2bc8e))

## [1.20.3](https://github.com/PallierJean/lignee/compare/v1.20.2...v1.20.3) (2026-11-09)

### Bug Fixes

* Report a failed browser save instead of claiming it was saved ([2066dbb](https://github.com/PallierJean/lignee/commit/2066dbb4d41e20fe6a9356023eaa6249db275bde))

---

### Corrections

* Signaler l'échec d'un enregistrement dans le navigateur au lieu d'annoncer « Enregistré » ([2066dbb](https://github.com/PallierJean/lignee/commit/2066dbb4d41e20fe6a9356023eaa6249db275bde))

## [1.20.2](https://github.com/PallierJean/lignee/compare/v1.20.1...v1.20.2) (2026-11-09)

### Bug Fixes

* Write the release notes in English, then in French ([49a98d9](https://github.com/PallierJean/lignee/commit/49a98d9d78110fe21235b712831ad02ab13b58d5))

---

### Corrections

* Écrire les notes de version en anglais, puis en français ([49a98d9](https://github.com/PallierJean/lignee/commit/49a98d9d78110fe21235b712831ad02ab13b58d5))

## [1.20.1](https://github.com/PallierJean/lignee/compare/v1.20.0...v1.20.1) (2026-11-09)

### Bug Fixes

* Ask what to do with a record being edited when switching person ([adab77a](https://github.com/PallierJean/lignee/commit/adab77ab3bc34b29799ac6ae3b0596b47360971c))
* Let the side panel scroll on phones ([c98f225](https://github.com/PallierJean/lignee/commit/c98f22564accd73218fd7976c4b2ce0e3f9825e2))

---

### Corrections

* Demander quoi faire de la fiche en cours de modification quand on change de personne ([adab77a](https://github.com/PallierJean/lignee/commit/adab77ab3bc34b29799ac6ae3b0596b47360971c))
* Laisser défiler le panneau latéral sur téléphone ([c98f225](https://github.com/PallierJean/lignee/commit/c98f22564accd73218fd7976c4b2ce0e3f9825e2))

## [1.20.0](https://github.com/PallierJean/lignee/compare/v1.19.1...v1.20.0) (2026-11-06)

### Features

* An app-like layout on phones ([e2a3250](https://github.com/PallierJean/lignee/commit/e2a325092a4b12c94e0fc10d419d3226b1ac196f))
* Warn that a browser-only tree must be exported ([54418fb](https://github.com/PallierJean/lignee/commit/54418fb96ae521df1b64826295828bc709103c8c))

---

### Nouveautés

* Une mise en page d'application sur téléphone ([e2a3250](https://github.com/PallierJean/lignee/commit/e2a325092a4b12c94e0fc10d419d3226b1ac196f))
* Prévenir qu'un arbre gardé seulement dans le navigateur doit être exporté ([54418fb](https://github.com/PallierJean/lignee/commit/54418fb96ae521df1b64826295828bc709103c8c))

## [1.19.1](https://github.com/PallierJean/lignee/compare/v1.19.0...v1.19.1) (2026-11-06)

### Bug Fixes

* Make the tree usable on phones ([1dfa6b9](https://github.com/PallierJean/lignee/commit/1dfa6b904463b72ab0099624e3080217c52aebd7))

---

### Corrections

* Rendre l'arbre utilisable sur téléphone ([1dfa6b9](https://github.com/PallierJean/lignee/commit/1dfa6b904463b72ab0099624e3080217c52aebd7))

## [1.19.0](https://github.com/PallierJean/lignee/compare/v1.18.0...v1.19.0) (2026-11-06)

### Features

* Grand Line, the crew on the deck of the pirate ship ([8f95c15](https://github.com/PallierJean/lignee/commit/8f95c150a6940f89c02b2f1a0a0c5c7662ed53bc))
* Grand Line, the navy chases the ship and the rubber-armed sailor catches his hat ([4d2188f](https://github.com/PallierJean/lignee/commit/4d2188f19213b2e11134849888a10831cb2ee323))
* Grand Line, a navy ship with a bulldog figurehead ([bf1d592](https://github.com/PallierJean/lignee/commit/bf1d592324999490f13cfd42ecf245521198d861))
* Grand Line, a real manga page ([81dd8e8](https://github.com/PallierJean/lignee/commit/81dd8e834b14774d5df15414486ef9d9c4173705))
* Grand Line theme, a pirate ship on a manga sea ([da9308e](https://github.com/PallierJean/lignee/commit/da9308e2ea06f6f55049fdb7164b08a113768358))

---

### Nouveautés

* Grand Line, l'équipage sur le pont du navire pirate ([8f95c15](https://github.com/PallierJean/lignee/commit/8f95c150a6940f89c02b2f1a0a0c5c7662ed53bc))
* Grand Line, la marine poursuit le navire et le matelot aux bras élastiques rattrape son chapeau ([4d2188f](https://github.com/PallierJean/lignee/commit/4d2188f19213b2e11134849888a10831cb2ee323))
* Grand Line, un navire de la marine à figure de proue de bouledogue ([bf1d592](https://github.com/PallierJean/lignee/commit/bf1d592324999490f13cfd42ecf245521198d861))
* Grand Line, une vraie planche de manga ([81dd8e8](https://github.com/PallierJean/lignee/commit/81dd8e834b14774d5df15414486ef9d9c4173705))
* Thème Grand Line, un navire pirate sur une mer de manga ([da9308e](https://github.com/PallierJean/lignee/commit/da9308e2ea06f6f55049fdb7164b08a113768358))

## [1.18.0](https://github.com/PallierJean/lignee/compare/v1.17.0...v1.18.0) (2026-11-06)

### Features

* Crop a record's photo when adding it ([dc5f9ff](https://github.com/PallierJean/lignee/commit/dc5f9ff533880d9d44864f62a807441dc50bdd39))

### Bug Fixes

* Marauder's Map without a repeated pattern ([dae7d10](https://github.com/PallierJean/lignee/commit/dae7d10c96b081dd37cd80f3caa7fd59195989e5))

---

### Nouveautés

* Recadrer la photo d'une fiche au moment de l'ajouter ([dc5f9ff](https://github.com/PallierJean/lignee/commit/dc5f9ff533880d9d44864f62a807441dc50bdd39))

### Corrections

* Carte du Maraudeur sans motif répété ([dae7d10](https://github.com/PallierJean/lignee/commit/dae7d10c96b081dd37cd80f3caa7fd59195989e5))

## [1.17.0](https://github.com/PallierJean/lignee/compare/v1.16.0...v1.17.0) (2026-11-06)

### Features

* Autumn with trees shedding their leaves, summer at the beach ([13f779a](https://github.com/PallierJean/lignee/commit/13f779a5144c30eacbb0ed567b4788916b7b4aef))
* Neutral avatar when the sex is not given ([400b3e1](https://github.com/PallierJean/lignee/commit/400b3e1fa7853242c4404bf45431f1bd7e6d0c1d))
* Marauder's Map, ink ornaments in the corners of the canvas ([f7b6087](https://github.com/PallierJean/lignee/commit/f7b6087c6bcf34a6b3bc40111b459c3d8fc3f274))
* Marauder's Map, a mansion plan and named walkers ([507851f](https://github.com/PallierJean/lignee/commit/507851f96ed23d44aafa559464264489f7614eea))
* Real-time constellations, larger and more spaced out ([5dc24d4](https://github.com/PallierJean/lignee/commit/5dc24d4a30106e7419488e0a5d0f6ce0387cc5dc))
* Constellations, lively and bright constellations ([066172a](https://github.com/PallierJean/lignee/commit/066172a0a49a0c983ee26e99d5cded6cb14332fc))
* Summer, a little shark in the water ([5381c8f](https://github.com/PallierJean/lignee/commit/5381c8f16967caed12a4865f31e9db44e611b806))
* Animated holidays and seasons; records readable on the starry sky ([e67633a](https://github.com/PallierJean/lignee/commit/e67633ac1950a4d888fc5d9274a6179eda4a8033))
* Livelier Halloween and spring, a rotating sky, gilded porcelain ([37e0caf](https://github.com/PallierJean/lignee/commit/37e0caf651f41eecce55a19d72ff0016afd8c47f))
* Eight illustrated themes on trial ([0df039b](https://github.com/PallierJean/lignee/commit/0df039bf252a04bbfcd3abab4ef8b3107f22d986))
* Christmas, a garland all around the canvas ([a068b64](https://github.com/PallierJean/lignee/commit/a068b642b712f9edc13d329f1b4041b5176150fb))
* Bolder porcelain, the central person on a ringed plate ([856d41a](https://github.com/PallierJean/lignee/commit/856d41ac8d14ac4286270bc222ac8ee4edcc212f))
* Matrix theme, reworked porcelain, five themes removed ([9a3dc97](https://github.com/PallierJean/lignee/commit/9a3dc97a24b87eec641620397371965012bb4ef0))
* The real sky of Bordeaux, Christmas snow, Matrix ([29c6f96](https://github.com/PallierJean/lignee/commit/29c6f96157fbf5f242dd454963144560a88cb548))

### Bug Fixes

* Scrolling fitted to the size of the tree, “Aa” menu kept within bounds ([daeea20](https://github.com/PallierJean/lignee/commit/daeea2036161a4e2e285c322bd8d3382876a5a56))
* A clear message when the server port is already in use ([f451a35](https://github.com/PallierJean/lignee/commit/f451a3535ff172b5d90e2427904552edc07a2543))
* Less bright porcelain ([4164c2c](https://github.com/PallierJean/lignee/commit/4164c2c378fe5bd226c65bc679c2fe8594be5ac5))

---

### Nouveautés

* Automne aux arbres qui perdent leurs feuilles, été à la plage ([13f779a](https://github.com/PallierJean/lignee/commit/13f779a5144c30eacbb0ed567b4788916b7b4aef))
* Avatar neutre quand le sexe n'est pas précisé ([400b3e1](https://github.com/PallierJean/lignee/commit/400b3e1fa7853242c4404bf45431f1bd7e6d0c1d))
* Carte du Maraudeur, ornements à l'encre aux coins de la toile ([f7b6087](https://github.com/PallierJean/lignee/commit/f7b6087c6bcf34a6b3bc40111b459c3d8fc3f274))
* Carte du Maraudeur, plan de demeure et promeneurs nommés ([507851f](https://github.com/PallierJean/lignee/commit/507851f96ed23d44aafa559464264489f7614eea))
* Constellations en temps réel, plus grandes et plus espacées ([5dc24d4](https://github.com/PallierJean/lignee/commit/5dc24d4a30106e7419488e0a5d0f6ce0387cc5dc))
* Constellations, constellations vivantes et brillantes ([066172a](https://github.com/PallierJean/lignee/commit/066172a0a49a0c983ee26e99d5cded6cb14332fc))
* Été, un petit requin dans l'eau ([5381c8f](https://github.com/PallierJean/lignee/commit/5381c8f16967caed12a4865f31e9db44e611b806))
* Fêtes et saisons animées ; fiches lisibles sur le ciel étoilé ([e67633a](https://github.com/PallierJean/lignee/commit/e67633ac1950a4d888fc5d9274a6179eda4a8033))
* Halloween et printemps plus vivants, ciel qui tourne, porcelaine dorée ([37e0caf](https://github.com/PallierJean/lignee/commit/37e0caf651f41eecce55a19d72ff0016afd8c47f))
* Huit thèmes illustrés à l'essai ([0df039b](https://github.com/PallierJean/lignee/commit/0df039bf252a04bbfcd3abab4ef8b3107f22d986))
* Noël, guirlande tout autour de la toile ([a068b64](https://github.com/PallierJean/lignee/commit/a068b642b712f9edc13d329f1b4041b5176150fb))
* Porcelaine plus franche, la personne au centre en plaque cerclée ([856d41a](https://github.com/PallierJean/lignee/commit/856d41ac8d14ac4286270bc222ac8ee4edcc212f))
* Thème Matrice, porcelaine retravaillée, cinq thèmes retirés ([9a3dc97](https://github.com/PallierJean/lignee/commit/9a3dc97a24b87eec641620397371965012bb4ef0))
* Vrai ciel de Bordeaux, neige de Noël, Matrix ([29c6f96](https://github.com/PallierJean/lignee/commit/29c6f96157fbf5f242dd454963144560a88cb548))

### Corrections

* Défilement à la taille de l'arbre, menu « Aa » contenu ([daeea20](https://github.com/PallierJean/lignee/commit/daeea2036161a4e2e285c322bd8d3382876a5a56))
* Message clair quand le port du serveur est déjà pris ([f451a35](https://github.com/PallierJean/lignee/commit/f451a3535ff172b5d90e2427904552edc07a2543))
* Porcelaine moins lumineuse ([4164c2c](https://github.com/PallierJean/lignee/commit/4164c2c378fe5bd226c65bc679c2fe8594be5ac5))

## [1.16.0](https://github.com/PallierJean/lignee/compare/v1.15.0...v1.16.0) (2026-11-05)

### Features

* “Go down to” offers every known descendant, by generation ([b0a46da](https://github.com/PallierJean/lignee/commit/b0a46da9211fec72e250f1857902fe206bf58e15))
* Explorable map: zoom, panning, departments, people of a town ([9a5cd97](https://github.com/PallierJean/lignee/commit/9a5cd97db916f26f9aadd3b8f935cf2039026277))
* INSEE, record number as a source and accents in first names ([dd135c4](https://github.com/PallierJean/lignee/commit/dd135c483e033946988c63a89ce7032f9d699f9b))
* “Go down to” list at every generation of the wheel ([5634248](https://github.com/PallierJean/lignee/commit/5634248368466b49a7ddc486afd89b401406561a))
* Marauder's Map, random footprints instead of a repeated pattern ([9a6b64d](https://github.com/PallierJean/lignee/commit/9a6b64df5ec5e0090cbbcc2d7490aad9efa21854))
* Marauder's Map, red footprints that walk then fade away ([2dc3c51](https://github.com/PallierJean/lignee/commit/2dc3c516702f9ed48fd0563afdca97157a4375e7))
* Ancestor wheel over 10 generations, cropped to the known ancestors ([445cf48](https://github.com/PallierJean/lignee/commit/445cf48d57f6f213caa24ed5d08c84dd4c3a4c16))
* Ancestor wheel, label on hover and recentering on double-click ([7ec01b8](https://github.com/PallierJean/lignee/commit/7ec01b80f435603df0ff6233797ac11e4a6abd74))
* Text size, dark high-contrast theme, highly visible focus ([fcdf82d](https://github.com/PallierJean/lignee/commit/fcdf82df6f769ef1013121354fe203df1fb66a59))
* “Marauder's Map” theme ([b62f07d](https://github.com/PallierJean/lignee/commit/b62f07dd5c0ce7910e3d560f0177cc8aae483826))
* Accessibility themes, color blindness and high contrast ([76ba1af](https://github.com/PallierJean/lignee/commit/76ba1afe91f4e24b920964940334ed619b35e0c9))
* Color themes, including Christmas, Halloween and the seasons ([15563bb](https://github.com/PallierJean/lignee/commit/15563bb0e2d42a86a3edfc4dbe6f73b5eb3ddf01))

### Bug Fixes

* Header on one line, theme and text size in an “Aa” menu ([fdfc65d](https://github.com/PallierJean/lignee/commit/fdfc65de6a4d4c5b2b4d4163394462ad80bc3dcc))
* INSEE, first names and surname can be copied over; dates in words ([1496a47](https://github.com/PallierJean/lignee/commit/1496a47c37196e6ce196b7b00b807a040807e1ea))
* INSEE, a record number in several words is no longer offered again ([41435a7](https://github.com/PallierJean/lignee/commit/41435a720e5738168346b26f2b3557c1bf9fcb1f))
* The map only looks up towns, not localities ([05aa3b7](https://github.com/PallierJean/lignee/commit/05aa3b762da6d24c3dfb4dc4df2c5d85d37dd4a6))
* The wheel no longer leaves a dead end after recentering ([855d75d](https://github.com/PallierJean/lignee/commit/855d75d7867f9193a563b3c3b03b7c29dbb40648))

---

### Nouveautés

* « Descendre vers » propose tous les descendants connus, par génération ([b0a46da](https://github.com/PallierJean/lignee/commit/b0a46da9211fec72e250f1857902fe206bf58e15))
* Carte explorable, zoom, déplacement, départements, personnes d'une commune ([9a5cd97](https://github.com/PallierJean/lignee/commit/9a5cd97db916f26f9aadd3b8f935cf2039026277))
* INSEE, numéro d'acte en source et accents des prénoms ([dd135c4](https://github.com/PallierJean/lignee/commit/dd135c483e033946988c63a89ce7032f9d699f9b))
* Liste « Descendre vers » à toutes les générations de la roue ([5634248](https://github.com/PallierJean/lignee/commit/5634248368466b49a7ddc486afd89b401406561a))
* Maraudeur, empreintes au hasard au lieu d'un motif répété ([9a6b64d](https://github.com/PallierJean/lignee/commit/9a6b64df5ec5e0090cbbcc2d7490aad9efa21854))
* Maraudeur, empreintes rouges qui avancent puis s'effacent ([2dc3c51](https://github.com/PallierJean/lignee/commit/2dc3c516702f9ed48fd0563afdca97157a4375e7))
* Roue d'ascendance sur 10 générations, recadrée sur les ancêtres connus ([445cf48](https://github.com/PallierJean/lignee/commit/445cf48d57f6f213caa24ed5d08c84dd4c3a4c16))
* Roue d'ascendance, étiquette au survol et recentrage d'un double-clic ([7ec01b8](https://github.com/PallierJean/lignee/commit/7ec01b80f435603df0ff6233797ac11e4a6abd74))
* Taille du texte, thème contraste élevé sombre, focus très visible ([fcdf82d](https://github.com/PallierJean/lignee/commit/fcdf82df6f769ef1013121354fe203df1fb66a59))
* Thème « Carte du Maraudeur » ([b62f07d](https://github.com/PallierJean/lignee/commit/b62f07dd5c0ce7910e3d560f0177cc8aae483826))
* Thèmes d'accessibilité, daltonisme et contraste élevé ([76ba1af](https://github.com/PallierJean/lignee/commit/76ba1afe91f4e24b920964940334ed619b35e0c9))
* Thèmes de couleur, dont Noël, Halloween et les saisons ([15563bb](https://github.com/PallierJean/lignee/commit/15563bb0e2d42a86a3edfc4dbe6f73b5eb3ddf01))

### Corrections

* En-tête sur une ligne, thème et taille du texte dans un menu « Aa » ([fdfc65d](https://github.com/PallierJean/lignee/commit/fdfc65de6a4d4c5b2b4d4163394462ad80bc3dcc))
* INSEE, prénoms et nom reportables ; dates en toutes lettres ([1496a47](https://github.com/PallierJean/lignee/commit/1496a47c37196e6ce196b7b00b807a040807e1ea))
* INSEE, un numéro d'acte en plusieurs mots n'est plus reproposé ([41435a7](https://github.com/PallierJean/lignee/commit/41435a720e5738168346b26f2b3557c1bf9fcb1f))
* La carte ne cherche que les communes, pas les lieux-dits ([05aa3b7](https://github.com/PallierJean/lignee/commit/05aa3b762da6d24c3dfb4dc4df2c5d85d37dd4a6))
* La roue ne laisse plus sans issue après un recentrage ([855d75d](https://github.com/PallierJean/lignee/commit/855d75d7867f9193a563b3c3b03b7c29dbb40648))

## [1.15.0](https://github.com/PallierJean/lignee/compare/v1.14.0...v1.15.0) (2026-11-05)

### Features

* Elegant label on identified faces ([091e500](https://github.com/PallierJean/lignee/commit/091e5003dff1074ba800a810185b9ec31e2bf9c5))
* Fonts served by the site, no more calls to Google Fonts ([84d5e35](https://github.com/PallierJean/lignee/commit/84d5e35961fdaa932e169b1e5677f721b7e7f393))

### Bug Fixes

* A face's label stays inside the photo near the edges ([f2010e7](https://github.com/PallierJean/lignee/commit/f2010e77b988a9bf7d380c59311983e6e225ed37))
* The local server only serves the application files ([9aa6433](https://github.com/PallierJean/lignee/commit/9aa64338c5c4cf72dd3a08a86a0078834d6d8c10))
* Refuse to be displayed inside another site's frame ([9557846](https://github.com/PallierJean/lignee/commit/9557846d140ccbc3319e381296cb746ebcea7be8))

---

### Nouveautés

* Étiquette élégante sur les visages identifiés ([091e500](https://github.com/PallierJean/lignee/commit/091e5003dff1074ba800a810185b9ec31e2bf9c5))
* Polices servies par le site, plus aucun appel à Google Fonts ([84d5e35](https://github.com/PallierJean/lignee/commit/84d5e35961fdaa932e169b1e5677f721b7e7f393))

### Corrections

* L'étiquette d'un visage reste dans la photo près des bords ([f2010e7](https://github.com/PallierJean/lignee/commit/f2010e77b988a9bf7d380c59311983e6e225ed37))
* Le serveur local ne sert que les fichiers de l'application ([9aa6433](https://github.com/PallierJean/lignee/commit/9aa64338c5c4cf72dd3a08a86a0078834d6d8c10))
* Refuser l'affichage dans le cadre d'un autre site ([9557846](https://github.com/PallierJean/lignee/commit/9557846d140ccbc3319e381296cb746ebcea7be8))

## [1.14.0](https://github.com/PallierJean/lignee/compare/v1.13.0...v1.14.0) (2026-11-05)

### Features

* Identify the people in a photo more easily ([380a196](https://github.com/PallierJean/lignee/commit/380a196013bbbb3cdeb00330a5fe8f2f22efc554))
* Edit a photo's caption from the viewer ([f611fb5](https://github.com/PallierJean/lignee/commit/f611fb5109ec67e800645986acffc13364711456))
* Invisible markers on photos, person highlighted when hovering their name ([1a6c0ea](https://github.com/PallierJean/lignee/commit/1a6c0ea1f13b5c4c8b28cc86016a72c9bf6020ad))
* Delete a record from its window or its form ([d518e0c](https://github.com/PallierJean/lignee/commit/d518e0cf5693dc9f972f874f9fd6b169774e85f3))

### Bug Fixes

* Confirm an INSEE lead, expiry date of the matchID connection ([8875279](https://github.com/PallierJean/lignee/commit/887527970b295ccd9d98ede6af6dfabcf3474421))
* Explain why the INSEE check is unavailable on the website ([99b96f4](https://github.com/PallierJean/lignee/commit/99b96f441acddaf4187934a8614cca63a39ac60e))
* Present the INSEE check as a feature of the local version ([40fff04](https://github.com/PallierJean/lignee/commit/40fff04b02990c3e0363ae92898dbe82d32d0598))

---

### Nouveautés

* Identifier les personnes d'une photo plus facilement ([380a196](https://github.com/PallierJean/lignee/commit/380a196013bbbb3cdeb00330a5fe8f2f22efc554))
* Modifier la légende d'une photo depuis la visionneuse ([f611fb5](https://github.com/PallierJean/lignee/commit/f611fb5109ec67e800645986acffc13364711456))
* Repères invisibles sur les photos, personne éclairée au survol de son nom ([1a6c0ea](https://github.com/PallierJean/lignee/commit/1a6c0ea1f13b5c4c8b28cc86016a72c9bf6020ad))
* Supprimer une fiche depuis sa fenêtre ou son formulaire ([d518e0c](https://github.com/PallierJean/lignee/commit/d518e0cf5693dc9f972f874f9fd6b169774e85f3))

### Corrections

* Confirmer une piste INSEE, date d'expiration de la connexion matchID ([8875279](https://github.com/PallierJean/lignee/commit/887527970b295ccd9d98ede6af6dfabcf3474421))
* Expliquer pourquoi la vérification INSEE est indisponible sur le site ([99b96f4](https://github.com/PallierJean/lignee/commit/99b96f441acddaf4187934a8614cca63a39ac60e))
* Présenter la vérification INSEE comme une fonctionnalité de la version locale ([40fff04](https://github.com/PallierJean/lignee/commit/40fff04b02990c3e0363ae92898dbe82d32d0598))

## [1.13.0](https://github.com/PallierJean/lignee/compare/v1.12.0...v1.13.0) (2026-11-04)

### Features

* Example family with married names, a birth abroad and a double surname ([1439837](https://github.com/PallierJean/lignee/commit/1439837fd6f5b32eafac843561e1c976b1eaade9))
* Do not suggest a child for a person under 18 ([f073d69](https://github.com/PallierJean/lignee/commit/f073d6936794d1ac32b092bcbafbe32c2134cf41))
* Do not suggest a union before 15 ([5131077](https://github.com/PallierJean/lignee/commit/5131077d588be184a70a54a11f899f8afebe68cd))
* Number of ancestors suggested according to the central person ([2118472](https://github.com/PallierJean/lignee/commit/21184725f4436d068828ba947d6e96a33b7ee54e))
* Number of descendants suggested according to the central person ([3f870e8](https://github.com/PallierJean/lignee/commit/3f870e848ac1b562a77b5302e60ff4fbf279b695))
* Suggest a child from age 17 ([e554930](https://github.com/PallierJean/lignee/commit/e5549303e10ef89aa278d02616796ac0fe29fe6a))

### Bug Fixes

* Accept the father's and mother's double surname in the consistency check ([daa6ccd](https://github.com/PallierJean/lignee/commit/daa6ccd4080d2114d75dc2600f480dfb362a5886))

---

### Nouveautés

* Famille d'exemple avec noms d'épouse, naissance à l'étranger et double nom ([1439837](https://github.com/PallierJean/lignee/commit/1439837fd6f5b32eafac843561e1c976b1eaade9))
* Ne pas proposer d'enfant à une personne de moins de 18 ans ([f073d69](https://github.com/PallierJean/lignee/commit/f073d6936794d1ac32b092bcbafbe32c2134cf41))
* Ne pas proposer d'union avant 15 ans ([5131077](https://github.com/PallierJean/lignee/commit/5131077d588be184a70a54a11f899f8afebe68cd))
* Nombre d'ascendants proposé selon la personne centrale ([2118472](https://github.com/PallierJean/lignee/commit/21184725f4436d068828ba947d6e96a33b7ee54e))
* Nombre de descendants proposé selon la personne centrale ([3f870e8](https://github.com/PallierJean/lignee/commit/3f870e848ac1b562a77b5302e60ff4fbf279b695))
* Proposer un enfant dès 17 ans ([e554930](https://github.com/PallierJean/lignee/commit/e5549303e10ef89aa278d02616796ac0fe29fe6a))

### Corrections

* Accepter le double nom du père et de la mère dans la cohérence ([daa6ccd](https://github.com/PallierJean/lignee/commit/daa6ccd4080d2114d75dc2600f480dfb362a5886))

## [1.12.0](https://github.com/PallierJean/lignee/compare/v1.11.0...v1.12.0) (2026-11-04)

### Features

* Country field in places, France by default ([f8194b8](https://github.com/PallierJean/lignee/commit/f8194b84440741c9d0eeb0f8b05a1120b9075d48))
* Taller tree records, more readable maiden name ([386f0c4](https://github.com/PallierJean/lignee/commit/386f0c4c59fdae4c4f3dbb196c311abe59e02e0a))
* Maiden name on its own line on tree records ([0836ab4](https://github.com/PallierJean/lignee/commit/0836ab426ff398b890154f26060010c6e4d25a75))

### Bug Fixes

* Sign in to matchID when anonymous use is exhausted ([ebe1dcd](https://github.com/PallierJean/lignee/commit/ebe1dcd6adc87a322cfce2661b4a2ec8433e9e6d))

---

### Nouveautés

* Champ Pays dans les lieux, France par défaut ([f8194b8](https://github.com/PallierJean/lignee/commit/f8194b84440741c9d0eeb0f8b05a1120b9075d48))
* Fiches de l'arbre plus hautes, nom de jeune fille plus lisible ([386f0c4](https://github.com/PallierJean/lignee/commit/386f0c4c59fdae4c4f3dbb196c311abe59e02e0a))
* Nom de jeune fille à la ligne sur les fiches de l'arbre ([0836ab4](https://github.com/PallierJean/lignee/commit/0836ab426ff398b890154f26060010c6e4d25a75))

### Corrections

* Connexion à matchID quand l'usage anonyme est épuisé ([ebe1dcd](https://github.com/PallierJean/lignee/commit/ebe1dcd6adc87a322cfce2661b4a2ec8433e9e6d))

## [1.11.0](https://github.com/PallierJean/lignee/compare/v1.10.0...v1.11.0) (2026-11-03)

### Features

* Sort the Places view by department, town then locality ([d074fcf](https://github.com/PallierJean/lignee/commit/d074fcf2f414a17f5ddf253a5c828d89a8721794))
* Check records against the INSEE death register ([c7c6d32](https://github.com/PallierJean/lignee/commit/c7c6d32a058a752c15a62ec3366b06d925931fb9))

### Bug Fixes

* Keep the “Not a duplicate” choice after reloading ([e8347ac](https://github.com/PallierJean/lignee/commit/e8347ac783ab73a786042cea41129c11aaa089db))
* Help text of the Places view, sorted by department ([f5d39b5](https://github.com/PallierJean/lignee/commit/f5d39b5aa9182a09a95b14cc54418a5540f979ce))

---

### Nouveautés

* Ranger la vue Lieux par département, ville puis lieu-dit ([d074fcf](https://github.com/PallierJean/lignee/commit/d074fcf2f414a17f5ddf253a5c828d89a8721794))
* Vérifier les fiches dans le fichier des décès de l'INSEE ([c7c6d32](https://github.com/PallierJean/lignee/commit/c7c6d32a058a752c15a62ec3366b06d925931fb9))

### Corrections

* Garder le choix « Ce n'est pas un doublon » après rechargement ([e8347ac](https://github.com/PallierJean/lignee/commit/e8347ac783ab73a786042cea41129c11aaa089db))
* Texte d'aide de la vue Lieux, rangée par département ([f5d39b5](https://github.com/PallierJean/lignee/commit/f5d39b5aa9182a09a95b14cc54418a5540f979ce))

## [1.10.0](https://github.com/PallierJean/lignee/compare/v1.9.0...v1.10.0) (2026-11-03)

### Features

* Show the department name from its number ([5f27cc3](https://github.com/PallierJean/lignee/commit/5f27cc30b1ab7e84acdb355eb0f1d32128003e06))
* Infer the department from the town and report mismatches ([9b4feed](https://github.com/PallierJean/lignee/commit/9b4feedb9d4bd39e20674665cdddc39f76f36b14))

### Bug Fixes

* Rename a place even while a record is being edited ([d427ca0](https://github.com/PallierJean/lignee/commit/d427ca0f21ea0dc35c188ede27758129b2bddf71))

---

### Nouveautés

* Afficher le nom du département d'après son numéro ([5f27cc3](https://github.com/PallierJean/lignee/commit/5f27cc30b1ab7e84acdb355eb0f1d32128003e06))
* Déduire le département de la ville et signaler les écarts ([9b4feed](https://github.com/PallierJean/lignee/commit/9b4feedb9d4bd39e20674665cdddc39f76f36b14))

### Corrections

* Renommer un lieu même pendant la saisie d'une fiche ([d427ca0](https://github.com/PallierJean/lignee/commit/d427ca0f21ea0dc35c188ede27758129b2bddf71))

## [1.9.0](https://github.com/PallierJean/lignee/compare/v1.8.0...v1.9.0) (2026-11-03)

### Features

* Check family links in the consistency check ([8f110e9](https://github.com/PallierJean/lignee/commit/8f110e9eec7b90975b2f71575890b20c074471a9))
* Compact layout to print the whole tree ([1e2080d](https://github.com/PallierJean/lignee/commit/1e2080d0b799fbe11c90df026741eb9db408e914))
* Print in A1 and A0 and suggest the readable size ([5849392](https://github.com/PallierJean/lignee/commit/58493924f06d4c17362a3c902df3d34ad1f63dfd))
* Complete family book, one chapter per branch ([2460c62](https://github.com/PallierJean/lignee/commit/2460c6237824189396c67de48ef6604f37915697))
* Enter places as town, locality and department and rename them everywhere ([dda55cc](https://github.com/PallierJean/lignee/commit/dda55cc002c78436dbfef6c42c5e5acf919b934e))
* Record completeness score and direct line to complete ([afc8b12](https://github.com/PallierJean/lignee/commit/afc8b12bb9f2c623ed8800aa0010204799eed6e7))

### Bug Fixes

* Complete book, timeline overflowing the page and duplicated unions ([2df6364](https://github.com/PallierJean/lignee/commit/2df6364e3f3a67783d7c363b34fd097b1de5ad35))
* No longer cut off the right of the tree when printing ([b1ee8aa](https://github.com/PallierJean/lignee/commit/b1ee8aa3a8be67477220c804f3c87e42d414ec26))

### Reverts

* Remove the record completeness score ([5ef37a1](https://github.com/PallierJean/lignee/commit/5ef37a19928e2fc92abb4e2860a0f597793e839d))

---

### Nouveautés

* Contrôler les liens familiaux dans la cohérence ([8f110e9](https://github.com/PallierJean/lignee/commit/8f110e9eec7b90975b2f71575890b20c074471a9))
* Disposition compacte pour imprimer l'arbre complet ([1e2080d](https://github.com/PallierJean/lignee/commit/1e2080d0b799fbe11c90df026741eb9db408e914))
* Imprimer en A1 et A0 et proposer le format lisible ([5849392](https://github.com/PallierJean/lignee/commit/58493924f06d4c17362a3c902df3d34ad1f63dfd))
* Livre de famille complet, un chapitre par branche ([2460c62](https://github.com/PallierJean/lignee/commit/2460c6237824189396c67de48ef6604f37915697))
* Saisir les lieux en ville, lieu-dit et département et les renommer partout ([dda55cc](https://github.com/PallierJean/lignee/commit/dda55cc002c78436dbfef6c42c5e5acf919b934e))
* Score de complétude des fiches et lignée directe à compléter ([afc8b12](https://github.com/PallierJean/lignee/commit/afc8b12bb9f2c623ed8800aa0010204799eed6e7))

### Corrections

* Livre complet, frise qui débordait de la page et unions en double ([2df6364](https://github.com/PallierJean/lignee/commit/2df6364e3f3a67783d7c363b34fd097b1de5ad35))
* Ne plus couper la droite de l'arbre à l'impression ([b1ee8aa](https://github.com/PallierJean/lignee/commit/b1ee8aa3a8be67477220c804f3c87e42d414ec26))

### Annulations

* Retirer le score de complétude des fiches ([5ef37a1](https://github.com/PallierJean/lignee/commit/5ef37a19928e2fc92abb4e2860a0f597793e839d))

## [1.8.0](https://github.com/PallierJean/lignee/compare/v1.7.0...v1.8.0) (2026-11-03)

### Features

* Fit the choice of ancestors to the depth of the tree ([b6c316b](https://github.com/PallierJean/lignee/commit/b6c316ba44b7aec9f607c47aa7548e34c49e6078))
* Limit the ancestor selector to four visible values ([1bd11ab](https://github.com/PallierJean/lignee/commit/1bd11ab7343c2ac7f9e3d96999aad88191bcd40d))

---

### Nouveautés

* Adapter le choix des ascendants à la profondeur de l'arbre ([b6c316b](https://github.com/PallierJean/lignee/commit/b6c316ba44b7aec9f607c47aa7548e34c49e6078))
* Limiter le sélecteur d'ascendants à quatre valeurs visibles ([1bd11ab](https://github.com/PallierJean/lignee/commit/1bd11ab7343c2ac7f9e3d96999aad88191bcd40d))

## [1.7.0](https://github.com/PallierJean/lignee/compare/v1.6.1...v1.7.0) (2026-11-02)

### Features

* Keep the situation and the unions in step, add remarriage ([e96c2a9](https://github.com/PallierJean/lignee/commit/e96c2a99d0178121c810d8d018d137bdabd2d892))
* Translate known occupations when the language changes ([5b4f61a](https://github.com/PallierJean/lignee/commit/5b4f61a9b12915ef72007c8452cc2b35b4ac7d87))

### Bug Fixes

* Translate “Contracts lawyer” as “avocat en droit des contrats” ([efa5f3a](https://github.com/PallierJean/lignee/commit/efa5f3ab93f10a921b637e745f83b9148b584025))

---

### Nouveautés

* Synchroniser la situation et les unions, ajouter le remariage ([e96c2a9](https://github.com/PallierJean/lignee/commit/e96c2a99d0178121c810d8d018d137bdabd2d892))
* Traduire les professions connues au changement de langue ([5b4f61a](https://github.com/PallierJean/lignee/commit/5b4f61a9b12915ef72007c8452cc2b35b4ac7d87))

### Corrections

* Traduire Contracts lawyer par avocat en droit des contrats ([efa5f3a](https://github.com/PallierJean/lignee/commit/efa5f3ab93f10a921b637e745f83b9148b584025))

## [1.6.1](https://github.com/PallierJean/lignee/compare/v1.6.0...v1.6.1) (2026-11-01)

### Bug Fixes

* No longer show a stray line with 0 ancestors ([03cc42b](https://github.com/PallierJean/lignee/commit/03cc42b899a8db907b2612a58dd204b7b3cb723d))

---

### Corrections

* Ne plus afficher de trait orphelin avec 0 ascendant ([03cc42b](https://github.com/PallierJean/lignee/commit/03cc42b899a8db907b2612a58dd204b7b3cb723d))

## [1.6.0](https://github.com/PallierJean/lignee/compare/v1.5.0...v1.6.0) (2026-11-01)

### Features

* Show ancestors from 0 to 7 in a sliding window ([b3f5ffc](https://github.com/PallierJean/lignee/commit/b3f5ffc1fb3d4f52c205ae753d3a36d9a9fde12b))
* Hide or show the record panel ([3aa1025](https://github.com/PallierJean/lignee/commit/3aa1025b6406347eb5cc3a1cd36e80b2926124ee))
* Allow closing the example and local mode banners ([4fd5b26](https://github.com/PallierJean/lignee/commit/4fd5b264522afb5b3d881972858a72f8cec48da3))

### Bug Fixes

* Close the import window once the new tree is open ([765b2e8](https://github.com/PallierJean/lignee/commit/765b2e8e496829f6373d11dd64255863ad1e230a))
* Open a GitHub repository in a new tree ([cba9db0](https://github.com/PallierJean/lignee/commit/cba9db02d1e760e53c2f9db794d8cccfd521ccfb))
* Shrink the repository banner to one line ([84e4157](https://github.com/PallierJean/lignee/commit/84e415727d54a83f0be73ebfd5a33d1ce9646d69))

---

### Nouveautés

* Afficher les ascendants de 0 à 7 dans une fenêtre glissante ([b3f5ffc](https://github.com/PallierJean/lignee/commit/b3f5ffc1fb3d4f52c205ae753d3a36d9a9fde12b))
* Masquer ou afficher le panneau de la fiche ([3aa1025](https://github.com/PallierJean/lignee/commit/3aa1025b6406347eb5cc3a1cd36e80b2926124ee))
* Pouvoir fermer les bandeaux d'exemple et de mode local ([4fd5b26](https://github.com/PallierJean/lignee/commit/4fd5b264522afb5b3d881972858a72f8cec48da3))

### Corrections

* Fermer la fenêtre d'import une fois le nouvel arbre ouvert ([765b2e8](https://github.com/PallierJean/lignee/commit/765b2e8e496829f6373d11dd64255863ad1e230a))
* Ouvrir un dépôt GitHub dans un nouvel arbre ([cba9db0](https://github.com/PallierJean/lignee/commit/cba9db02d1e760e53c2f9db794d8cccfd521ccfb))
* Réduire le bandeau du dépôt à une ligne ([84e4157](https://github.com/PallierJean/lignee/commit/84e415727d54a83f0be73ebfd5a33d1ce9646d69))

## [1.5.0](https://github.com/PallierJean/lignee/compare/v1.4.0...v1.5.0) (2026-10-31)

### Features

* Combine signing in and loading the repository into a single button ([ccde1e2](https://github.com/PallierJean/lignee/commit/ccde1e2e6a85c31496b7abc57ae9ee94a1b8581a))

---

### Nouveautés

* Réunir la connexion et le chargement du dépôt en un seul bouton ([ccde1e2](https://github.com/PallierJean/lignee/commit/ccde1e2e6a85c31496b7abc57ae9ee94a1b8581a))

## [1.4.0](https://github.com/PallierJean/lignee/compare/v1.3.0...v1.4.0) (2026-10-31)

### Features

* Separate the Import and Export windows ([cb34301](https://github.com/PallierJean/lignee/commit/cb34301c033c8af3c61d488f049336664c2a954a))

### Bug Fixes

* No longer mistake a delayed GitHub read for a conflict ([71aa908](https://github.com/PallierJean/lignee/commit/71aa908e5cc1b53ca29648b885a3610a63d7162f))
* Name photos after the person ([b37a057](https://github.com/PallierJean/lignee/commit/b37a0570960585d680eeef4ffebc1707db2bdeea))
* Name photos NOM-Prénom-<uuid> ([3f8d754](https://github.com/PallierJean/lignee/commit/3f8d754c62db6438d8a8f1b32631169916499479))
* Share the couple status with the partner ([988b3d2](https://github.com/PallierJean/lignee/commit/988b3d2f384655758d6f4836d6b38bda0a3b943a))
* Recenter the tree and the wheel in every view ([75be4c8](https://github.com/PallierJean/lignee/commit/75be4c865b863f441b9cec826727810e1601fbb6))

---

### Nouveautés

* Séparer les fenêtres Importer et Exporter ([cb34301](https://github.com/PallierJean/lignee/commit/cb34301c033c8af3c61d488f049336664c2a954a))

### Corrections

* Ne plus prendre une lecture retardée de GitHub pour un conflit ([71aa908](https://github.com/PallierJean/lignee/commit/71aa908e5cc1b53ca29648b885a3610a63d7162f))
* Nommer les photos d'après la personne ([b37a057](https://github.com/PallierJean/lignee/commit/b37a0570960585d680eeef4ffebc1707db2bdeea))
* Nommer les photos NOM-Prénom-<uuid> ([3f8d754](https://github.com/PallierJean/lignee/commit/3f8d754c62db6438d8a8f1b32631169916499479))
* Partager le statut de couple avec le partenaire ([988b3d2](https://github.com/PallierJean/lignee/commit/988b3d2f384655758d6f4836d6b38bda0a3b943a))
* Recentrer l'arbre et la roue dans toutes les vues ([75be4c8](https://github.com/PallierJean/lignee/commit/75be4c865b863f441b9cec826727810e1601fbb6))

## [1.3.0](https://github.com/PallierJean/lignee/compare/v1.2.0...v1.3.0) (2026-10-30)

### Features

* Connect the open tree to a repository and save it in one click ([e89e4b2](https://github.com/PallierJean/lignee/commit/e89e4b249bb04268459cdd059c675dacbd5d8045))
* Push the tree and its photos back to the GitHub repository ([4e09838](https://github.com/PallierJean/lignee/commit/4e0983871a5a586836fb7527e09175a8288bcc75))

---

### Nouveautés

* Connecter l'arbre ouvert à un dépôt et le sauvegarder d'un clic ([e89e4b2](https://github.com/PallierJean/lignee/commit/e89e4b249bb04268459cdd059c675dacbd5d8045))
* Renvoyer l'arbre et ses photos vers le dépôt GitHub ([4e09838](https://github.com/PallierJean/lignee/commit/4e0983871a5a586836fb7527e09175a8288bcc75))

## [1.2.0](https://github.com/PallierJean/lignee/compare/v1.1.0...v1.2.0) (2026-10-30)

### Features

* Open the example family on the first visit ([23ea7af](https://github.com/PallierJean/lignee/commit/23ea7af33cb54cc5a8719d197e39739f931f69b9))

---

### Nouveautés

* Ouvrir la famille d'exemple à la première visite ([23ea7af](https://github.com/PallierJean/lignee/commit/23ea7af33cb54cc5a8719d197e39739f931f69b9))

## [1.1.0](https://github.com/PallierJean/lignee/compare/v1.0.0...v1.1.0) (2026-10-30)

### Features

* Load a backup and its photos from a GitHub repository ([1ac3793](https://github.com/PallierJean/lignee/commit/1ac3793466d0611e589ecd3d055400fc199fffee))

### Bug Fixes

* Clear the GitHub token as soon as it is read ([9a5f0ae](https://github.com/PallierJean/lignee/commit/9a5f0aeed58612ed3ae27bf40bd9e836cb2a1d29))

---

### Nouveautés

* Charger une sauvegarde et ses photos depuis un dépôt GitHub ([1ac3793](https://github.com/PallierJean/lignee/commit/1ac3793466d0611e589ecd3d055400fc199fffee))

### Corrections

* Effacer le jeton GitHub dès sa lecture ([9a5f0ae](https://github.com/PallierJean/lignee/commit/9a5f0aeed58612ed3ae27bf40bd9e836cb2a1d29))

## 1.0.0 (2026-10-30)

### Features

* Undo / redo and storage ([7ee002b](https://github.com/PallierJean/lignee/commit/7ee002b09967b3d3ef7c5f8b7f8f266ece5330ef))
* Relationship calculator ([587ea10](https://github.com/PallierJean/lignee/commit/587ea101ba629cf8bb6ecc0dd00d1166ad6cd021))
* Map of places and migrations ([09f5855](https://github.com/PallierJean/lignee/commit/09f58552228ae916edf5e465ef7038d9b3579375))
* Duplicate detection and record merging ([8f17d10](https://github.com/PallierJean/lignee/commit/8f17d10bb1a657d698e419ec91462c3b38894083))
* On this day ([603d0b9](https://github.com/PallierJean/lignee/commit/603d0b9b5dff3ee948b7eb228ae93718239ca32d))
* Register export to CSV ([0f1b372](https://github.com/PallierJean/lignee/commit/0f1b3722847ae607fe44c292aad712d3820bb19f))
* Timeline ([077eb43](https://github.com/PallierJean/lignee/commit/077eb438aa6f42fa06085a051a7b934766d0cdb6))
* Gallery and identification on photos ([c153627](https://github.com/PallierJean/lignee/commit/c153627befbe0600c75a399ef270b5baecf1b2db))
* Printing over several sheets ([74dc319](https://github.com/PallierJean/lignee/commit/74dc319022d50feb551aea9ca27889053d41c865))
* Application interface ([4190ddc](https://github.com/PallierJean/lignee/commit/4190ddc2290eb2e29a392762ad9b718f2e7672ea))
* Family record books ([fb03700](https://github.com/PallierJean/lignee/commit/fb03700d5613bebd1f9352049eaf1cbe0ff4aca7))
* Ancestor wheel ([0cc36ec](https://github.com/PallierJean/lignee/commit/0cc36ece57f96e1a948e49605976e4f39c2abf0f))
* Tree statistics ([99bd95a](https://github.com/PallierJean/lignee/commit/99bd95a68af11f87a18b7953f28d0bbb11447cff))
* Consistency check ([e200acf](https://github.com/PallierJean/lignee/commit/e200acff262eeeb33316a6718637b2a89f4cc33e))

---

### Nouveautés

* Annuler / rétablir et stockage ([7ee002b](https://github.com/PallierJean/lignee/commit/7ee002b09967b3d3ef7c5f8b7f8f266ece5330ef))
* Calcul du lien de parenté ([587ea10](https://github.com/PallierJean/lignee/commit/587ea101ba629cf8bb6ecc0dd00d1166ad6cd021))
* Carte des lieux et des migrations ([09f5855](https://github.com/PallierJean/lignee/commit/09f58552228ae916edf5e465ef7038d9b3579375))
* Détection des doublons et fusion de fiches ([8f17d10](https://github.com/PallierJean/lignee/commit/8f17d10bb1a657d698e419ec91462c3b38894083))
* Éphémérides ([603d0b9](https://github.com/PallierJean/lignee/commit/603d0b9b5dff3ee948b7eb228ae93718239ca32d))
* Export du registre en CSV ([0f1b372](https://github.com/PallierJean/lignee/commit/0f1b3722847ae607fe44c292aad712d3820bb19f))
* Frise chronologique ([077eb43](https://github.com/PallierJean/lignee/commit/077eb438aa6f42fa06085a051a7b934766d0cdb6))
* Galerie et identification sur les photos ([c153627](https://github.com/PallierJean/lignee/commit/c153627befbe0600c75a399ef270b5baecf1b2db))
* Impression sur plusieurs feuilles ([74dc319](https://github.com/PallierJean/lignee/commit/74dc319022d50feb551aea9ca27889053d41c865))
* Interface de l'application ([4190ddc](https://github.com/PallierJean/lignee/commit/4190ddc2290eb2e29a392762ad9b718f2e7672ea))
* Livrets de famille ([fb03700](https://github.com/PallierJean/lignee/commit/fb03700d5613bebd1f9352049eaf1cbe0ff4aca7))
* Roue d'ascendance ([0cc36ec](https://github.com/PallierJean/lignee/commit/0cc36ece57f96e1a948e49605976e4f39c2abf0f))
* Statistiques de l'arbre ([99bd95a](https://github.com/PallierJean/lignee/commit/99bd95a68af11f87a18b7953f28d0bbb11447cff))
* Vérification de cohérence ([e200acf](https://github.com/PallierJean/lignee/commit/e200acff262eeeb33316a6718637b2a89f4cc33e))
