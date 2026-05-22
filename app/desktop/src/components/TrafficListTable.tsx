import { memo } from "react";
import { useTrafficTableColumns } from "../hooks/useTrafficTableColumns";
import { formatDurationMs } from "../utils/duration";
import { getFlowDurationMs, getFlowUrl, isMapLocalFlow } from "../utils/flow";
import type { MitmFlow } from "../types";
import type { TrafficTableColumnId } from "../hooks/useTrafficTableColumns";

interface TrafficListTableProps {
  flows: MitmFlow[];
  selectedId: string | null;
  selectionVariant?: "primary" | "subtle";
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

function renderCell(columnId: TrafficTableColumnId, flow: MitmFlow, index: number): React.ReactNode {
  const statusCode = flow.response?.status_code;
  const isError = statusCode !== undefined && statusCode >= 400;
  const url = getFlowUrl(flow);
  switch (columnId) {
    case "index":
      return index + 1;
    case "url":
      return (
        <>
          {url}
          {isMapLocalFlow(flow) && <span className="badge-mapped">MAP</span>}
        </>
      );
    case "method":
      return <span className={`method method-${flow.request.method}`}>{flow.request.method}</span>;
    case "status":
      return (
        <span className="traffic-status-cell">
          <span className={`status-dot ${isError ? "error" : "ok"}`} />
          <span className="traffic-status-label">{getStatusLabel(statusCode)}</span>
        </span>
      );
    case "code":
      return statusCode ?? "—";
    case "duration":
      return formatDurationMs(getFlowDurationMs(flow));
    case "time":
      return formatTime(flow.timestamp_created);
    default:
      return null;
  }
}

function TrafficListTableInner({
  flows,
  selectedId,
  selectionVariant = "primary",
  onSelectFlow,
}: TrafficListTableProps) {
  const { columns, getColumnWidth, handleResizeStart, isResizing } = useTrafficTableColumns();
  if (flows.length === 0) {
    return (
      <div className="empty">
        No requests in this view. Select a folder in Structure or capture traffic from your device.
      </div>
    );
  }
  return (
    <table className={`traffic-pro-table ${isResizing ? "is-resizing-columns" : ""}`}>
      <colgroup>
        {columns.map((column) => (
          <col key={column.id} style={{ width: `${getColumnWidth(column.id)}px` }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.id} className={column.className}>
              <span className="traffic-col-header-label">{column.label}</span>
              {column.resizable && (
                <span
                  className="traffic-col-resizer"
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`Resize ${column.label} column`}
                  onMouseDown={(event) => handleResizeStart(column.id, event)}
                />
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {flows.map((flow, index) => {
          const url = getFlowUrl(flow);
          const statusCode = flow.response?.status_code;
          const isError = statusCode !== undefined && statusCode >= 400;
          const isSelected = flow.id === selectedId;
          const rowClass = isSelected
            ? selectionVariant === "subtle"
              ? "selected-subtle"
              : "selected"
            : "";
          return (
            <tr key={flow.id} className={rowClass} onClick={() => onSelectFlow(flow.id)}>
              {columns.map((column) => {
                const cellClass =
                  column.id === "status"
                    ? `${column.className} ${isError ? "status-error" : "status-ok"}`
                    : column.className;
                return (
                  <td
                    key={column.id}
                    className={cellClass}
                    title={column.id === "url" ? url : undefined}
                  >
                    {renderCell(column.id, flow, index)}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function areTablePropsEqual(left: TrafficListTableProps, right: TrafficListTableProps): boolean {
  return (
    left.flows === right.flows &&
    left.selectedId === right.selectedId &&
    left.selectionVariant === right.selectionVariant &&
    left.onSelectFlow === right.onSelectFlow
  );
}

export const TrafficListTable = memo(TrafficListTableInner, areTablePropsEqual);
