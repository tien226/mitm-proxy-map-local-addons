# TFT Proxy App

Desktop-style UI (Proxyman-like) for mitmproxy + Map Local.

## Features

- **Start / Stop** proxy with one click
- **Traffic** tab: list and inspect HTTP requests
- **Map Local** tab: add/edit rules and JSON responses (no manual `config.json` editing)
- **Setup** tab: device proxy and certificate instructions

## Quick start

```bash
chmod +x launch-app.sh
./launch-app.sh
```

Opens **http://127.0.0.1:6789** automatically (one port — UI + API).

### Desktop app (native window)

Same backend and UI, opened in an Electron window instead of the browser:

```bash
chmod +x launch-desktop.sh
./launch-desktop.sh
```

Dev mode (hot reload in the desktop window):

```bash
./launch-desktop.sh dev
```

### Install like a normal Mac app (no terminal after build)

Build once (requires Node.js + Python 3 + network):

```bash
chmod +x build-mac-app.sh
./build-mac-app.sh
```

Then drag **TFT Proxy.app** from `app/desktop/dist-electron/mac/` into **Applications**. Open from Launchpad — no `./launch-desktop.sh` needed.

One-time on the Mac: `brew install mitmproxy` (proxy engine).

**Other Mac shows "damaged"?** — See [INSTALL_MAC.md](INSTALL_MAC.md) (Gatekeeper, not a broken build).

Quick dev window (terminal):

```bash
./launch-desktop.sh
```

### Web app dev mode (hot reload UI on port 5173)

```bash
./launch-app.sh dev
```

**If you see "connection refused"** — the app is not running. Run `./launch-app.sh` again and wait until the terminal shows `Uvicorn running`.

## Requirements

- macOS (tested on Mac)
- [mitmproxy](https://mitmproxy.org/): `brew install mitmproxy`
- Python 3.7+
- Node.js 18+

## Usage

1. Run `./launch-app.sh`
2. Click **Start Proxy**
3. On phone: Wi‑Fi proxy → Mac IP, port `8080`
4. Install cert from http://mitm.it (see Setup tab)
5. Use **Map Local** to mock APIs with files in `local-files/`

## Project layout

```
app/
  backend/     # FastAPI control server (port 6789)
  desktop/     # React UI + Electron
map-local-addons.py
config.json
local-files/
launch-app.sh
launch-desktop.sh
```

## Build production UI into backend

```bash
cd app/desktop
npm install
npm run build
cd ../backend
python3 -m uvicorn main:app --host 127.0.0.1 --port 6789
```

Then open http://127.0.0.1:6789 — static files are served from `app/backend/static/`.
