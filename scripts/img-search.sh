#!/bin/bash
# Recherches d'images RÉELLES (web) pour Topguinee.info — exécutées en parallèle (stdout → fichiers)
cd /home/z/my-project
mkdir -p tool-results/imgsearch

z-ai image-search -q "Conakry Guinea city coastline aerial view" -c 6 --gl us --no-rank > tool-results/imgsearch/q-une.json 2>tool-results/imgsearch/q-une.err &
z-ai image-search -q "bauxite open pit mine in Guinea West Africa" -c 6 --gl us --no-rank > tool-results/imgsearch/q-economie.json 2>tool-results/imgsearch/q-economie.err &
z-ai image-search -q "football stadium match players in Africa" -c 6 --gl us --no-rank > tool-results/imgsearch/q-sport.json 2>tool-results/imgsearch/q-sport.err &
z-ai image-search -q "traditional West African djembe drums festival dancers colorful" -c 6 --gl us --no-rank > tool-results/imgsearch/q-culture.json 2>tool-results/imgsearch/q-culture.err &
z-ai image-search -q "African heads of state summit conference hall flags" -c 6 --gl us --no-rank > tool-results/imgsearch/q-politique.json 2>tool-results/imgsearch/q-politique.err &
z-ai image-search -q "health center clinic patients nurse in Africa" -c 6 --gl us --no-rank > tool-results/imgsearch/q-sante.json 2>tool-results/imgsearch/q-sante.err &
z-ai image-search -q "African school children studying in classroom" -c 6 --gl us --no-rank > tool-results/imgsearch/q-education.json 2>tool-results/imgsearch/q-education.err &
z-ai image-search -q "African Union summit heads of state group photo" -c 6 --gl us --no-rank > tool-results/imgsearch/q-international.json 2>tool-results/imgsearch/q-international.err &
z-ai image-search -q "professional radio broadcast studio microphone on air" -c 6 --gl us --no-rank > tool-results/imgsearch/q-radio.json 2>tool-results/imgsearch/q-radio.err &
z-ai image-search -q "television studio debate panel discussion set" -c 6 --gl us --no-rank > tool-results/imgsearch/q-debat.json 2>tool-results/imgsearch/q-debat.err &
z-ai image-search -q "journalists working together in a busy newsroom office" -c 6 --gl us --no-rank > tool-results/imgsearch/q-redaction.json 2>tool-results/imgsearch/q-redaction.err &
z-ai image-search -q "Orange telecommunications company logo" -c 6 --gl us --no-rank > tool-results/imgsearch/q-orange.json 2>tool-results/imgsearch/q-orange.err &
z-ai image-search -q "Ecobank bank brand logo" -c 6 --gl us --no-rank > tool-results/imgsearch/q-ecobank.json 2>tool-results/imgsearch/q-ecobank.err &

wait
echo "ALL DONE"
