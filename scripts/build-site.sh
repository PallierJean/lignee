#!/bin/sh
# Prépare _site/ pour GitHub Pages : uniquement les fichiers de l'application et la famille
# d'exemple. La politique de sécurité, envoyée en en-tête par server.js, passe ici dans la page.
set -eu

rm -rf _site
mkdir -p _site/data
cp -R index.html package.json assets css images js _site/
cp data/arbres/exemple-famille-bertrand.json _site/data/

CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://nominatim.openstreetmap.org https://api.github.com https://raw.githubusercontent.com; object-src 'none'; base-uri 'none'; form-action 'none'"
sed -i "s|<meta charset=\"utf-8\">|<meta charset=\"utf-8\">\n  <meta http-equiv=\"Content-Security-Policy\" content=\"$CSP\">|" _site/index.html
