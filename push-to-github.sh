#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

REPO_URL="https://github.com/tien226/mitm-proxy-map-local-addons.git"

echo "==> Remote: $REPO_URL"
git remote set-url origin "$REPO_URL"

if command -v gh &>/dev/null; then
  echo "==> GitHub CLI found"
  gh auth status || true
  echo "==> Link git credential to gh (account must be tien226)"
  gh auth setup-git
  echo "==> Pushing main..."
  git push -u origin main
else
  echo "==> gh not installed. Install: brew install gh"
  echo "    Then: gh auth login  (login as tien226)"
  echo "    Then run this script again."
  echo ""
  echo "Or push manually with PAT:"
  echo "  git push https://tien226@github.com/tien226/mitm-proxy-map-local-addons.git main"
  echo "  Password = Personal Access Token (classic, scope: repo)"
  exit 1
fi

echo "==> Done: https://github.com/tien226/mitm-proxy-map-local-addons"
