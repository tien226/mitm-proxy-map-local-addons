#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

REPO_URL="https://github.com/tien226/mitm-proxy-map-local-addons.git"

if ! command -v gh &>/dev/null; then
  echo "Install GitHub CLI first: brew install gh"
  exit 1
fi

echo "==> Login GitHub as tien226 (browser)"
gh auth logout 2>/dev/null || true
gh auth login -h github.com -p https -w

echo "==> Must show account tien226:"
gh auth status

echo "==> This repo only: use gh credential (not tuyen-metica Keychain)"
git config --local credential.helper ""
git config --local --add credential.helper "!gh auth git-credential"
git remote set-url origin "$REPO_URL"

echo "==> Push"
git push -u origin main

echo "==> Done: https://github.com/tien226/mitm-proxy-map-local-addons"
