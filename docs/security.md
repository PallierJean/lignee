# Sécurité

[← Documentation technique](DEVELOPMENT.md)

Le serveur local n'écoute que sur cet ordinateur et refuse les requêtes dont l'en-tête `Host` n'est pas
local ou dont l'`Origin` est un autre site : une page web ouverte en parallèle ne peut ni lire ni écrire
les arbres. Il ne sert que les fichiers de l'application (ni `.git`, ni `.env.test`, ni le jeton matchID)
et envoie une politique de sécurité (`Content-Security-Policy`) qui n'autorise que les fichiers de
l'application, polices comprises, et le service de localisation, et interdit à un autre site de
l'afficher dans un cadre. Le site GitHub Pages, qui ne peut pas envoyer cet en-tête, refuse de démarrer
dans le cadre d'un autre site (sauf dans claude.ai). Un enregistrement
porte la version de l'arbre reçue au chargement : si l'arbre a changé ailleurs (autre onglet, fichier
modifié), il est refusé plutôt que d'écraser ces changements, et un message demande de recharger.

Les polices (Atkinson Hyperlegible, Gloock, IBM Plex Mono, licence SIL OFL) sont dans `assets/fonts/` :
l'ouverture de l'application ne contacte aucun service tiers. Seules sorties vers Internet, sur clic :
les noms de lieux vers OpenStreetMap et, par le serveur local (`GET /api/insee`), le nom de
naissance, le premier prénom, le sexe et la naissance des fiches vérifiées vers matchID (et, pour
s'y inscrire, l'adresse e-mail saisie). L'application n'a pas de comptes : ne l'exposez pas sur un réseau.
