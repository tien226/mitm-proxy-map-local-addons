import type { ProxyStatus } from "../types";

interface SetupPanelProps {
  status: ProxyStatus;
}

export function SetupPanel({ status }: SetupPanelProps) {
  const emulatorHost = status.emulator_host || "10.0.2.2";
  return (
    <div className="setup-panel">
      <h2>Device Setup</h2>
      <div className="setup-card setup-card-primary">
        <h3>Điện thoại thật (cùng Wi‑Fi với Mac)</h3>
        <p>
          Dùng IP Mac — <strong>không</strong> dùng <code>{emulatorHost}</code>.
        </p>
        <p>
          Wi‑Fi → mạng đang dùng (ví dụ <strong>zen8labs</strong>) → Proxy → <strong>Thủ công</strong>:
          <br />
          Host: <code>{status.local_ip}</code>
          <br />
          Port: <code>{status.proxy_port}</code>
        </p>
        <p>
          <strong>Bỏ qua proxy cho:</strong> xóa hết (để trống). Xóa{" "}
          <code>example.com</code>, <code>localhost</code>, v.v. — nếu để mặc định dễ báo &quot;không có
          internet&quot;.
        </p>
        <p>
          Tắt VPN trên điện thoại. Mac và điện thoại phải cùng một Wi‑Fi.
        </p>
        <p>
          Mở Safari/Chrome trên điện thoại → <code>http://mitm.it</code> → tải cert Android → cài tin cậy
          (xem <code>certificates-setups.md</code>).
        </p>
      </div>
      <div className="setup-card">
        <h3>1. Start proxy</h3>
        <p>
          Click <strong>Start Proxy</strong> in the toolbar. Proxy listens on{" "}
          <code>0.0.0.0:{status.proxy_port}</code> (all interfaces).
        </p>
      </div>
      <div className="setup-card setup-card-warning">
        <h3>Android Emulator (AndroidWifi)</h3>
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
        <h3>1. Start proxy</h3>
        <p>
          Click <strong>Start Proxy</strong> in the toolbar. Proxy listens on{" "}
          <code>0.0.0.0:{status.proxy_port}</code> (all interfaces).
        </p>
      </div>
      <div className="setup-card">
        <h3>2. Map Local</h3>
        <p>
          Tab <strong>Map Local</strong> — map API URLs to JSON in <code>local-files/</code>.
        </p>
      </div>
      <div className="setup-card">
        <h3>macOS certificate (this Mac)</h3>
        <p>
          Run <code>./setup.sh</code> once to trust mitmproxy CA on macOS.
        </p>
      </div>
    </div>
  );
}
