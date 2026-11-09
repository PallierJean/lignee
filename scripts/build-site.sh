#!/bin/sh
# Builds _site/ for GitHub Pages: only the application files and the example
# family. The security policy, sent as a header by server.js, goes into the page here.
set -eu

rm -rf _site
mkdir -p _site/data/arbres
cp -R index.html package.json assets css images js _site/
cp data/arbres/exemple-famille-bertrand.json _site/data/arbres/

CSP="default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self' https://nominatim.openstreetmap.org https://api-lannuaire.service-public.fr https://api.github.com https://raw.githubusercontent.com; object-src 'none'; base-uri 'none'; form-action 'none'"
sed -i "s|<meta charset=\"utf-8\">|<meta charset=\"utf-8\">\n  <meta http-equiv=\"Content-Security-Policy\" content=\"$CSP\">|" _site/index.html
