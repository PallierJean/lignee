# Historique des versions

## [1.11.0](https://github.com/PallierJean/lignee/compare/v1.10.0...v1.11.0) (2026-11-03)

### Features

* ranger la vue Lieux par département, ville puis lieu-dit ([d074fcf](https://github.com/PallierJean/lignee/commit/d074fcf2f414a17f5ddf253a5c828d89a8721794))
* vérifier les fiches dans le fichier des décès de l'INSEE ([c7c6d32](https://github.com/PallierJean/lignee/commit/c7c6d32a058a752c15a62ec3366b06d925931fb9))

### Bug Fixes

* garder le choix « Ce n'est pas un doublon » après rechargement ([e8347ac](https://github.com/PallierJean/lignee/commit/e8347ac783ab73a786042cea41129c11aaa089db))
* texte d'aide de la vue Lieux, rangée par département ([f5d39b5](https://github.com/PallierJean/lignee/commit/f5d39b5aa9182a09a95b14cc54418a5540f979ce))

## [1.10.0](https://github.com/PallierJean/lignee/compare/v1.9.0...v1.10.0) (2026-11-03)

### Features

* afficher le nom du département d'après son numéro ([5f27cc3](https://github.com/PallierJean/lignee/commit/5f27cc30b1ab7e84acdb355eb0f1d32128003e06))
* déduire le département de la ville et signaler les écarts ([9b4feed](https://github.com/PallierJean/lignee/commit/9b4feedb9d4bd39e20674665cdddc39f76f36b14))

### Bug Fixes

* renommer un lieu même pendant la saisie d'une fiche ([d427ca0](https://github.com/PallierJean/lignee/commit/d427ca0f21ea0dc35c188ede27758129b2bddf71))

## [1.9.0](https://github.com/PallierJean/lignee/compare/v1.8.0...v1.9.0) (2026-11-03)

### Features

* contrôler les liens familiaux dans la cohérence ([8f110e9](https://github.com/PallierJean/lignee/commit/8f110e9eec7b90975b2f71575890b20c074471a9))
* disposition compacte pour imprimer l'arbre complet ([1e2080d](https://github.com/PallierJean/lignee/commit/1e2080d0b799fbe11c90df026741eb9db408e914))
* imprimer en A1 et A0 et proposer le format lisible ([5849392](https://github.com/PallierJean/lignee/commit/58493924f06d4c17362a3c902df3d34ad1f63dfd))
* livre de famille complet, un chapitre par branche ([2460c62](https://github.com/PallierJean/lignee/commit/2460c6237824189396c67de48ef6604f37915697))
* saisir les lieux en ville, lieu-dit et département et les renommer partout ([dda55cc](https://github.com/PallierJean/lignee/commit/dda55cc002c78436dbfef6c42c5e5acf919b934e))
* score de complétude des fiches et lignée directe à compléter ([afc8b12](https://github.com/PallierJean/lignee/commit/afc8b12bb9f2c623ed8800aa0010204799eed6e7))

### Bug Fixes

* livre complet, frise qui débordait de la page et unions en double ([2df6364](https://github.com/PallierJean/lignee/commit/2df6364e3f3a67783d7c363b34fd097b1de5ad35))
* ne plus couper la droite de l'arbre à l'impression ([b1ee8aa](https://github.com/PallierJean/lignee/commit/b1ee8aa3a8be67477220c804f3c87e42d414ec26))

### Reverts

* retirer le score de complétude des fiches ([5ef37a1](https://github.com/PallierJean/lignee/commit/5ef37a19928e2fc92abb4e2860a0f597793e839d))

## [1.8.0](https://github.com/PallierJean/lignee/compare/v1.7.0...v1.8.0) (2026-11-03)

### Features

* adapter le choix des ascendants à la profondeur de l'arbre ([b6c316b](https://github.com/PallierJean/lignee/commit/b6c316ba44b7aec9f607c47aa7548e34c49e6078))
* limiter le sélecteur d'ascendants à quatre valeurs visibles ([1bd11ab](https://github.com/PallierJean/lignee/commit/1bd11ab7343c2ac7f9e3d96999aad88191bcd40d))

## [1.7.0](https://github.com/PallierJean/lignee/compare/v1.6.1...v1.7.0) (2026-11-02)

### Features

* synchroniser la situation et les unions, ajouter le remariage ([e96c2a9](https://github.com/PallierJean/lignee/commit/e96c2a99d0178121c810d8d018d137bdabd2d892))
* traduire les professions connues au changement de langue ([5b4f61a](https://github.com/PallierJean/lignee/commit/5b4f61a9b12915ef72007c8452cc2b35b4ac7d87))

### Bug Fixes

* traduire Contracts lawyer par avocat en droit des contrats ([efa5f3a](https://github.com/PallierJean/lignee/commit/efa5f3ab93f10a921b637e745f83b9148b584025))

## [1.6.1](https://github.com/PallierJean/lignee/compare/v1.6.0...v1.6.1) (2026-11-01)

### Bug Fixes

* ne plus afficher de trait orphelin avec 0 ascendant ([03cc42b](https://github.com/PallierJean/lignee/commit/03cc42b899a8db907b2612a58dd204b7b3cb723d))

## [1.6.0](https://github.com/PallierJean/lignee/compare/v1.5.0...v1.6.0) (2026-11-01)

### Features

* afficher les ascendants de 0 à 7 dans une fenêtre glissante ([b3f5ffc](https://github.com/PallierJean/lignee/commit/b3f5ffc1fb3d4f52c205ae753d3a36d9a9fde12b))
* masquer ou afficher le panneau de la fiche ([3aa1025](https://github.com/PallierJean/lignee/commit/3aa1025b6406347eb5cc3a1cd36e80b2926124ee))
* pouvoir fermer les bandeaux d'exemple et de mode local ([4fd5b26](https://github.com/PallierJean/lignee/commit/4fd5b264522afb5b3d881972858a72f8cec48da3))

### Bug Fixes

* fermer la fenêtre d'import une fois le nouvel arbre ouvert ([765b2e8](https://github.com/PallierJean/lignee/commit/765b2e8e496829f6373d11dd64255863ad1e230a))
* ouvrir un dépôt GitHub dans un nouvel arbre ([cba9db0](https://github.com/PallierJean/lignee/commit/cba9db02d1e760e53c2f9db794d8cccfd521ccfb))
* réduire le bandeau du dépôt à une ligne ([84e4157](https://github.com/PallierJean/lignee/commit/84e415727d54a83f0be73ebfd5a33d1ce9646d69))

## [1.5.0](https://github.com/PallierJean/lignee/compare/v1.4.0...v1.5.0) (2026-10-31)

### Features

* réunir la connexion et le chargement du dépôt en un seul bouton ([ccde1e2](https://github.com/PallierJean/lignee/commit/ccde1e2e6a85c31496b7abc57ae9ee94a1b8581a))

## [1.4.0](https://github.com/PallierJean/lignee/compare/v1.3.0...v1.4.0) (2026-10-31)

### Features

* séparer les fenêtres Importer et Exporter ([cb34301](https://github.com/PallierJean/lignee/commit/cb34301c033c8af3c61d488f049336664c2a954a))

### Bug Fixes

* ne plus prendre une lecture retardée de GitHub pour un conflit ([71aa908](https://github.com/PallierJean/lignee/commit/71aa908e5cc1b53ca29648b885a3610a63d7162f))
* nommer les photos d'après la personne ([b37a057](https://github.com/PallierJean/lignee/commit/b37a0570960585d680eeef4ffebc1707db2bdeea))
* nommer les photos NOM-Prénom-<uuid> ([3f8d754](https://github.com/PallierJean/lignee/commit/3f8d754c62db6438d8a8f1b32631169916499479))
* partager le statut de couple avec le partenaire ([988b3d2](https://github.com/PallierJean/lignee/commit/988b3d2f384655758d6f4836d6b38bda0a3b943a))
* recentrer l'arbre et la roue dans toutes les vues ([75be4c8](https://github.com/PallierJean/lignee/commit/75be4c865b863f441b9cec826727810e1601fbb6))

## [1.3.0](https://github.com/PallierJean/lignee/compare/v1.2.0...v1.3.0) (2026-10-30)

### Features

* connecter l'arbre ouvert à un dépôt et le sauvegarder d'un clic ([e89e4b2](https://github.com/PallierJean/lignee/commit/e89e4b249bb04268459cdd059c675dacbd5d8045))
* renvoyer l'arbre et ses photos vers le dépôt GitHub ([4e09838](https://github.com/PallierJean/lignee/commit/4e0983871a5a586836fb7527e09175a8288bcc75))

## [1.2.0](https://github.com/PallierJean/lignee/compare/v1.1.0...v1.2.0) (2026-10-30)

### Features

* ouvrir la famille d'exemple à la première visite ([23ea7af](https://github.com/PallierJean/lignee/commit/23ea7af33cb54cc5a8719d197e39739f931f69b9))

## [1.1.0](https://github.com/PallierJean/lignee/compare/v1.0.0...v1.1.0) (2026-10-30)

### Features

* charger une sauvegarde et ses photos depuis un dépôt GitHub ([1ac3793](https://github.com/PallierJean/lignee/commit/1ac3793466d0611e589ecd3d055400fc199fffee))

### Bug Fixes

* effacer le jeton GitHub dès sa lecture ([9a5f0ae](https://github.com/PallierJean/lignee/commit/9a5f0aeed58612ed3ae27bf40bd9e836cb2a1d29))

## 1.0.0 (2026-10-30)

### Features

* annuler / rétablir et stockage ([7ee002b](https://github.com/PallierJean/lignee/commit/7ee002b09967b3d3ef7c5f8b7f8f266ece5330ef))
* calcul du lien de parenté ([587ea10](https://github.com/PallierJean/lignee/commit/587ea101ba629cf8bb6ecc0dd00d1166ad6cd021))
* carte des lieux et des migrations ([09f5855](https://github.com/PallierJean/lignee/commit/09f58552228ae916edf5e465ef7038d9b3579375))
* détection des doublons et fusion de fiches ([8f17d10](https://github.com/PallierJean/lignee/commit/8f17d10bb1a657d698e419ec91462c3b38894083))
* éphémérides ([603d0b9](https://github.com/PallierJean/lignee/commit/603d0b9b5dff3ee948b7eb228ae93718239ca32d))
* export du registre en CSV ([0f1b372](https://github.com/PallierJean/lignee/commit/0f1b3722847ae607fe44c292aad712d3820bb19f))
* frise chronologique ([077eb43](https://github.com/PallierJean/lignee/commit/077eb438aa6f42fa06085a051a7b934766d0cdb6))
* galerie et identification sur les photos ([c153627](https://github.com/PallierJean/lignee/commit/c153627befbe0600c75a399ef270b5baecf1b2db))
* impression sur plusieurs feuilles ([74dc319](https://github.com/PallierJean/lignee/commit/74dc319022d50feb551aea9ca27889053d41c865))
* interface de l'application ([4190ddc](https://github.com/PallierJean/lignee/commit/4190ddc2290eb2e29a392762ad9b718f2e7672ea))
* livrets de famille ([fb03700](https://github.com/PallierJean/lignee/commit/fb03700d5613bebd1f9352049eaf1cbe0ff4aca7))
* roue d'ascendance ([0cc36ec](https://github.com/PallierJean/lignee/commit/0cc36ece57f96e1a948e49605976e4f39c2abf0f))
* statistiques de l'arbre ([99bd95a](https://github.com/PallierJean/lignee/commit/99bd95a68af11f87a18b7953f28d0bbb11447cff))
* vérification de cohérence ([e200acf](https://github.com/PallierJean/lignee/commit/e200acff262eeeb33316a6718637b2a89f4cc33e))
