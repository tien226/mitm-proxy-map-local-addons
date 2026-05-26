"""In-memory cache for normalized flow list snapshots."""

import hashlib
from typing import Any, Dict, List, Optional, Tuple

from flow_utils import normalize_flows_for_list

_last_version: int = 0
_last_fingerprint: str = ""
_last_flows: List[Dict[str, Any]] = []


def _raw_flow_signature(flow: Dict[str, Any]) -> str:
    response = flow.get("response") or {}
    status_code = response.get("status_code", "")
    timestamp_end = response.get("timestamp_end", "")
    return f"{flow.get('id')}:{status_code}:{timestamp_end}"


def _build_fingerprint(raw_flows: List[Dict[str, Any]]) -> str:
    if not raw_flows:
        return "0"
    parts = [_raw_flow_signature(flow) for flow in raw_flows]
    digest = hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:20]
    return f"{len(raw_flows)}:{digest}"


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
