"""Resolve TFT Proxy project root (repo or Electron Resources)."""

import os
from pathlib import Path


def get_project_root() -> Path:
    env_root = os.environ.get("TFT_PROXY_PROJECT_ROOT")
    if env_root:
        return Path(env_root).resolve()
    return Path(__file__).resolve().parents[2]
