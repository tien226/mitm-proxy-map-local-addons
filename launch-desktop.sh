#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/app/backend"
DESKTOP_DIR="$ROOT_DIR/app/desktop"
VENV_DIR="$ROOT_DIR/.venv"
PORT=6789
MODE="${1:-}"

echo "==> TFT Proxy Desktop"
echo "Project: $ROOT_DIR"

MITMWEB_BIN=""
if command -v mitmweb &>/dev/null; then
  MITMWEB_BIN="$(command -v mitmweb)"
elif [ -x "/opt/homebrew/bin/mitmweb" ]; then
  MITMWEB_BIN="/opt/homebrew/bin/mitmweb"
elif [ -x "/usr/local/bin/mitmweb" ]; then
  MITMWEB_BIN="/usr/local/bin/mitmweb"
fi
if [ -z "$MITMWEB_BIN" ]; then
  echo "Error: mitmweb not found. Install with: brew install mitmproxy"
  exit 1
fi
export MITMWEB_PATH="$MITMWEB_BIN"
export PATH="$(dirname "$MITMWEB_BIN"):$PATH"

if ! command -v python3 &>/dev/null; then
  echo "Error: python3 not found"
  exit 1
fi

if ! command -v npm &>/dev/null; then
  echo "Error: npm not found. Install Node.js first."
  exit 1
fi

if [ ! -d "$VENV_DIR" ]; then
  echo "==> Creating Python virtual environment..."
  python3 -m venv "$VENV_DIR"
fi
echo "==> Installing Python dependencies..."
"$VENV_DIR/bin/pip" install -q -r "$BACKEND_DIR/requirements.txt"
PYTHON="$VENV_DIR/bin/python"

if [ ! -x "$DESKTOP_DIR/node_modules/.bin/electron" ]; then
  echo "==> Installing UI + Electron (first run, needs network)..."
  (cd "$DESKTOP_DIR" && npm install)
fi

export TFT_PROXY_PROJECT_ROOT="$ROOT_DIR"

start_backend() {
  (cd "$BACKEND_DIR" && "$PYTHON" -m uvicorn main:app --host 127.0.0.1 --port "$PORT") &
  BACKEND_PID=$!
  trap 'kill $BACKEND_PID 2>/dev/null || true' EXIT
  echo "==> Waiting for API on http://127.0.0.1:$PORT ..."
  for _ in $(seq 1 40); do
    if curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
  echo "Error: backend did not start"
  exit 1
}

if [ "$MODE" = "dev" ]; then
  echo "==> Dev mode: Electron window + Vite http://127.0.0.1:5173"
  start_backend
  (cd "$DESKTOP_DIR" && npm run dev) &
  VITE_PID=$!
  trap 'kill $BACKEND_PID $VITE_PID 2>/dev/null || true' EXIT
  sleep 2
  export TFT_PROXY_SKIP_BACKEND=1
  export TFT_PROXY_ELECTRON_DEV=1
  (cd "$DESKTOP_DIR" && npm run electron)
  exit 0
fi

echo "==> Building UI for desktop..."
(cd "$DESKTOP_DIR" && npm run build)
start_backend
export TFT_PROXY_SKIP_BACKEND=1
echo "==> Opening TFT Proxy desktop window..."
(cd "$DESKTOP_DIR" && npm run electron)
