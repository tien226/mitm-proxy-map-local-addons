"""Map Local addons for mitmproxy."""

import json
import logging
import os
import time
from pathlib import Path
from typing import List, Optional
from urllib.parse import parse_qs, urljoin, urlparse

from mitmproxy import ctx, http

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent
CONFIG_PATH = PROJECT_ROOT / "config.json"
LOCAL_FILES_DIR = PROJECT_ROOT / "local-files"
FLOW_CACHE_DIR = PROJECT_ROOT / ".flow-cache"
MAX_CACHE_FILES = 500


class MapLocalConfig:
    def __init__(
        self,
        url: str,
        method: str,
        map_local_file: str,
        status_code: int = 200,
        delay_ms: int = 0,
    ) -> None:
        self.url = url
        self.method = method
        self.map_local_file = map_local_file
        self.status_code = status_code
        self.delay_ms = delay_ms


class TftMapLocal:
    def __init__(self) -> None:
        self.map_local_configs: List[MapLocalConfig] = []
        self.config_mtime: float = 0.0
        self.load_configs()

    def load_configs(self) -> None:
        if not CONFIG_PATH.exists():
            self.map_local_configs = []
            self.config_mtime = 0.0
            return
        current_mtime = CONFIG_PATH.stat().st_mtime
        if current_mtime == self.config_mtime:
            return
        with CONFIG_PATH.open("r", encoding="utf-8") as config_file:
            data = json.load(config_file)
        configs: List[MapLocalConfig] = []
        for entry in data:
            configs.append(
                MapLocalConfig(
                    url=entry["url"],
                    method=entry["method"],
                    map_local_file=entry["local_file"],
                    status_code=entry.get("status_code", 200),
                    delay_ms=entry.get("delay_ms", 0),
                )
            )
        self.map_local_configs = configs
        self.config_mtime = current_mtime
        logger.info("Loaded %s map local rules", len(configs))

    def request(self, flow: http.HTTPFlow) -> None:
        self.load_configs()
        for config in self.map_local_configs:
            if config.map_local_file is None:
                continue
            if config.method != flow.request.method:
                continue
            if not self.is_same_url(config.url, flow.request.pretty_url):
                continue
            local_path = LOCAL_FILES_DIR / config.map_local_file
            if not local_path.exists():
                logger.warning("Map local file missing: %s", local_path)
                continue
            with local_path.open("r", encoding="utf-8") as local_file:
                data = local_file.read()
            if config.delay_ms > 0:
                time.sleep(config.delay_ms / 1000.0)
            flow.response = http.Response.make(
                config.status_code,
                data,
                {"Content-Type": "application/json", "X-Map-Local": "true"},
            )
            flow.metadata["map_local"] = "true"
            flow.metadata["map_local_file"] = config.map_local_file
            self.save_flow_cache(flow)
            return

    def response(self, flow: http.HTTPFlow) -> None:
        self.save_flow_cache(flow)

    def save_flow_cache(self, flow: http.HTTPFlow) -> None:
        if not flow.request:
            return
        FLOW_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        request_body: str = ""
        response_body: str = ""
        try:
            request_body = flow.request.get_text(strict=False) or ""
        except (ValueError, TypeError):
            request_body = ""
        if flow.response is not None:
            try:
                response_body = flow.response.get_text(strict=False) or ""
            except (ValueError, TypeError):
                response_body = ""
        cache_payload = {
            "method": flow.request.method,
            "url": flow.request.pretty_url,
            "status_code": flow.response.status_code if flow.response else None,
            "request": request_body,
            "response": response_body,
        }
        cache_path = FLOW_CACHE_DIR / f"{flow.id}.json"
        with cache_path.open("w", encoding="utf-8") as cache_file:
            json.dump(cache_payload, cache_file)
        self.trim_flow_cache()

    def trim_flow_cache(self) -> None:
        cache_files = sorted(
            FLOW_CACHE_DIR.glob("*.json"),
            key=lambda file_path: file_path.stat().st_mtime,
        )
        if len(cache_files) <= MAX_CACHE_FILES:
            return
        for old_file in cache_files[: len(cache_files) - MAX_CACHE_FILES]:
            old_file.unlink(missing_ok=True)

    def is_same_url(self, lhs: str, rhs: str) -> bool:
        parsed_lhs = urlparse(lhs)
        lhs_query_params = parse_qs(parsed_lhs.query)
        parsed_rhs = urlparse(rhs)
        rhs_query_params = parse_qs(parsed_rhs.query)
        lhs_url = urljoin(lhs, parsed_lhs.path)
        rhs_url = urljoin(lhs, parsed_rhs.path)
        if lhs_url != rhs_url:
            return False
        lhs_keys = list(lhs_query_params.keys())
        rhs_keys = list(rhs_query_params.keys())
        if len(lhs_keys) != len(rhs_keys):
            return False
        for key in lhs_keys:
            if lhs_query_params[key] != rhs_query_params[key]:
                return False
        for key in rhs_keys:
            if lhs_query_params.get(key) != rhs_query_params.get(key):
                return False
        return True


addons = [TftMapLocal()]
