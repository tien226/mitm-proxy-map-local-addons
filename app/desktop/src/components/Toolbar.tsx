import { ClearFlowsButton } from "./ClearFlowsButton";
import type { ProxyStatus } from "../types";

interface ToolbarProps {
  status: ProxyStatus;
  isLoading: boolean;
  onClearFlows: () => void;
}

export function Toolbar({ status, isLoading, onClearFlows }: ToolbarProps) {
  const canClear = status.is_running && !isLoading;
  const statusLabel = isLoading && !status.is_running ? "Starting..." : status.is_running ? "Running" : "Stopped";
  return (
    <header className="toolbar">
      <span className="toolbar-title">TFT Proxy</span>
      <div className="toolbar-status">
        <span className={`status-dot ${status.is_running ? "running" : ""}`} />
        {statusLabel}
        {status.is_running && (
          <span className="toolbar-proxy-endpoints">
            · Emulator <strong>{status.emulator_host}:{status.proxy_port}</strong>
            · Phone {status.local_ip}:{status.proxy_port}
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
