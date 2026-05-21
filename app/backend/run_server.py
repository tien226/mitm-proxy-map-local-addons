"""Entry point for TFT Proxy backend (dev, Electron, or PyInstaller bundle)."""

import os
import sys
from pathlib import Path


def resolve_project_root() -> Path:
    env_root = os.environ.get("TFT_PROXY_PROJECT_ROOT")
    if env_root:
        return Path(env_root).resolve()
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS).resolve()
    return Path(__file__).resolve().parents[2]


def main() -> None:
    project_root = resolve_project_root()
    os.environ["TFT_PROXY_PROJECT_ROOT"] = str(project_root)
    import uvicorn
    from main import app
    uvicorn.run(app, host="127.0.0.1", port=6789, log_level="info")


if __name__ == "__main__":
    main()
