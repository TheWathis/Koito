#!/usr/bin/env bash
# Installs what Koito needs to build, once, when the Codespace is created.
set -euo pipefail
sudo apt-get update -qq
sudo apt-get install -y -qq libvips-dev pkg-config
sudo corepack enable
(cd client && corepack yarn install)
go mod download
echo
echo "Ready. Start Koito with:  scripts/demo.sh"
