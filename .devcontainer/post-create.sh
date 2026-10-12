#!/usr/bin/env bash
# Installs what Koito needs to build, once, when the Codespace is created.
set -euo pipefail
cd "$(dirname "$0")/.."

sudo apt-get update -qq
sudo apt-get install -y -qq libvips-dev pkg-config

# Yarn comes through corepack, which ships with Node. It is called without sudo:
# Node is installed for the current user, so sudo would not find it.
yarn_cmd() {
  if command -v corepack >/dev/null 2>&1; then
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack yarn "$@"
  else
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 npx --yes corepack yarn "$@"
  fi
}
(cd client && yarn_cmd install)
go mod download

echo
echo "Ready. Start Koito with:  scripts/demo.sh"
