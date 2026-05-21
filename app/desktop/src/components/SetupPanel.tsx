import type { ProxyStatus } from "../types";

interface SetupPanelProps {
  status: ProxyStatus;
}

export function SetupPanel({ status }: SetupPanelProps) {
  const emulatorHost = status.emulator_host || "10.0.2.2";
  return (
    <div className="setup-panel">
      <h2>Device Setup</h2>
      <div className="setup-card">
        <h3>1. Start proxy</h3>
        <p>
          Click <strong>Start Proxy</strong> in the toolbar. Proxy listens on{" "}
          <code>0.0.0.0:{status.proxy_port}</code> (all interfaces).
        </p>
      </div>
      <div className="setup-card setup-card-primary">
        <h3>2. Physical phone (same Wi‑Fi as Mac)</h3>
        <p>
          Use your Mac IP — <strong>do not</strong> use <code>{emulatorHost}</code>.
        </p>
        <p>
          Wi‑Fi → your network → Proxy → <strong>Manual</strong>:
          <br />
          Host: <code>{status.local_ip}</code>
          <br />
          Port: <code>{status.proxy_port}</code>
        </p>
        <p>
          <strong>Bypass proxy for:</strong> clear all fields (leave empty). Remove{" "}
          <code>example.com</code>, <code>localhost</code>, etc. — defaults often cause
          &quot;no internet&quot; errors.
        </p>
        <p>Turn off VPN on the phone. Mac and phone must be on the same Wi‑Fi.</p>
        <p>
          On the phone, open Safari/Chrome → <code>http://mitm.it</code> → download the Android
          certificate → install and trust it (see <code>certificates-setups.md</code>).
        </p>
      </div>
      <div className="setup-card setup-card-warning">
        <h3>3. Android Emulator (AndroidWifi)</h3>
        <p>
          If your Wi‑Fi name is <strong>AndroidWifi</strong>, you are on the <strong>emulator</strong>.
          Do <strong>not</strong> use <code>{status.local_ip}</code>.
        </p>
        <p>
          Set manual proxy on the emulator:
          <br />
          Host: <code>{emulatorHost}</code> (not <code>{status.local_ip}</code>)
          <br />
          Port: <code>{status.proxy_port}</code>
        </p>
        <p>
          Or run in terminal:
          <br />
          <code>
            adb shell settings put global http_proxy {emulatorHost}:{status.proxy_port}
          </code>
        </p>
        <p>
          To clear proxy later: <code>adb shell settings put global http_proxy :0</code>
        </p>
        <p>
          <strong>Bypass proxy for:</strong> leave empty (remove <code>local</code>,{" "}
          <code>example.com</code>, etc.) while testing <code>mitm.it</code>.
        </p>
      </div>
      <div className="setup-card">
        <h3>4. Map Local</h3>
        <p>
          Open the <strong>Map Local</strong> tab — map API URLs to JSON files in{" "}
          <code>local-files/</code>.
        </p>
      </div>
      <div className="setup-card">
        <h3>5. macOS certificate (this Mac)</h3>
        <p>
          Run <code>./setup.sh</code> once to trust the mitmproxy CA on macOS.
        </p>
      </div>
    </div>
  );
}
