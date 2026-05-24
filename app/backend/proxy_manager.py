"""Manage mitmweb subprocess lifecycle."""

import os
import shutil
import signal
import socket
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import httpx

from project_paths import get_project_root

PROJECT_ROOT = get_project_root()
ADDON_SCRIPT = PROJECT_ROOT / "map-local-addons.py"
LOG_FILE = PROJECT_ROOT / ".mitmweb.log"
DEFAULT_PROXY_PORT = 8080
DEFAULT_WEB_PORT = 8081
EMULATOR_PROXY_HOST = "10.0.2.2"
WEB_PASSWORD = "tftproxy"
MITMWEB_CANDIDATE_PATHS: List[str] = [
    "/opt/homebrew/bin/mitmweb",
    "/usr/local/bin/mitmweb",
]
READY_POLL_INTERVAL_SECONDS = 0.05
READY_TCP_TIMEOUT_SECONDS = 0.08
READY_HTTP_TIMEOUT_SECONDS = 0.35
DEFAULT_READY_TIMEOUT_SECONDS = 6.0
_cached_mitmweb_executable: Optional[str] = None
_cached_local_ip: Optional[str] = None


def resolve_mitmweb_executable() -> Optional[str]:
    global _cached_mitmweb_executable
    if _cached_mitmweb_executable is not None:
        return _cached_mitmweb_executable
    env_path = os.environ.get("MITMWEB_PATH") or os.environ.get("MITM_PROXY_MITMWEB")
    if env_path:
        env_candidate = Path(env_path).expanduser()
        if env_candidate.is_file():
            _cached_mitmweb_executable = str(env_candidate)
            return _cached_mitmweb_executable
    found = shutil.which("mitmweb")
    if found:
        _cached_mitmweb_executable = found
        return found
    for candidate in MITMWEB_CANDIDATE_PATHS:
        if Path(candidate).is_file():
            _cached_mitmweb_executable = candidate
            return candidate
    return None


@dataclass
class ProxyStatus:
    is_running: bool
    proxy_port: int
    web_port: int
    pid: Optional[int]
    error: Optional[str] = None
    reused_existing: bool = False


class ProxyManager:
    def __init__(self) -> None:
        self.process: Optional[subprocess.Popen[str]] = None
        self.proxy_port: int = DEFAULT_PROXY_PORT
        self.web_port: int = DEFAULT_WEB_PORT
        self.web_token: str = WEB_PASSWORD
        self.last_error: Optional[str] = None
        self._mitmweb_client: Optional[httpx.Client] = None
        self._ready_probe_client: Optional[httpx.Client] = None

    def ensure_running(
        self, proxy_port: int = DEFAULT_PROXY_PORT, web_port: int = DEFAULT_WEB_PORT
    ) -> ProxyStatus:
        self.proxy_port = proxy_port
        self.web_port = web_port
        if self.is_mitmweb_ready():
            self._warm_mitmweb_client()
            status = self.get_status()
            status.reused_existing = True
            return status
        return self.start(proxy_port, web_port)

    def start(self, proxy_port: int = DEFAULT_PROXY_PORT, web_port: int = DEFAULT_WEB_PORT) -> ProxyStatus:
        self.proxy_port = proxy_port
        self.web_port = web_port
        if self.is_mitmweb_ready():
            self._warm_mitmweb_client()
            return self.get_status()
        self.last_error = None
        if self._any_port_listening(proxy_port, web_port):
            self._close_mitmweb_client()
            if self.process is not None:
                self._terminate_process()
            self._kill_processes_on_ports(proxy_port, web_port)
            time.sleep(0.08)
        else:
            self._close_mitmweb_client()
            self._terminate_process()
        mitmweb_bin = resolve_mitmweb_executable()
        if mitmweb_bin is None:
            self.last_error = (
                "mitmweb not found. Install mitmproxy: brew install mitmproxy "
                "(or set MITMWEB_PATH to the mitmweb binary)."
            )
            return self.get_status()
        log_handle = LOG_FILE.open("w", encoding="utf-8")
        command = [
            mitmweb_bin,
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
        if not self._wait_until_ready(timeout_seconds=DEFAULT_READY_TIMEOUT_SECONDS):
            self.last_error = self._read_log_tail()
            self._terminate_process()
        else:
            self._warm_mitmweb_client()
        return self.get_status()

    def _terminate_process(self) -> None:
        if self.process is None:
            return
        if sys.platform != "win32":
            try:
                os.killpg(os.getpgid(self.process.pid), signal.SIGTERM)
            except ProcessLookupError:
                pass
        else:
            self.process.terminate()
        try:
            self.process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            if sys.platform != "win32":
                try:
                    os.killpg(os.getpgid(self.process.pid), signal.SIGKILL)
                except ProcessLookupError:
                    pass
            else:
                self.process.kill()
        self.process = None

    def _close_mitmweb_client(self) -> None:
        if self._mitmweb_client is not None:
            self._mitmweb_client.close()
            self._mitmweb_client = None
        if self._ready_probe_client is not None:
            self._ready_probe_client.close()
            self._ready_probe_client = None

    def stop(self) -> ProxyStatus:
        self._close_mitmweb_client()
        self._terminate_process()
        self._kill_processes_on_ports(self.proxy_port, self.web_port)
        return self.get_status()

    def _get_ready_probe_client(self) -> httpx.Client:
        if self._ready_probe_client is None:
            self._ready_probe_client = httpx.Client(
                base_url=f"http://127.0.0.1:{self.web_port}",
                timeout=READY_HTTP_TIMEOUT_SECONDS,
                follow_redirects=True,
            )
        return self._ready_probe_client

    def _warm_mitmweb_client(self) -> None:
        try:
            self._get_mitmweb_client()
        except httpx.HTTPError:
            pass

    def is_mitmweb_ready(self) -> bool:
        if not self._is_web_port_open():
            return False
        try:
            response = self._get_ready_probe_client().get(
                "/flows",
                params={"token": self.web_token},
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

    def _is_web_port_open(self) -> bool:
        try:
            with socket.create_connection(
                ("127.0.0.1", self.web_port),
                timeout=READY_TCP_TIMEOUT_SECONDS,
            ):
                return True
        except OSError:
            return False

    def _any_port_listening(self, *ports: int) -> bool:
        for port in ports:
            try:
                with socket.create_connection(
                    ("127.0.0.1", port),
                    timeout=READY_TCP_TIMEOUT_SECONDS,
                ):
                    return True
            except OSError:
                continue
        return False

    def _wait_until_ready(self, timeout_seconds: float) -> bool:
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            if self.process is not None and self.process.poll() is not None:
                return False
            if self._is_web_port_open() and self.is_mitmweb_ready():
                return True
            time.sleep(READY_POLL_INTERVAL_SECONDS)
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
        global _cached_local_ip
        if _cached_local_ip is not None:
            return _cached_local_ip
        candidates: List[str] = []
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                sock.connect(("8.8.8.8", 80))
                candidates.append(sock.getsockname()[0])
        except OSError:
            pass
        try:
            hostname = socket.gethostname()
            for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
                address = info[4][0]
                if address and not address.startswith("127."):
                    candidates.append(address)
        except OSError:
            pass
        for candidate in candidates:
            if candidate and not candidate.startswith("127."):
                _cached_local_ip = candidate
                return candidate
        _cached_local_ip = candidates[0] if candidates else "127.0.0.1"
        return _cached_local_ip

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
            client = self._get_mitmweb_client()
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

    def _get_mitmweb_client(self) -> httpx.Client:
        if self._mitmweb_client is None:
            self._mitmweb_client = httpx.Client(
                base_url=f"http://127.0.0.1:{self.web_port}",
                timeout=httpx.Timeout(connect=1.0, read=12.0, write=5.0, pool=1.0),
                follow_redirects=True,
            )
            self._authenticate_mitmweb_client(self._mitmweb_client)
        return self._mitmweb_client

    def _mitmweb_request_params(self, client: httpx.Client) -> tuple[Dict[str, str], Dict[str, str]]:
        xsrf_token = self._get_xsrf_token(client)
        params: Dict[str, str] = {"token": self.web_token}
        headers: Dict[str, str] = {}
        if xsrf_token is not None:
            params["_xsrf"] = xsrf_token
            headers["X-Xsrftoken"] = xsrf_token
        return params, headers

    def fetch_mitmweb(self, path: str) -> httpx.Response:
        client = self._get_mitmweb_client()
        params, headers = self._mitmweb_request_params(client)
        response = client.get(path, params=params, headers=headers)
        if response.status_code == 403:
            self._close_mitmweb_client()
            client = self._get_mitmweb_client()
            params, headers = self._mitmweb_request_params(client)
            response = client.get(path, params=params, headers=headers)
        return response

    def sync_ports_from_running_process(self) -> None:
        """Keep web_port in sync when mitmweb was started outside this manager."""
        if self.is_mitmweb_ready():
            return
        for web_port in (DEFAULT_WEB_PORT, 8081, 8082):
            self.web_port = web_port
            if self.is_mitmweb_ready():
                return
        self.web_port = DEFAULT_WEB_PORT
