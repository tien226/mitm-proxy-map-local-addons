"""Track client IPs that connect through mitmproxy."""

import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from project_paths import get_project_root

PROJECT_ROOT = get_project_root()
CLIENTS_PATH = PROJECT_ROOT / ".connected-clients.json"
MAX_AGE_SECONDS = 86400


def _read_store() -> Dict[str, float]:
    if not CLIENTS_PATH.exists():
        return {}
    try:
        with CLIENTS_PATH.open("r", encoding="utf-8") as store_file:
            raw = json.load(store_file)
    except (json.JSONDecodeError, OSError):
        return {}
    if not isinstance(raw, dict):
        return {}
    store: Dict[str, float] = {}
    for ip, seen_at in raw.items():
        if isinstance(ip, str) and isinstance(seen_at, (int, float)):
            store[ip] = float(seen_at)
    return store


def _write_store(store: Dict[str, float]) -> None:
    CLIENTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CLIENTS_PATH.open("w", encoding="utf-8") as store_file:
        json.dump(store, store_file)


def _prune_store(store: Dict[str, float]) -> Dict[str, float]:
    cutoff = time.time() - MAX_AGE_SECONDS
    return {ip: seen_at for ip, seen_at in store.items() if seen_at >= cutoff}


def extract_client_ip(client_conn: Any) -> Optional[str]:
    if client_conn is None:
        return None
    if isinstance(client_conn, dict):
        peername = client_conn.get("peername") or client_conn.get("address")
        if isinstance(peername, (list, tuple)) and len(peername) > 0:
            return str(peername[0])
        return None
    peername = getattr(client_conn, "peername", None) or getattr(client_conn, "address", None)
    if isinstance(peername, (list, tuple)) and len(peername) > 0:
        return str(peername[0])
    return None


def register_client_ip(client_ip: str) -> None:
    if not client_ip or client_ip in ("127.0.0.1", "::1", "0.0.0.0"):
        return
    store = _prune_store(_read_store())
    store[client_ip] = time.time()
    _write_store(store)


def register_client_from_flow(flow: Any) -> None:
    client_conn = flow.client_conn if hasattr(flow, "client_conn") else None
    if client_conn is None and isinstance(flow, dict):
        client_conn = flow.get("client_conn")
    client_ip = extract_client_ip(client_conn)
    if client_ip:
        register_client_ip(client_ip)


def list_connected_clients() -> List[Dict[str, Any]]:
    store = _prune_store(_read_store())
    clients = [{"ip": ip, "last_seen": seen_at} for ip, seen_at in store.items()]
    clients.sort(key=lambda item: float(item["last_seen"]), reverse=True)
    return clients


def clear_connected_clients() -> None:
    if CLIENTS_PATH.exists():
        CLIENTS_PATH.unlink(missing_ok=True)


def merge_clients_from_flows(flows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    store = {entry["ip"]: float(entry["last_seen"]) for entry in list_connected_clients()}
    now = time.time()
    for flow in flows:
        client_ip = extract_client_ip(flow.get("client_conn"))
        if client_ip:
            store[client_ip] = max(store.get(client_ip, 0.0), now)
    clients = [{"ip": ip, "last_seen": seen_at} for ip, seen_at in store.items()]
    clients.sort(key=lambda item: item["last_seen"], reverse=True)
    return clients
