import { useCallback, useEffect, useRef, useState } from "react";

export type TrafficTableColumnId =
  | "index"
  | "url"
  | "method"
  | "status"
  | "code"
  | "duration"
  | "time";

export interface TrafficTableColumnDef {
  id: TrafficTableColumnId;
  label: string;
  className: string;
  minWidth: number;
  defaultWidth: number;
  resizable: boolean;
}

export const TRAFFIC_TABLE_COLUMNS: TrafficTableColumnDef[] = [
  { id: "index", label: "#", className: "col-id", minWidth: 32, defaultWidth: 40, resizable: true },
  { id: "url", label: "URL", className: "col-url", minWidth: 120, defaultWidth: 360, resizable: true },
  { id: "method", label: "Method", className: "col-method", minWidth: 56, defaultWidth: 72, resizable: true },
  { id: "status", label: "Status", className: "col-status", minWidth: 72, defaultWidth: 96, resizable: true },
  { id: "code", label: "Code", className: "col-code", minWidth: 44, defaultWidth: 52, resizable: true },
  { id: "duration", label: "Duration", className: "col-duration", minWidth: 64, defaultWidth: 80, resizable: true },
  { id: "time", label: "Time", className: "col-time", minWidth: 72, defaultWidth: 96, resizable: true },
];

const STORAGE_KEY = "tft-proxy-traffic-column-widths";

type ColumnWidths = Record<TrafficTableColumnId, number>;

function buildDefaultWidths(): ColumnWidths {
  const widths = {} as ColumnWidths;
  for (const column of TRAFFIC_TABLE_COLUMNS) {
    widths[column.id] = column.defaultWidth;
  }
  return widths;
}

function loadColumnWidths(): ColumnWidths {
  const defaults = buildDefaultWidths();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw) as Partial<ColumnWidths>;
    for (const column of TRAFFIC_TABLE_COLUMNS) {
      const saved = parsed[column.id];
      if (typeof saved === "number" && saved >= column.minWidth) {
        defaults[column.id] = saved;
      }
    }
  } catch {
    return defaults;
  }
  return defaults;
}

function saveColumnWidths(widths: ColumnWidths): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
}

interface ResizeSession {
  columnId: TrafficTableColumnId;
  startX: number;
  startWidth: number;
}

export function useTrafficTableColumns() {
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(loadColumnWidths);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const resizeSessionRef = useRef<ResizeSession | null>(null);

  const getColumnWidth = useCallback(
    (columnId: TrafficTableColumnId): number => columnWidths[columnId],
    [columnWidths]
  );

  const handleResizeStart = useCallback(
    (columnId: TrafficTableColumnId, event: React.MouseEvent<HTMLSpanElement>): void => {
      event.preventDefault();
      event.stopPropagation();
      const column = TRAFFIC_TABLE_COLUMNS.find((entry) => entry.id === columnId);
      if (!column || !column.resizable) {
        return;
      }
      resizeSessionRef.current = {
        columnId,
        startX: event.clientX,
        startWidth: columnWidths[columnId],
      };
      setIsResizing(true);
    },
    [columnWidths]
  );

  useEffect(() => {
    if (!isResizing) {
      return;
    }
    const handleMouseMove = (event: MouseEvent): void => {
      const session = resizeSessionRef.current;
      if (!session) {
        return;
      }
      const column = TRAFFIC_TABLE_COLUMNS.find((entry) => entry.id === session.columnId);
      if (!column) {
        return;
      }
      const deltaX = event.clientX - session.startX;
      const nextWidth = Math.max(column.minWidth, session.startWidth + deltaX);
      setColumnWidths((previous) => {
        if (previous[session.columnId] === nextWidth) {
          return previous;
        }
        const updated = { ...previous, [session.columnId]: nextWidth };
        saveColumnWidths(updated);
        return updated;
      });
    };
    const handleMouseUp = (): void => {
      resizeSessionRef.current = null;
      setIsResizing(false);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  return {
    columns: TRAFFIC_TABLE_COLUMNS,
    columnWidths,
    getColumnWidth,
    handleResizeStart,
    isResizing,
  };
}
