#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/app/backend"
DESKTOP_DIR="$ROOT_DIR/app/desktop"
VENV_DIR="$ROOT_DIR/.venv"

if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
  "$VENV_DIR/bin/pip" install -q -r "$BACKEND_DIR/requirements.txt"
fi

if [ ! -d "$BACKEND_DIR/static" ]; then
  echo "==> Building UI..."
  (cd "$DESKTOP_DIR" && npm install && npm run build)
fi

echo "==> TFT Proxy (production)"
echo "Open http://127.0.0.1:9876"
open "http://127.0.0.1:9876" 2>/dev/null || true
(cd "$BACKEND_DIR" && "$VENV_DIR/bin/python" -m uvicorn main:app --host 127.0.0.1 --port 9876)
