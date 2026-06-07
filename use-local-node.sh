#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_NODE="$PROJECT_DIR/.local/node-v24.16.0-darwin-x64/bin"

if [ ! -x "$LOCAL_NODE/node" ] || [ ! -x "$LOCAL_NODE/npm" ]; then
  echo "Local Node/npm was not found in $LOCAL_NODE"
  echo "Ask Codex to install Node/npm again, or install Node from https://nodejs.org/"
  exit 1
fi

export PATH="$LOCAL_NODE:$PATH"
export npm_config_cache="$PROJECT_DIR/.npm-cache"

echo "Using Node: $(node --version)"
echo "Using npm:  $(npm --version)"
echo
echo "You can now run:"
echo "  npm install"
echo "  npm run dev"
