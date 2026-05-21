import { formatDurationMs } from "../utils/duration";
import { getFlowDurationMs, getFlowUrl, isMapLocalFlow } from "../utils/flow";
import type { MitmFlow } from "../types";

interface TrafficListTableProps {
  flows: MitmFlow[];
  selectedId: string | null;
  onSelectFlow: (flowId: string) => void;
}

function formatTime(timestamp: number | undefined): string {
  if (timestamp === undefined) {
    return "—";
  }
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function getStatusLabel(statusCode: number | undefined): string {
  if (statusCode === undefined) {
    return "Pending";
  }
  if (statusCode >= 200 && statusCode < 300) {
    return "Completed";
  }
  if (statusCode >= 400) {
    return "Error";
  }
  return "Completed";
}

function getClientIp(flow: MitmFlow): string {
  const peername = (flow as MitmFlow & { client_conn?: { peername?: [string, number] } }).client_conn
    ?.peername;
  if (peername && peername.length > 0) {
    return peername[0];
  }
  return "—";
}

export function TrafficListTable({ flows, selectedId, onSelectFlow }: TrafficListTableProps) {
  if (flows.length === 0) {
    return <div className="empty">No requests yet.</div>;
  }
  return (
    <table className="traffic-pro-table">
      <thead>
        <tr>
          <th>#</th>
          <th>URL</th>
          <th>Client</th>
          <th>Method</th>
          <th>Status</th>
          <th>Code</th>
          <th>Duration</th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        {flows.map((flow, index) => {
          const statusCode = flow.response?.status_code;
          const isError = statusCode !== undefined && statusCode >= 400;
          const url = getFlowUrl(flow);
          return (
            <tr
              key={flow.id}
              className={flow.id === selectedId ? "selected" : ""}
              onClick={() => onSelectFlow(flow.id)}
            >
              <td className="col-id">{index + 1}</td>
              <td className="col-url" title={url}>
                {url}
                {isMapLocalFlow(flow) && <span className="badge-mapped">MAP</span>}
              </td>
              <td className="col-client">{getClientIp(flow)}</td>
              <td>
                <span className={`method method-${flow.request.method}`}>{flow.request.method}</span>
              </td>
              <td className={isError ? "status-error" : "status-ok"}>
                <span className={`status-dot ${isError ? "error" : "ok"}`} />
                {getStatusLabel(statusCode)}
              </td>
              <td>{statusCode ?? "—"}</td>
              <td className="col-duration">{formatDurationMs(getFlowDurationMs(flow))}</td>
              <td className="col-time">
                {formatTime(flow.timestamp_created)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
