# Lignée : documentation technique

Présentation du produit : [README](../README.md).

Application web d'arbre généalogique en HTML, CSS et JavaScript natifs (modules ES). Aucune
dépendance, aucune étape de compilation : Node.js 26 suffit pour la lancer et la tester.

## Pour commencer

- [Démarrer sur son poste](getting-started.md) : installer, lancer, tester, première modification.
- [Règles du projet](guidelines.md) : principes, code, tests, branches et commits.

## Comprendre le code

- [Architecture](architecture.md) : arborescence, circulation des données, langues, annuler / rétablir.
- [Stockage des données](storage.md) : plusieurs arbres, fichiers ou navigateur, photos.
- [Format des données](data-format.md) : référence des objets (sauvegarde, personne, union, événement, source, galerie), types, correspondance GEDCOM.
- [Relais vers le fichier des décès (INSEE)](insee.md) : les routes du serveur local qui interrogent matchID.
- [Sécurité](security.md) : menaces, serveur local, politique de sécurité, sorties vers Internet, secrets.

## Fonctionnalités

- [Arbre et roue d'ascendance](features/tree.md)
- [Impression](features/print.md) : PDF vectoriel, découpage en feuilles, livrets.
- [Onglet Analyse](features/analysis.md) : parenté, cohérence, doublons, INSEE, lieux, carte.
- [Lecture des écritures anciennes](features/htr.md) : Kraken sur l'ordinateur, texte lu et corrigé.
- [Commandes à la voix](features/voice.md) : chercher, ouvrir, ajouter, modifier en parlant ; Whisper et Qwen sur l'appareil.
- [Thèmes](features/themes.md) : clair et sombre, fêtes et saisons, univers, accessibilité.
- [GitHub](features/github.md) : ouvrir et sauvegarder un arbre dans un dépôt ; pas à pas pour les utilisateurs : [Garder son arbre sur GitHub](guide-github.md).

## Livrer

- [Tests et publication](release.md) : tests, intégration continue, versions, site GitHub Pages.
- [Mises à jour](updates.md) : mettre à jour sa copie de Lignée, mises à jour automatiques des outils.
