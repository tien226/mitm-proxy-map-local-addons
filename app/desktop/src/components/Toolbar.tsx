import { ClearFlowsButton } from "./ClearFlowsButton";
import { formatConnectedClientsLabel, getPrimaryConnectedClient } from "../utils/connectedClients";
import type { ConnectedClient, ProxyStatus } from "../types";

interface ToolbarProps {
  status: ProxyStatus;
  connectedClients: ConnectedClient[];
  isLoading: boolean;
  onClearFlows: () => void;
}

export function Toolbar({ status, connectedClients, isLoading, onClearFlows }: ToolbarProps) {
  const canClear = status.is_running && !isLoading;
  const statusLabel = isLoading && !status.is_running ? "Starting..." : status.is_running ? "Running" : "Stopped";
  const primaryClient = getPrimaryConnectedClient(connectedClients);
  const deviceLabel = formatConnectedClientsLabel(status, connectedClients);
  return (
    <header className="toolbar">
      <span className="toolbar-title">TFT Proxy</span>
      <div className="toolbar-status">
        <span className={`status-dot ${status.is_running ? "running" : ""}`} />
        {statusLabel}
        {status.is_running && (
          <span className="toolbar-proxy-endpoints">
            · Mac proxy <strong>{status.local_ip}:{status.proxy_port}</strong>
            · Device{" "}
            <strong className={primaryClient ? "toolbar-device-detected" : "toolbar-device-waiting"}>
              {deviceLabel}
            </strong>
          </span>
        )}
      </div>
      <div className="toolbar-spacer" />
      <div className="toolbar-actions">
        <ClearFlowsButton disabled={!canClear} onClick={onClearFlows} />
      </div>
    </header>
  );
}
