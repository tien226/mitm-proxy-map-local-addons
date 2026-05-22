import { getPrimaryConnectedClient } from "../utils/connectedClients";
import type { ConnectedClient, ProxyStatus } from "../types";

interface SetupPanelProps {
  status: ProxyStatus;
  connectedClients: ConnectedClient[];
}

export function SetupPanel({ status, connectedClients }: SetupPanelProps) {
  const emulatorHost = status.emulator_host || "10.0.2.2";
  const proxyPort = status.proxy_port;
  const macIp = status.local_ip;
  const detectedDevice = getPrimaryConnectedClient(connectedClients);
  return (
    <div className="setup-panel">
      <h2>Setup Guide</h2>
      <p className="setup-intro">
        Follow these steps to route your app traffic through TFT Proxy on this Mac. When setup is
        correct, requests appear in the <strong>Traffic</strong> tab within a few seconds.
      </p>
      <div className="setup-card setup-card-summary">
        <h3>Quick reference</h3>
        <table className="setup-ref-table">
          <tbody>
            <tr>
              <th>Proxy port</th>
              <td>
                <code>{proxyPort}</code>
              </td>
            </tr>
            <tr>
              <th>Mac IP (proxy host)</th>
              <td>
                <code>{macIp}</code>
              </td>
            </tr>
            <tr>
              <th>Connected device</th>
              <td>
                {detectedDevice ? (
                  <code className="setup-detected-ip">{detectedDevice.ip}</code>
                ) : (
                  <span className="setup-waiting-device">
                    Not detected yet — set phone proxy to Mac IP, then open an app
                  </span>
                )}
              </td>
            </tr>
            <tr>
              <th>Emulator host</th>
              <td>
                <code>{emulatorHost}</code>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="setup-card">
        <h3>1. Start the proxy</h3>
        <p>
          TFT Proxy starts the mitmproxy service automatically when you open the app and stops it
          when you quit. You do not need to press a Start button.
        </p>
        <p>
          Check the toolbar: status should show <strong>Running</strong>. If it shows Stopped or
          an error, install mitmproxy (<code>brew install mitmproxy</code>) and restart the app.
        </p>
      </div>
      <div className="setup-card setup-card-primary">
        <h3>2. Device proxy</h3>
        <p>
          <strong>Physical phone</strong> (same Wi‑Fi as this Mac): Wi‑Fi → your network → HTTP
          proxy → Manual → Host <code>{macIp}</code>, Port <code>{proxyPort}</code>.
        </p>
        <p>
          <strong>Android Emulator</strong> (AndroidWifi): Host <code>{emulatorHost}</code>, Port{" "}
          <code>{proxyPort}</code>. Or in terminal:{" "}
          <code>
            adb shell settings put global http_proxy {emulatorHost}:{proxyPort}
          </code>
        </p>
        <p>
          <strong>Bypass proxy for:</strong> leave empty. Turn off VPN on the phone while
          debugging.
        </p>
        <p>
          Open <code>http://mitm.it</code> on the device browser, install the certificate, and
          trust it (see <code>certificates-setups.md</code>). Then use your app and check the{" "}
          <strong>Traffic</strong> tab.
        </p>
      </div>
      <div className="setup-card">
        <h3>3. HTTPS traffic (certificate)</h3>
        <p>
          HTTP requests appear in Traffic without extra steps. For <strong>HTTPS</strong>, the
          device must trust the mitmproxy certificate from <code>http://mitm.it</code>.
        </p>
        <ul className="setup-steps">
          <li>Install the certificate on the phone or emulator.</li>
          <li>
            Android: Settings → Security → Encryption &amp; credentials → Trusted credentials →
            User → enable the mitmproxy certificate.
          </li>
          <li>
            iOS: Settings → General → About → Certificate Trust Settings → enable full trust for
            the mitmproxy root certificate.
          </li>
          <li>
            Reload the app and confirm HTTPS calls show in Traffic without certificate errors in
            the app.
          </li>
        </ul>
      </div>
      <div className="setup-card">
        <h3>4. Map Local (mock responses)</h3>
        <p>
          Optional: open the <strong>Map Local</strong> tab to return a local JSON file instead of
          the real API response.
        </p>
        <ol className="setup-steps">
          <li>Click a request in Traffic → <strong>Map Local</strong> (or add a rule manually).</li>
          <li>
            Edit the JSON under <strong>Response JSON</strong> and click <strong>Save</strong>.
          </li>
          <li>
            Files are stored in <code>local-files/</code>. The URL and HTTP method must match
            exactly.
          </li>
        </ol>
      </div>
    </div>
  );
}
