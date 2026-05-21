# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for TFT Proxy backend bundle."""

import sys
from pathlib import Path

backend_dir = Path(SPECPATH)
static_dir = backend_dir / "static"

datas = []
if static_dir.exists():
    datas.append((str(static_dir), "static"))

hiddenimports = [
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "uvicorn.__main__",
    "fastapi",
    "pydantic",
    "httpx",
    "config_store",
    "flow_cache",
    "flow_utils",
    "proxy_manager",
    "project_paths",
]

a = Analysis(
    ["run_server.py"],
    pathex=[str(backend_dir)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="tft-proxy-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
