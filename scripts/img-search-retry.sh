#!/bin/bash
# Relance les recherches d'images manquantes/vides — par lots de 5
cd /home/z/my-project
mkdir -p tool-results/imgsearch

declare -A Q=(
  [q-economie]="bauxite open pit mine in Guinea West Africa"
  [q-culture]="traditional West African djembe drums festival dancers colorful"
  [q-politique]="African heads of state summit conference hall flags"
  [q-sante]="health center clinic nurse patient in Africa"
  [q-education]="African school children studying in classroom"
  [q-international]="African Union summit heads of state group photo"
  [q-redaction]="journalists working together in a busy newsroom office"
  [q-radio]="professional radio broadcast studio microphone on air"
  [q-debat]="television studio debate panel discussion set"
  [q-orange]="Orange telecommunications company logo"
  [q-ecobank]="Ecobank bank brand logo"
)

need() {
  local f="tool-results/imgsearch/$1.json"
  [ ! -s "$f" ] && return 0
  grep -q '"success": true' "$f" && return 1
  return 0
}

batch=0
for key in "${!Q[@]}"; do
  if need "$key"; then
    echo ">>> $key"
    z-ai image-search -q "${Q[$key]}" -c 6 --gl us --no-rank > "tool-results/imgsearch/$key.json" 2> "tool-results/imgsearch/$key.err" &
    batch=$((batch+1))
    if [ "$batch" -ge 5 ]; then
      wait
      batch=0
      echo "--- lot terminé ---"
      sleep 2
    fi
  fi
done
wait
echo "ALL DONE"
