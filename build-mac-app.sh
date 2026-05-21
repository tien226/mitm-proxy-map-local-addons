#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/app/backend"
DESKTOP_DIR="$ROOT_DIR/app/desktop"
VENV_DIR="$ROOT_DIR/.venv"
BUILD_DIR="$DESKTOP_DIR/build"
BACKEND_DIST="$BUILD_DIR/tft-proxy-backend"

echo "==> Build TFT Proxy.app (macOS)"
echo "Project: $ROOT_DIR"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Error: macOS build only. Run on a Mac."
  exit 1
fi

if ! command -v python3 &>/dev/null; then
  echo "Error: python3 not found"
  exit 1
fi

if ! command -v npm &>/dev/null; then
  echo "Error: npm not found"
  exit 1
fi

if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
fi
echo "==> Python deps + PyInstaller..."
"$VENV_DIR/bin/pip" install -q -r "$BACKEND_DIR/requirements.txt" pyinstaller

echo "==> UI build..."
(cd "$DESKTOP_DIR" && npm install && npm run build)

echo "==> Backend binary..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
(cd "$BACKEND_DIR" && "$VENV_DIR/bin/pyinstaller" --noconfirm --distpath "$BUILD_DIR/dist" --workpath "$BUILD_DIR/work" tft_proxy_backend.spec)
mv "$BUILD_DIR/dist/tft-proxy-backend" "$BACKEND_DIST"
echo "==> Sign backend binary..."
codesign --force --sign - "$BACKEND_DIST"

echo "==> Electron .app + .dmg..."
export CSC_IDENTITY_AUTO_DISCOVERY=false
(cd "$DESKTOP_DIR" && npx electron-builder --mac)

APP_PATH="$DESKTOP_DIR/dist-electron/mac/TFT Proxy.app"
DMG_PATH="$(ls -1 "$DESKTOP_DIR/dist-electron"/*.dmg 2>/dev/null | head -1 || true)"
ZIP_PATH="$(ls -1 "$DESKTOP_DIR/dist-electron"/*.zip 2>/dev/null | head -1 || true)"

sign_mac_app() {
  local target_path="$1"
  codesign --force --deep --sign - "$target_path"
  xattr -cr "$target_path"
}

echo "==> Ad-hoc sign app bundle..."
if [ -d "$APP_PATH" ]; then
  sign_mac_app "$APP_PATH"
fi
if [ -n "$DMG_PATH" ]; then
  xattr -cr "$DMG_PATH"
fi
if [ -n "$ZIP_PATH" ]; then
  xattr -cr "$ZIP_PATH"
fi

echo ""
echo "==> Done"
if [ -d "$APP_PATH" ]; then
  echo "    App:  $APP_PATH"
  echo "    Install: drag \"TFT Proxy.app\" to Applications"
fi
if [ -n "$DMG_PATH" ]; then
  echo "    DMG:  $DMG_PATH"
fi
if [ -n "$ZIP_PATH" ]; then
  echo "    ZIP:  $ZIP_PATH  (often fewer Gatekeeper issues than DMG)"
fi
echo ""
echo "Share INSTALL_MAC.md with recipients (fix \"damaged\" on other Macs)."
echo "Note: mitmproxy must be installed once: brew install mitmproxy"
