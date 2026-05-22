"""In-memory cache for normalized flow list snapshots."""

import hashlib
from typing import Any, Dict, List, Optional, Tuple

from flow_utils import normalize_flows_for_list

_last_version: int = 0
_last_fingerprint: str = ""
_last_flows: List[Dict[str, Any]] = []


def _build_fingerprint(raw_flows: List[Dict[str, Any]]) -> str:
    parts: List[str] = []
    for flow in raw_flows:
        flow_id = str(flow.get("id", ""))
        response = flow.get("response") or {}
        status_code = response.get("status_code", "")
        timestamp = flow.get("timestamp_created", "")
        parts.append(f"{flow_id}:{status_code}:{timestamp}")
    digest_input = "\n".join(parts).encode("utf-8")
    return hashlib.sha256(digest_input).hexdigest()


def update_flows(raw_flows: List[Dict[str, Any]]) -> Tuple[int, List[Dict[str, Any]], bool]:
    global _last_version, _last_fingerprint, _last_flows
    fingerprint = _build_fingerprint(raw_flows)
    if fingerprint == _last_fingerprint and _last_flows:
        return _last_version, _last_flows, True
    normalized = normalize_flows_for_list(raw_flows)
    _last_version += 1
    _last_fingerprint = fingerprint
    _last_flows = normalized
    return _last_version, normalized, False


def reset_flows_store() -> None:
    global _last_version, _last_fingerprint, _last_flows
    _last_version = 0
    _last_fingerprint = ""
    _last_flows = []
