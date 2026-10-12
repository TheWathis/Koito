#!/usr/bin/env bash
# Builds and runs Koito locally with a demo family (mathis, clara, leo), so the
# multi-user features can be tried without touching a real instance.
#
#   scripts/demo.sh           build everything, start, seed demo data once
#   scripts/demo.sh --fast    skip the web client build (backend changes only)
#   scripts/demo.sh --reset   start again from an empty database
#
# Data lives in .koito-demo/ (ignored by git). Logins: mathis / clara / leo,
# password "changeme" for all three.
set -euo pipefail
cd "$(dirname "$0")/.."

FAST=0
for arg in "$@"; do
  case "$arg" in
    --fast) FAST=1 ;;
    --reset) rm -rf .koito-demo; echo "Demo data removed." ;;
    *) echo "unknown option: $arg"; exit 1 ;;
  esac
done

if [ "$FAST" = 0 ] || [ ! -f client/build/client/index.html ]; then
  echo "==> Building the web client"
  (cd client && corepack yarn run build)
fi

echo "==> Building the server"
CGO_ENABLED=1 go build -o koito ./cmd/api

mkdir -p .koito-demo
export KOITO_CONFIG_DIR="$PWD/.koito-demo"
export KOITO_ALLOWED_HOSTS="*"
export KOITO_DEFAULT_USERNAME="mathis"
export KOITO_DEFAULT_PASSWORD="changeme"
# Demo data is made up, so there is nothing useful to look up.
export KOITO_DISABLE_MUSICBRAINZ="true"
export KOITO_DISABLE_RATE_LIMIT="true"

./koito &
KOITO_PID=$!
trap 'kill $KOITO_PID 2>/dev/null' EXIT INT TERM

if [ ! -f .koito-demo/.seeded ]; then
  node scripts/demo-seed.mjs && touch .koito-demo/.seeded
fi

echo
echo "==> Koito is running on port 4110 (Ctrl+C to stop)."
echo "    In a Codespace, open the PORTS tab and click the address for port 4110."
echo "    Log in as mathis, clara or leo, password: changeme"
wait $KOITO_PID
