"""TFT Proxy App backend API."""

from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from config_store import ConfigStore, MapLocalRule, MapLocalRuleUpdate
from flow_cache import clear_flow_cache, read_cached_body
from flow_utils import normalize_flow, normalize_flows
from proxy_manager import EMULATOR_PROXY_HOST, ProxyManager

app = FastAPI(title="TFT Proxy", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

proxy_manager = ProxyManager()
config_store = ConfigStore()

STATIC_DIR = Path(__file__).resolve().parent / "static"


class ProxyStartRequest(BaseModel):
    proxy_port: int = 8080
    web_port: int = 8081


class LocalFilePayload(BaseModel):
    content: str


@app.get("/api/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


def _proxy_status_payload(status: Any) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "is_running": status.is_running,
        "proxy_port": status.proxy_port,
        "web_port": status.web_port,
        "pid": status.pid,
        "local_ip": ProxyManager.get_local_ip(),
        "emulator_host": EMULATOR_PROXY_HOST,
    }
    if status.error:
        payload["error"] = status.error
    return payload


@app.get("/api/proxy/status")
def get_proxy_status() -> Dict[str, Any]:
    return _proxy_status_payload(proxy_manager.get_status())


@app.post("/api/proxy/start")
def start_proxy(request: ProxyStartRequest) -> Dict[str, Any]:
    status = proxy_manager.start(request.proxy_port, request.web_port)
    payload = _proxy_status_payload(status)
    if not status.is_running:
        raise HTTPException(status_code=500, detail=status.error or "Failed to start mitmweb")
    return payload


@app.post("/api/proxy/stop")
def stop_proxy() -> Dict[str, Any]:
    status = proxy_manager.stop()
    return _proxy_status_payload(status)


@app.get("/api/map-local/rules")
def list_rules() -> List[MapLocalRule]:
    return config_store.list_rules()


@app.post("/api/map-local/rules")
def create_rule(rule: MapLocalRuleUpdate) -> List[MapLocalRule]:
    return config_store.add_rule(rule)


@app.put("/api/map-local/rules/{index}")
def update_rule(index: int, rule: MapLocalRuleUpdate) -> List[MapLocalRule]:
    try:
        return config_store.update_rule(index, rule)
    except IndexError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.delete("/api/map-local/rules/{index}")
def delete_rule(index: int) -> List[MapLocalRule]:
    try:
        return config_store.delete_rule(index)
    except IndexError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.get("/api/map-local/files")
def list_local_files() -> List[str]:
    return config_store.list_local_files()


@app.get("/api/map-local/files/{filename}")
def read_local_file(filename: str) -> Dict[str, str]:
    try:
        return {"filename": filename, "content": config_store.read_local_file(filename)}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="File not found") from error


@app.put("/api/map-local/files/{filename}")
def write_local_file(filename: str, payload: LocalFilePayload) -> Dict[str, str]:
    try:
        config_store.write_local_file(filename, payload.content)
        return {"filename": filename, "status": "saved"}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


async def _proxy_mitmweb(path: str) -> Any:
    if not proxy_manager.is_running():
        detail = proxy_manager.last_error or "Proxy is not running. Click Start Proxy."
        raise HTTPException(status_code=503, detail=detail)
    try:
        response = proxy_manager.fetch_mitmweb(path)
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"Cannot reach mitmweb: {error}") from error
    if response.status_code == 403:
        raise HTTPException(
            status_code=503,
            detail="mitmweb auth failed. Stop proxy and Start again.",
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    return response.json()


@app.post("/api/flows/clear")
def clear_flows() -> Dict[str, str]:
    proxy_manager.sync_ports_from_running_process()
    if not proxy_manager.is_running():
        raise HTTPException(status_code=503, detail="Proxy is not running. Click Start Proxy.")
    cleared = proxy_manager.clear_flows()
    clear_flow_cache()
    if not cleared:
        detail = proxy_manager.last_error or "Failed to clear flows in mitmproxy"
        raise HTTPException(status_code=502, detail=detail)
    return {"status": "cleared"}


@app.get("/api/flows")
async def list_flows() -> Any:
    flows = await _proxy_mitmweb("/flows")
    if isinstance(flows, list):
        return normalize_flows(flows)
    return flows


@app.get("/api/flows/{flow_id}")
async def get_flow(flow_id: str) -> Any:
    flow = await _proxy_mitmweb(f"/flows/{flow_id}")
    if isinstance(flow, dict):
        return normalize_flow(flow)
    return flow


@app.get("/api/flows/{flow_id}/content/{message}")
def get_flow_content(flow_id: str, message: str) -> Dict[str, str]:
    if message not in ("request", "response"):
        raise HTTPException(status_code=400, detail="message must be request or response")
    cached_body = read_cached_body(flow_id, message)
    if cached_body is not None:
        return {"content": cached_body, "source": "cache"}
    proxy_manager.sync_ports_from_running_process()
    if not proxy_manager.is_running():
        raise HTTPException(status_code=503, detail="Proxy is not running. Click Start Proxy.")
    raw_path = f"/flows/{flow_id}/{message}/content.data"
    auto_path = f"/flows/{flow_id}/{message}/content/auto.json"
    try:
        raw_response = proxy_manager.fetch_mitmweb(raw_path)
        if raw_response.status_code == 200 and len(raw_response.content) > 0:
            return {"content": raw_response.text, "source": "mitmweb"}
        auto_response = proxy_manager.fetch_mitmweb(auto_path)
        if auto_response.status_code == 200:
            payload = auto_response.json()
            text = payload.get("text", "")
            if text:
                return {"content": text, "source": "mitmweb"}
        return {
            "content": "",
            "error": "Body not available. Click the request again or capture new traffic.",
        }
    except httpx.HTTPError as error:
        return {"content": "", "error": f"Cannot load body: {error}"}


if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str) -> FileResponse:
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")
