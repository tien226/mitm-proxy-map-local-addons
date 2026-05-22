#!/bin/bash
set -euo pipefail

PORT=6789
PROXY_PORT=8080
WEB_PORT=8081

echo "==> Stopping TFT Proxy..."

if command -v lsof &>/dev/null; then
  for port in "$PORT" "$PROXY_PORT" "$WEB_PORT"; do
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
      echo "    Port $port -> kill $pids"
      kill $pids 2>/dev/null || true
    fi
  done
fi

pkill -f "uvicorn main:app.*6789" 2>/dev/null || true
pkill -f "mitmweb.*map-local-addons" 2>/dev/null || true

echo "==> Done. Run ./launch-app.sh again."
