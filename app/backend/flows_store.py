"""In-memory cache for normalized flow list snapshots."""

import hashlib
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set, Tuple

from flow_utils import normalize_flows_for_list

_last_version: int = 0
_last_fingerprint: str = ""
_last_flows: List[Dict[str, Any]] = []
_DELTA_MIN_SAVED_RATIO = 0.65


@dataclass
class FlowUpdateResult:
    version: int
    flows: List[Dict[str, Any]]
    unchanged: bool
    partial: bool = False
    reset: bool = False
    removed_flow_ids: Optional[List[str]] = None


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


def _normalized_flow_signature(flow: Dict[str, Any]) -> str:
    response = flow.get("response") or {}
    status_code = response.get("status_code", "")
    duration_ms = flow.get("duration_ms", "")
    timestamp_created = flow.get("timestamp_created", "")
    return f"{flow.get('id')}:{status_code}:{duration_ms}:{timestamp_created}"


def _flow_entry_changed(previous: Dict[str, Any], current: Dict[str, Any]) -> bool:
    return _normalized_flow_signature(previous) != _normalized_flow_signature(current)


def _compute_delta(
    previous: List[Dict[str, Any]], current: List[Dict[str, Any]]
) -> Tuple[List[Dict[str, Any]], List[str]]:
    previous_by_id: Dict[str, Dict[str, Any]] = {
        str(flow.get("id", "")): flow for flow in previous if flow.get("id") is not None
    }
    current_ids: Set[str] = set()
    delta: List[Dict[str, Any]] = []
    for flow in current:
        flow_id = str(flow.get("id", ""))
        if not flow_id:
            continue
        current_ids.add(flow_id)
        previous_flow = previous_by_id.get(flow_id)
        if previous_flow is None or _flow_entry_changed(previous_flow, flow):
            delta.append(flow)
    removed_flow_ids = [
        flow_id for flow_id in previous_by_id.keys() if flow_id not in current_ids
    ]
    return delta, removed_flow_ids


def update_flows(
    raw_flows: List[Dict[str, Any]], *, since: Optional[int] = None
) -> FlowUpdateResult:
    global _last_version, _last_fingerprint, _last_flows
    fingerprint = _build_fingerprint(raw_flows)
    if fingerprint == _last_fingerprint and _last_flows:
        return FlowUpdateResult(version=_last_version, flows=[], unchanged=True)
    if not raw_flows and _last_flows:
        return FlowUpdateResult(version=_last_version, flows=[], unchanged=True)
    normalized = normalize_flows_for_list(raw_flows)
    version_reset = since is not None and since > 0 and _last_version > 0 and since > _last_version
    previous = _last_flows
    _last_version += 1
    _last_fingerprint = fingerprint
    _last_flows = normalized
    if version_reset or not previous:
        return FlowUpdateResult(
            version=_last_version,
            flows=normalized,
            unchanged=False,
            partial=False,
            reset=version_reset,
        )
    delta, removed_flow_ids = _compute_delta(previous, normalized)
    if not delta and not removed_flow_ids:
        return FlowUpdateResult(version=_last_version, flows=[], unchanged=True)
    use_delta = bool(delta) and len(delta) < len(normalized) * _DELTA_MIN_SAVED_RATIO
    if use_delta:
        return FlowUpdateResult(
            version=_last_version,
            flows=delta,
            unchanged=False,
            partial=True,
            removed_flow_ids=removed_flow_ids or None,
        )
    return FlowUpdateResult(
        version=_last_version,
        flows=normalized,
        unchanged=False,
        partial=False,
        removed_flow_ids=removed_flow_ids or None,
    )


def reset_flows_store() -> None:
    global _last_version, _last_fingerprint, _last_flows
    _last_version = 0
    _last_fingerprint = ""
    _last_flows = []
