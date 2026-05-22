"""Normalize mitmproxy 12 flow JSON for the TFT Proxy UI."""

from typing import Any, Dict, List, Optional


def build_pretty_url(request: Dict[str, Any]) -> str:
    scheme = request.get("scheme") or "https"
    host = request.get("host") or ""
    port = request.get("port")
    path = request.get("path") or "/"
    url = f"{scheme}://{host}"
    if port and port not in (80, 443):
        url = f"{url}:{port}"
    if not path.startswith("/"):
        path = f"/{path}"
    return f"{url}{path}"


def has_map_local_header(headers: Optional[List[Any]]) -> bool:
    if not headers:
        return False
    for header in headers:
        if isinstance(header, (list, tuple)) and len(header) >= 2:
            name = str(header[0]).lower()
            if name == "x-map-local":
                return True
    return False


def compute_duration_ms(request: Dict[str, Any], response: Optional[Dict[str, Any]]) -> Optional[float]:
    if response is None:
        return None
    request_start = request.get("timestamp_start")
    response_end = response.get("timestamp_end")
    if request_start is None or response_end is None:
        return None
    try:
        return (float(response_end) - float(request_start)) * 1000.0
    except (TypeError, ValueError):
        return None


def _slim_message(message: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if message is None:
        return None
    slimmed = dict(message)
    slimmed.pop("content", None)
    slimmed.pop("text", None)
    slimmed.pop("raw_content", None)
    return slimmed


def normalize_flow(flow: Dict[str, Any], *, for_list: bool = False) -> Dict[str, Any]:
    request_raw = flow.get("request") or {}
    response_raw = flow.get("response")
    request = dict(request_raw)
    response = dict(response_raw) if response_raw else None
    request["pretty_url"] = build_pretty_url(request)
    map_local = False
    if response:
        map_local = has_map_local_header(response.get("headers"))
    if for_list:
        request = _slim_message(request) or {}
        request["pretty_url"] = build_pretty_url(request_raw)
        response = _slim_message(response)
    normalized: Dict[str, Any] = {
        "id": flow.get("id"),
        "request": request,
        "response": response,
        "metadata": {"map_local": "true" if map_local else "false"},
    }
    duration_ms = compute_duration_ms(request_raw, response_raw)
    if duration_ms is not None:
        normalized["duration_ms"] = round(duration_ms, 2)
    if "timestamp_created" in flow:
        normalized["timestamp_created"] = flow["timestamp_created"]
    if "client_conn" in flow:
        normalized["client_conn"] = flow["client_conn"]
    if not for_list:
        for key in ("error", "type", "marked", "comment", "intercepted"):
            if key in flow:
                normalized[key] = flow[key]
    return normalized


def normalize_flows(flows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [normalize_flow(flow, for_list=False) for flow in flows]


def normalize_flows_for_list(flows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [normalize_flow(flow, for_list=True) for flow in flows]


def extract_flow_list(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        for key in ("flows", "data", "items"):
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
    return []
