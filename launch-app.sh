#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/app/backend"
DESKTOP_DIR="$ROOT_DIR/app/desktop"
VENV_DIR="$ROOT_DIR/.venv"
PORT=6789
MODE="${1:-}"

echo "==> TFT Proxy (web)"
echo "    Desktop window: ./launch-desktop.sh"
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

if command -v lsof &>/dev/null; then
  EXISTING_PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
  if [ -n "$EXISTING_PIDS" ]; then
    echo "Error: port $PORT is already in use (PID: $EXISTING_PIDS)"
    echo "Stop the old app: ./stop-app.sh"
    echo "Or manually: kill $EXISTING_PIDS"
    exit 1
  fi
fi

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

if [ ! -d "$DESKTOP_DIR/node_modules" ]; then
  echo "==> Installing UI dependencies (first run)..."
  (cd "$DESKTOP_DIR" && npm install)
fi

if [ "$MODE" = "dev" ]; then
  echo "==> Dev mode: UI http://127.0.0.1:5173 | API http://127.0.0.1:$PORT"
  (cd "$DESKTOP_DIR" && npm run dev) &
  VITE_PID=$!
  trap 'kill $VITE_PID 2>/dev/null || true' EXIT
  sleep 2
  open "http://127.0.0.1:5173" 2>/dev/null || true
  (cd "$BACKEND_DIR" && "$PYTHON" -m uvicorn main:app --host 127.0.0.1 --port "$PORT" --reload)
  exit 0
fi

echo "==> Building UI..."
(cd "$DESKTOP_DIR" && npm run build)

echo "==> Starting TFT Proxy on http://127.0.0.1:$PORT"
echo "    (Press Ctrl+C to stop)"
sleep 1
open "http://127.0.0.1:$PORT" 2>/dev/null || xdg-open "http://127.0.0.1:$PORT" 2>/dev/null || true
cd "$BACKEND_DIR"
exec "$PYTHON" -m uvicorn main:app --host 127.0.0.1 --port "$PORT"
