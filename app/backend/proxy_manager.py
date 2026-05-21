"""Manage mitmweb subprocess lifecycle."""

import os
import signal
import socket
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional

import httpx

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ADDON_SCRIPT = PROJECT_ROOT / "map-local-addons.py"
LOG_FILE = PROJECT_ROOT / ".mitmweb.log"
DEFAULT_PROXY_PORT = 8080
DEFAULT_WEB_PORT = 8081
EMULATOR_PROXY_HOST = "10.0.2.2"
WEB_PASSWORD = "tftproxy"


@dataclass
class ProxyStatus:
    is_running: bool
    proxy_port: int
    web_port: int
    pid: Optional[int]
    error: Optional[str] = None


class ProxyManager:
    def __init__(self) -> None:
        self.process: Optional[subprocess.Popen[str]] = None
        self.proxy_port: int = DEFAULT_PROXY_PORT
        self.web_port: int = DEFAULT_WEB_PORT
        self.web_token: str = WEB_PASSWORD
        self.last_error: Optional[str] = None

    def start(self, proxy_port: int = DEFAULT_PROXY_PORT, web_port: int = DEFAULT_WEB_PORT) -> ProxyStatus:
        self.proxy_port = proxy_port
        self.web_port = web_port
        if self.is_mitmweb_ready():
            return self.get_status()
        self.stop()
        self._kill_processes_on_ports(proxy_port, web_port)
        self.last_error = None
        log_handle = LOG_FILE.open("w", encoding="utf-8")
        command = [
            "mitmweb",
            "-s",
            str(ADDON_SCRIPT),
            "--listen-host",
            "0.0.0.0",
            "--listen-port",
            str(proxy_port),
            "--web-port",
            str(web_port),
            "--set",
            "web_open_browser=false",
            "--set",
            "web_host=127.0.0.1",
            "--set",
            f"web_password={WEB_PASSWORD}",
        ]
        try:
            self.process = subprocess.Popen(
                command,
                cwd=str(PROJECT_ROOT),
                stdout=log_handle,
                stderr=subprocess.STDOUT,
                text=True,
                preexec_fn=os.setsid if sys.platform != "win32" else None,
            )
        except OSError as error:
            self.last_error = str(error)
            log_handle.close()
            return self.get_status()
        if not self._wait_until_ready(timeout_seconds=8.0):
            self.last_error = self._read_log_tail()
            self.stop()
        return self.get_status()

    def stop(self) -> ProxyStatus:
        self._kill_processes_on_ports(self.proxy_port, self.web_port)
        if self.process is not None:
            if sys.platform != "win32":
                try:
                    os.killpg(os.getpgid(self.process.pid), signal.SIGTERM)
                except ProcessLookupError:
                    pass
            else:
                self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                if sys.platform != "win32":
                    try:
                        os.killpg(os.getpgid(self.process.pid), signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                else:
                    self.process.kill()
        self.process = None
        return self.get_status()

    def is_mitmweb_ready(self) -> bool:
        try:
            response = httpx.get(
                f"http://127.0.0.1:{self.web_port}/flows",
                params={"token": self.web_token},
                timeout=1.5,
            )
            return response.status_code == 200
        except httpx.HTTPError:
            return False

    def is_running(self) -> bool:
        if self.process is not None and self.process.poll() is None:
            return self.is_mitmweb_ready()
        return self.is_mitmweb_ready()

    def get_status(self) -> ProxyStatus:
        pid: Optional[int] = None
        if self.process is not None and self.process.poll() is None:
            pid = self.process.pid
        is_ready = self.is_mitmweb_ready()
        return ProxyStatus(
            is_running=is_ready,
            proxy_port=self.proxy_port,
            web_port=self.web_port,
            pid=pid,
            error=self.last_error,
        )

    def _wait_until_ready(self, timeout_seconds: float) -> bool:
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            if self.process is not None and self.process.poll() is not None:
                return False
            if self.is_mitmweb_ready():
                return True
            time.sleep(0.25)
        return False

    def _kill_processes_on_ports(self, *ports: int) -> None:
        for port in ports:
            try:
                result = subprocess.run(
                    ["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN", "-t"],
                    capture_output=True,
                    text=True,
                    check=False,
                )
            except OSError:
                continue
            for pid_text in result.stdout.strip().split():
                if not pid_text.isdigit():
                    continue
                pid = int(pid_text)
                try:
                    os.kill(pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass

    def _read_log_tail(self) -> str:
        if not LOG_FILE.exists():
            return "mitmweb failed to start. Check mitmproxy is installed."
        lines = LOG_FILE.read_text(encoding="utf-8", errors="replace").strip().splitlines()
        tail = "\n".join(lines[-8:]) if lines else "mitmweb failed to start."
        return tail

    @staticmethod
    def get_local_ip() -> str:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                sock.connect(("8.8.8.8", 80))
                return sock.getsockname()[0]
        except OSError:
            return "127.0.0.1"

    def _authenticate_mitmweb_client(self, client: httpx.Client) -> None:
        # XSRF cookie is issued only when loading the mitmweb UI (GET /), not API routes like /flows.
        client.get("/", params={"token": self.web_token})

    def _get_xsrf_token(self, client: httpx.Client) -> Optional[str]:
        for cookie_name in ("_xsrf", "_mitmproxy_xsrf"):
            value = client.cookies.get(cookie_name)
            if value:
                return value
        for cookie_name in client.cookies.jar:
            if "xsrf" in cookie_name.lower():
                return client.cookies.get(cookie_name)
        return None

    def clear_flows(self) -> bool:
        if not self.is_running():
            self.last_error = "Proxy is not running"
            return False
        try:
            with httpx.Client(
                base_url=f"http://127.0.0.1:{self.web_port}",
                timeout=10.0,
                follow_redirects=True,
            ) as client:
                self._authenticate_mitmweb_client(client)
                xsrf_token = self._get_xsrf_token(client)
                if xsrf_token is None:
                    self.last_error = "mitmweb XSRF token missing; reload mitmweb UI and try again"
                    return False
                params: Dict[str, str] = {"token": self.web_token, "_xsrf": xsrf_token}
                headers: Dict[str, str] = {"X-Xsrftoken": xsrf_token}
                response = client.post("/clear", params=params, headers=headers)
                if response.status_code < 400:
                    self.last_error = None
                    return True
                self.last_error = f"mitmweb clear failed (HTTP {response.status_code})"
                return False
        except httpx.HTTPError as error:
            self.last_error = f"Cannot reach mitmweb: {error}"
            return False

    def fetch_mitmweb(self, path: str) -> httpx.Response:
        return httpx.get(
            f"http://127.0.0.1:{self.web_port}{path}",
            params={"token": self.web_token},
            timeout=30.0,
        )

    def sync_ports_from_running_process(self) -> None:
        """Keep web_port in sync when mitmweb was started outside this manager."""
        if self.is_mitmweb_ready():
            return
        for web_port in (DEFAULT_WEB_PORT, 8081, 8082):
            self.web_port = web_port
            if self.is_mitmweb_ready():
                return
        self.web_port = DEFAULT_WEB_PORT
