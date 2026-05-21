#!/bin/bash
set -euo pipefail

TARGET="${1:-/Applications/TFT Proxy.app}"

if [ ! -e "$TARGET" ]; then
  echo "Usage: $0 [/path/to/TFT Proxy.app]"
  echo "Example: $0 \"/Applications/TFT Proxy.app\""
  exit 1
fi

xattr -cr "$TARGET"
codesign --force --deep --sign - "$TARGET" 2>/dev/null || true
echo "==> Fixed quarantine for: $TARGET"
echo "    Open: right-click → Open, or: open -a \"TFT Proxy\""
