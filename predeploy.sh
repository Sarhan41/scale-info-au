#!/usr/bin/env bash
# Run this from the project folder BEFORE `vercel --prod`.
#
# Why: `vercel --prod` replaces the entire deployment with your folder. Any file
# you don't have locally is deleted from the live site. `vercel pull` does NOT
# fetch source, only env vars, so it will not save you.
#
# This grabs the pages that live only on production and aborts if they're missing.
set -euo pipefail
SITE="https://scaleinfo.com.au"
PAGES=(book-5k book-orl)

for p in "${PAGES[@]}"; do
  code=$(curl -s -o /tmp/_$p.html -w '%{http_code}' "$SITE/$p?cb=$RANDOM")
  size=$(wc -c < /tmp/_$p.html | tr -d ' ')
  if [ "$code" != "200" ] || [ "$size" -lt 10000 ]; then
    echo "ABORT: $SITE/$p returned $code ($size bytes)."
    echo "It is already missing from production. Deploying now would keep it deleted."
    echo "Get $p.html from Liam before deploying."
    exit 1
  fi
  mv /tmp/_$p.html "./$p.html"
  echo "ok  $p.html  $size bytes"
done
echo "Both pages present. Safe to run: vercel --prod"
