"""Read flow bodies cached by the mitmproxy addon."""

import json
from pathlib import Path
from typing import Any, Dict, Optional

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CACHE_DIR = PROJECT_ROOT / ".flow-cache"
MAX_CACHE_FILES = 500


def read_cached_flow(flow_id: str) -> Optional[Dict[str, Any]]:
    cache_path = CACHE_DIR / f"{flow_id}.json"
    if not cache_path.exists():
        return None
    try:
        with cache_path.open("r", encoding="utf-8") as cache_file:
            return json.load(cache_file)
    except (json.JSONDecodeError, OSError):
        return None


def clear_flow_cache() -> None:
    if not CACHE_DIR.exists():
        return
    for cache_file in CACHE_DIR.glob("*.json"):
        cache_file.unlink(missing_ok=True)


def read_cached_body(flow_id: str, message: str) -> Optional[str]:
    cached_flow = read_cached_flow(flow_id)
    if cached_flow is None:
        return None
    body = cached_flow.get(message)
    if body is None:
        return None
    return str(body)
