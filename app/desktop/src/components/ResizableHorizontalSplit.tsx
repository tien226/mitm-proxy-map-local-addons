import { useCallback, useEffect, useRef, useState } from "react";

interface ResizableHorizontalSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  initialLeftPercent?: number;
  minLeftPercent?: number;
  maxLeftPercent?: number;
  storageKey?: string;
}

const DEFAULT_LEFT_PERCENT = 50;
const MIN_LEFT_PERCENT = 25;
const MAX_LEFT_PERCENT = 75;

export function ResizableHorizontalSplit({
  left,
  right,
  initialLeftPercent = DEFAULT_LEFT_PERCENT,
  minLeftPercent = MIN_LEFT_PERCENT,
  maxLeftPercent = MAX_LEFT_PERCENT,
  storageKey,
}: ResizableHorizontalSplitProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPercent, setLeftPercent] = useState<number>(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const value = Number(saved);
        if (!Number.isNaN(value)) {
          return Math.min(maxLeftPercent, Math.max(minLeftPercent, value));
        }
      }
    }
    return initialLeftPercent;
  });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const clampPercent = useCallback(
    (value: number): number => Math.min(maxLeftPercent, Math.max(minLeftPercent, value)),
    [maxLeftPercent, minLeftPercent]
  );

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) {
      return;
    }
    const handleMouseMove = (event: MouseEvent): void => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const nextPercent = ((event.clientX - rect.left) / rect.width) * 100;
      setLeftPercent(clampPercent(nextPercent));
    };
    const handleMouseUp = (): void => {
      setIsDragging(false);
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
  }, [isDragging, clampPercent]);

  useEffect(() => {
    if (!isDragging && storageKey) {
      localStorage.setItem(storageKey, String(leftPercent));
    }
  }, [isDragging, storageKey, leftPercent]);

  return (
    <div
      ref={containerRef}
      className={`resizable-horizontal-split ${isDragging ? "is-dragging" : ""}`}
    >
      <div className="split-pane-left" style={{ width: `${leftPercent}%` }}>
        {left}
      </div>
      <div
        className="split-resizer split-resizer-vertical"
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize request and response panels"
        title="Drag to resize"
      />
      <div className="split-pane-right">{right}</div>
    </div>
  );
}
