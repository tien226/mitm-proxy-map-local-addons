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

Opens **http://127.0.0.1:9876** automatically (one port — UI + API).

Dev mode (hot reload UI on port 5173):

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
  backend/     # FastAPI control server (port 9876)
  desktop/     # React UI + Electron
map-local-addons.py
config.json
local-files/
launch-app.sh
```

## Build production UI into backend

```bash
cd app/desktop
npm install
npm run build
cd ../backend
python3 -m uvicorn main:app --host 127.0.0.1 --port 9876
```

Then open http://127.0.0.1:9876 — static files are served from `app/backend/static/`.
