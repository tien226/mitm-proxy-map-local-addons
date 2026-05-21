import { ClearFlowsButton } from "./ClearFlowsButton";
import type { ProxyStatus } from "../types";

interface ToolbarProps {
  status: ProxyStatus;
  isLoading: boolean;
  onStart: () => void;
  onStop: () => void;
  onClearFlows: () => void;
}

export function Toolbar({ status, isLoading, onStart, onStop, onClearFlows }: ToolbarProps) {
  const canClear = status.is_running && !isLoading;
  return (
    <header className="toolbar">
      <span className="toolbar-title">TFT Proxy</span>
      <div className="toolbar-status">
        <span className={`status-dot ${status.is_running ? "running" : ""}`} />
        {status.is_running ? "Running" : "Stopped"}
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
        {status.is_running ? (
          <button className="btn btn-danger" disabled={isLoading} onClick={onStop} type="button">
            Stop Proxy
          </button>
        ) : (
          <button className="btn btn-primary" disabled={isLoading} onClick={onStart} type="button">
            Start Proxy
          </button>
        )}
      </div>
    </header>
  );
}
